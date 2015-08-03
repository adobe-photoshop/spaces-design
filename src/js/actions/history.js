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
        documentLib = require("adapter/lib/document"),
        historyLib = require("adapter/lib/history"),
        layerActions = require("./layers"),
        toolActions = require("./tools"),
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
    var queryCurrentHistory = function (documentID, quiet) {
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
                    this.dispatch(events.history.PS_HISTORY_EVENT, payload);
                }
                return Promise.resolve(payload);
            });
    };
    queryCurrentHistory.reads = [locks.PS_DOC];
    queryCurrentHistory.writes = [locks.JS_DOC];
    queryCurrentHistory.modal = true;

    /**
     * Given a history state event from photoshop, dispatch a flux event for the history store
     *
     * @param {object} event a raw historyState event from photoshop
     * @return {Promise}
     */
    var handleHistoryState = function (event) {
        // This assumption of current document could be problematic
        // but would require a core change to include document ID
        var currentDocumentID = this.flux.store("application").getCurrentDocumentID();

        if (currentDocumentID === null) {
            return Promise.resolve();
        }

        var payload = {
            source: "listener", // for human convenience
            documentID: currentDocumentID,
            name: event.name,
            totalStates: event.historyStates + 1, // yes, seriously.
            currentState: event.currentHistoryState // seems to be zero-base already (unlike get historyState)
        };
        return this.dispatchAsync(events.history.PS_HISTORY_EVENT, payload);
    };
    handleHistoryState.reads = [locks.JS_DOC, locks.PS_DOC];
    handleHistoryState.writes = [locks.JS_HISTORY];

    /**
     * Go forward or backward in the history state by playing the appropriate photoshop action
     * and either loading a state from the history store's cache, or calling updateDocument
     *
     * @private
     * @param {Document} document
     * @param {number} count increment history state by this number, should be either 1 or -1
     * @return {Promise}
     */
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
        } else {
            throw new Error("Count must be 1 or -1");
        }

        if (!hasNextState) {
            return Promise.resolve();
        }

        if (hasNextStateCached) {
            // play the undo/redo in photoshop, then fetch the current selection,
            // then load history state model from cache
            // It is desirable to pass the selectedIndices in the payload so that there is no "flash"
            // of the cached selection state, which occurs if we just pass control to updateSelection action
            return descriptor.playObject(historyPlayObject)
                .bind(this)
                .then(function () {
                    descriptor.getProperty(documentLib.referenceBy.id(document.id), "targetLayers")
                        .bind(this)
                        .catch(function () {
                            // no targetLayers property means no document is open
                            return [];
                        })
                        .then(function (targetLayers) {
                            var selectedIndices = _.pluck(targetLayers, "_index");
                            return this.dispatchAsync(events.history.LOAD_HISTORY_STATE, {
                                documentID: document.id,
                                count: count,
                                selectedIndices: selectedIndices
                            });
                        })
                        .then(function () {
                            return this.transfer(toolActions.resetBorderPolicies);
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
                            count: count });
                })
                .then(function () {
                    return this.transfer(documentActions.updateDocument);
                });
        }
    };

    /**
     * Navigate to the next (future) history state
     *
     * @param {Document} document
     * @return {Promise}
     */
    var incrementHistory = function (document) {
        return _navigateHistory.call(this, document, 1);
    };
    incrementHistory.reads = [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL];
    incrementHistory.writes = [locks.JS_HISTORY, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    incrementHistory.modal = true;

    /**
     * Navigate to the previous history state
     *
     * @param {Document} document
     * @return {Promise}
     */
    var decrementHistory = function (document) {
        return _navigateHistory.call(this, document, -1);
    };
    decrementHistory.reads = [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL];
    decrementHistory.writes = [locks.JS_HISTORY, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    decrementHistory.modal = true;

    /**
     * Revert to the document's last saved state.
     *
     * @return {Promise}
     */
    var revertCurrentDocument = function () {
        var historyStore = this.flux.store("history"),
            currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
            clearOverlaysPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false }),
            nextStateIndex = historyStore.lastSavedStateIndex(currentDocumentID),
            superPromise;
        
        if (nextStateIndex) {
            // use cached document, revert Ps in parallel
            superPromise = Promise.join(
                descriptor.playObject(historyLib.revert),
                this.dispatchAsync(events.history.LOAD_HISTORY_STATE_REVERT, { documentID: currentDocumentID }));
        } else {
            // If cached state is not available, we must wait for photoshop revert to complete
            // before adjusting history state, and finally updateDocument
            log.info("HISTORY CACHE MISS - REVERT");
            superPromise = descriptor.playObject(historyLib.revert)
                .bind(this)
                .then(function () {
                    return this.dispatchAsync(events.history.DELETE_DOCUMENT_HISTORY,
                        { documentID: currentDocumentID });
                })
                .then(function () {
                    return this.transfer(documentActions.updateDocument);
                });
        }

        // Clear the overlays in parallel with the revert, and then re-enabled them when both complete
        return Promise.join(clearOverlaysPromise, superPromise)
            .bind(this)
            .then(function () {
                return this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: true });
            })
            .then(function () {
                return this.transfer(toolActions.resetBorderPolicies);
            });
    };
    revertCurrentDocument.reads = [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL];
    revertCurrentDocument.writes = [locks.JS_HISTORY, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    revertCurrentDocument.post = [layerActions._verifyLayerIndex];
    revertCurrentDocument.modal = true;

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _historyStateHandler;

    /**
     * Register event listeners for step back/forward commands
     * @return {Promise}
     */
    var beforeStartup = function () {
        // We get these every time there is a new history state being created
        _historyStateHandler = function (event) {
            log.info("History state event from photoshop (raw): currentState (index) %d, total states: %d",
                 event.currentHistoryState, event.historyStates);
            this.flux.actions.history.handleHistoryState(event);
        }.bind(this);
        descriptor.addListener("historyState", _historyStateHandler);

        return Promise.resolve();
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [];

    var onReset = function () {
        descriptor.removeListener("historyState", _historyStateHandler);

        return Promise.resolve();
    };
    onReset.reads = [];
    onReset.writes = [];

    exports.queryCurrentHistory = queryCurrentHistory;
    exports.handleHistoryState = handleHistoryState;
    exports.incrementHistory = incrementHistory;
    exports.decrementHistory = decrementHistory;
    exports.revertCurrentDocument = revertCurrentDocument;
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
