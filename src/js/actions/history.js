/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

define(function (require, exports) {
    "use strict";

    var Promise = require("bluebird"),
        _ = require("lodash");

    var descriptor = require("adapter/ps/descriptor"),
        photoshopEvent = require("adapter/lib/photoshopEvent"),
        documentLib = require("adapter/lib/document"),
        historyLib = require("adapter/lib/history"),
        layerActions = require("./layers"),
        documentActions = require("./documents");

    var events = require("js/events"),
        locks = require("js/locks"),
        log = require("js/util/log");

    /**
     * Query the current history state for the current document
     *
     * @param {number} documentID document for which to query history
     * @param {boolean=} quiet If true, this will not dispatch a history event
     * @return {Promise}
     */
    var queryCurrentHistoryCommand = function (documentID, quiet) {
        return descriptor.get("historyState")
            .bind(this)
            .then(function (historyState) {
                var payload = {
                    source: "query",
                    documentID: documentID,
                    id: historyState.ID,
                    name: historyState.name,
                    totalStates: historyState.count,
                    currentState: historyState.itemIndex - 1 // convert to zero based index
                };

                if (!quiet) {
                    this.dispatch(events.history.HISTORY_PS_STATUS, payload);
                }
                return Promise.resolve(payload);
            });
    };

    var _navigateHistory = function (document, count) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        if (!document) {
            throw new Error("History changed without an open document");
        }

        var historyStore = this.flux.store("history"),
            historyPlayObject,
            hasNextState,
            hasNextStateCached;

        if (count === 1) {
            hasNextState = historyStore.hasNextState(document.id);
            hasNextStateCached = historyStore.hasNextStateCached(document.id);
            historyPlayObject = historyLib.stepForward;
        } else if (count === -1) {
            hasNextState = historyStore.hasPreviousState(document.id);
            hasNextStateCached = historyStore.hasPreviousStateCached(document.id);
            historyPlayObject = historyLib.stepBackward;
        }

        if (!hasNextState) {
            throw new Error("History: cannot change history state because it seems not to exist," +
                "or you are trying to change by more than one step which is not supported yet");
        }

        if (hasNextStateCached) {
            // play the undo/redo in photoshop, then fetch the current selection,
            // then load history state model from cache
            // It is desirable to pass the selectedIndices in the payload so that there is no "flash"
            // of the cached selection state, which occurs if we just pass control to updateSelection action
            return descriptor.playObject(historyPlayObject).bind(this).then(function () {
                descriptor.batchGetOptionalProperties(documentLib.referenceBy.id(document.id), ["targetLayers"])
                    .bind(this)
                    .then(function (batchResponse) {
                        var selectedIndices = _.pluck(batchResponse.targetLayers || [], "index");
                        return this.dispatchAsync(events.history.LOAD_HISTORY_STATE, {
                            documentID: document.id,
                            count: count,
                            selectedIndices: selectedIndices
                        });
                    });
            });
        } else {
            // If cached state is not available, we must wait for photoshop undo/redo to be complete
            // before calling history.incr/decr, and finally updateDocument
            log.info("HISTORY CACHE MISS");
            return descriptor.playObject(historyPlayObject)
                .bind(this)
                .then(function () {
                    return this.dispatchAsync(events.history.ADJUST_HISTORY_STATE, {
                            documentID: document.id,
                            count: count
                        })
                        .bind(this)
                        .then(function () {
                            return this.transfer(documentActions.updateDocument);
                        });
                });
        }
    };

    var revertCurrentDocumentCommand = function () {
        var historyStore = this.flux.store("history"),
            currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
            nextStateIndex = historyStore.lastSavedStateIndex(currentDocumentID);

        if (nextStateIndex) {
            // load state.  do we need to reset selection afterward? (my guess is no)
            log.info("asking history store to restore last saved (" + nextStateIndex + ")");
            return this.dispatchAsync(events.history.LOAD_HISTORY_STATE_REVERT,
                { documentID: currentDocumentID });
        } else {
            return this.transfer(documentActions.updateDocument);
        }
    };

    /** 
     * Here's the thing about these incr/decr commands:
     * If there is a cached version, it updates the document store
     */

    var incrementHistoryCommand = function (document) {
        return _navigateHistory.call(this, document, 1);
    };

    var decrementHistoryCommand = function (document) {
        return _navigateHistory.call(this, document, -1);
    };

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _selectHandler,
        _historyStateHandler;

    /**
     * Register event listeners for step back/forward commands
     * @return {Promise}
     */
    var beforeStartupCommand = function () {
        var applicationStore = this.flux.store("application");

        // Listen for historyState select events
        _selectHandler = function (event) {
            if (photoshopEvent.targetOf(event) === "historyState") {
                var document = applicationStore.getCurrentDocument();
                log.warn("Unexpected History State Select event from photoshop %O, document %O", event, document);
            }
        }.bind(this);
        descriptor.addListener("select", _selectHandler);

        // We get these every time there is a new history state being created
        // or we undo/redo (step forwards/backwards)
        // Numbers provided here are 0 based, while getting the same numbers
        // through get("historyState") are 1 based, so we make up for it here.
        _historyStateHandler = function (event) {
            var currentDocumentID = this.flux.store("application").getCurrentDocumentID();

            if (currentDocumentID === null) {
                return;
            }

            var payload = {
                source: "listener", // hacky/debuggy?
                documentID: currentDocumentID,
                name: event.name,
                totalStates: event.historyStates + 1, // yes, seriously.
                currentState: event.currentHistoryState // seems to be zero-base already (unlike get historyState)
            };
            log.info("History state change event %s", JSON.stringify(event));
            log.info("History state change payload %s", JSON.stringify(payload));
            this.dispatchAsync(events.history.HISTORY_PS_STATUS, payload);
        }.bind(this);
        descriptor.addListener("historyState", _historyStateHandler);

        return Promise.resolve();
    };

    var onResetCommand = function () {
        descriptor.removeListener("select", _selectHandler);
        descriptor.removeListener("historyState", _historyStateHandler);

        return Promise.resolve();
    };

    var queryCurrentHistory = {
        command: queryCurrentHistoryCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var revertCurrentDocument = {
        command: revertCurrentDocumentCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_HISTORY, locks.JS_DOC]
    };

    var incrementHistory = {
        command: incrementHistoryCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_HISTORY, locks.JS_DOC]
    };

    var decrementHistory = {
        command: decrementHistoryCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_HISTORY, locks.JS_DOC]
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        reads: [],
        writes: []
    };

    var onReset = {
        command: onResetCommand,
        reads: [],
        writes: []
    };

    exports.queryCurrentHistory = queryCurrentHistory;
    exports.revertCurrentDocument = revertCurrentDocument;
    exports.incrementHistory = incrementHistory;
    exports.decrementHistory = decrementHistory;
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
