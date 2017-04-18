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

    var descriptor = require("adapter").ps.descriptor,
        ps = require("adapter").ps,
        documentLib = require("adapter").lib.document,
        historyLib = require("adapter").lib.history,
        documentActions = require("./documents");

    var events = require("js/events"),
        locks = require("js/locks"),
        log = require("js/util/log");

    /**
     * Photoshop command ID for "undo"
     * @type {number}
     * @const 
     */
    var UNDO_NATIVE_MENU_COMMMAND_ID = 101;

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
    queryCurrentHistory.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_HISTORY],
        modal: true
    };

    /**
     * Initialize a document's history state assuming it is both new and clean.
     *
     * @param {number} documentID document for which to query history
     * @param {boolean=} quiet If true, this will not dispatch a history event
     * @return {Promise}
     */
    var initNewHistory = function (documentID, quiet) {
        var payload = {
            source: "init",
            documentID: documentID,
            totalStates: 1,
            currentState: 0
        };

        if (!quiet) {
            this.dispatch(events.history.PS_HISTORY_EVENT, payload);
        }

        return Promise.resolve(payload);
    };
    initNewHistory.action = {
        reads: [],
        writes: [locks.JS_HISTORY],
        modal: true
    };

    /**
     * Helper function to load a state from history store based on a count offset
     * and then to fix it up with the latest selection state, visibility state, and
     * then reset border policies.  Selected layers are also initialized in case the current
     * selection contains layers that were not initialized at the time of the previous history state
     *
     * @private
     * @param {number} documentID
     * @param {number} count
     * @return {Promise}
     */
    var _loadHistory = function (documentID, count) {
        return descriptor.getProperty(documentLib.referenceBy.id(documentID), "targetLayers")
            .bind(this)
            .catch(function () {
                // no targetLayers property means no layer selected
                return [];
            })
            .then(function (targetLayers) {
                var selectedIndices = _.pluck(targetLayers, "_index");
                return this.dispatchAsync(events.history.LOAD_HISTORY_STATE, {
                    documentID: documentID,
                    count: count,
                    selectedIndices: selectedIndices
                });
            })
            .then(function () {
                var document = this.flux.store("application").getCurrentDocument(),
                    selected = document.layers.selected,
                    initializeLayersPromise = this.transfer("layers.initializeLayers", document, selected),
                    visibilityPromise = this.transfer("layers.resetLayerVisibility", document),
                    guidesPromise = this.transfer("guides.resetGuidePolicies");
                
                return Promise.join(initializeLayersPromise, visibilityPromise, guidesPromise);
            });
    };

    /**
     * Go forward or backward in the history state by playing the appropriate photoshop action
     * and either loading a state from the history store's cache, or calling updateDocument
     *
     * @private
     * @param {number} documentID
     * @param {number} count increment history state by this number, should be either 1 or -1
     * @return {Promise}
     */
    var _navigateHistory = function (documentID, count) {
        if (documentID === undefined) {
            documentID = this.flux.store("application").getCurrentDocumentID();
        }

        if (!documentID) {
            throw new Error("History changed without an open document");
        }

        var historyStore = this.flux.store("history"),
            historyPlayObject,
            hasNextState,
            hasNextStateCached;

        if (count === 1) {
            hasNextState = historyStore.hasNextState(documentID);
            hasNextStateCached = historyStore.hasNextStateCached(documentID);
            historyPlayObject = historyLib.stepForward;
        } else if (count === -1) {
            hasNextState = historyStore.hasPreviousState(documentID);
            hasNextStateCached = historyStore.hasPreviousStateCached(documentID);
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
                    return _loadHistory.call(this, documentID, count);
                });
        } else {
            // If cached state is not available, we must wait for photoshop undo/redo to be complete
            // before calling history.incr/decr, and finally updateDocument
            log.debug("[History] HISTORY CACHE MISS");
            return descriptor.playObject(historyPlayObject)
                .bind(this)
                .then(function () {
                    this.dispatch(events.history.ADJUST_HISTORY_STATE, {
                        documentID: documentID,
                        count: count
                    });
                })
                .then(function () {
                    return this.transfer(documentActions.updateDocument);
                })
                .then(function () {
                    return this.transfer("guides.resetGuidePolicies");
                })
                .then(function () {
                    this.dispatch(events.history.FINISH_ADJUSTING_HISTORY_STATE);
                });
        }
    };

    /**
     * Navigate to the next (future) history state
     *
     * @param {number} documentID
     * @return {Promise}
     */
    var incrementHistory = function (documentID) {
        var modal = this.flux.store("tool").getModalToolState();

        if (modal) {
            // For now, don't support "redo" in modal text state
            // Currently we are not disabling this menu action correctly, so this is for safety
            return Promise.resolve();
        } else {
            return _navigateHistory.call(this, documentID, 1);
        }
    };
    incrementHistory.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [locks.JS_HISTORY, locks.JS_DOC, locks.PS_DOC],
        transfers: ["layers.initializeLayers", "layers.resetLayerVisibility",
            "documents.updateDocument", "guides.resetGuidePolicies"],
        modal: true
    };

    /**
     * Navigate to the previous history state
     * If we're in a modal text edit state, play the native UNDO command.
     * Otherwise use the history store
     *
     * @param {number} documentID
     * @return {Promise}
     */
    var decrementHistory = function (documentID) {
        var modal = this.flux.store("tool").getModalToolState();

        if (modal) {
            var payload = {
                commandId: UNDO_NATIVE_MENU_COMMMAND_ID,
                waitForCompletion: true
            };
            return ps.performMenuCommand(payload);
        } else {
            return _navigateHistory.call(this, documentID, -1);
        }
    };
    decrementHistory.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [locks.JS_HISTORY, locks.JS_DOC, locks.PS_DOC],
        transfers: ["layers.initializeLayers", "layers.resetLayerVisibility",
            "documents.updateDocument", "guides.resetGuidePolicies"],
        modal: true
    };

    /**
     * Create a new history state for the given document, with the given name.
     * This is useful for complex workflows that may require several subsequent actions, and this action
     * will generically create a new history state at the beginning of that process.
     *
     * @param {number} documentID
     * @param {string} name
     * @param {boolean=} amendRogue If true, then amend previous history IF it was rogue (PS initiated)
     * @return {Promise}
     */
    var newHistoryState = function (documentID, name, amendRogue) {
        var payload = {
            documentID: documentID,
            history: {
                newState: true,
                amendRogue: amendRogue,
                name: name
            }
        };

        return this.dispatchAsync(events.history.NEW_HISTORY_STATE, payload);
    };
    newHistoryState.action = {
        reads: [],
        writes: [locks.JS_HISTORY],
        modal: true
    };

    /**
     * Create a new history state, unless the current state is "rogue" (created via PS initiated event)
     * in which case that state will be amended.
     *
     * This is useful when PS emits both a historyState event and another event describing some change.
     * In the handling of the latter, since you may not be guaranteed the
     * order of the two events, this action will either create or amended the state depending on whether
     * historyState event was handled first or not.
     *
     * @param {number} documentID
     * @return {Promise}
     */
    var newHistoryStateRogueSafe = function (documentID) {
        return this.transfer(newHistoryState, documentID, null, true);
    };
    newHistoryStateRogueSafe.action = {
        reads: [],
        writes: [],
        transfers: [newHistoryState],
        modal: true
    };

    /**
     * Revert to the document's last saved state.
     *
     * @return {Promise}
     */
    var revertCurrentDocument = function () {
        var historyStore = this.flux.store("history"),
            currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
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
            log.debug("[History] HISTORY CACHE MISS - REVERT");
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

        return superPromise;
    };
    revertCurrentDocument.action = {
        reads: [locks.JS_APP],
        writes: [locks.JS_HISTORY, locks.JS_DOC, locks.PS_DOC],
        transfers: ["documents.updateDocument"],
        post: ["verify.layers.verifyLayerIndex"],
        modal: true,
        hideOverlays: true
    };

    /**
     * Given a history state event from photoshop, dispatch a flux event for the history store
     *
     * @param {object} event a raw historyState event from photoshop
     * @return {Promise}
     */
    var handleHistoryState = function (event) {
        // This assumption of current document could be problematic
        // but would require a core change to include document ID
        var documentID = this.flux.store("application").getCurrentDocumentID();

        // Ignore if either there is no current document,
        // or if this history state is related to another document
        if (documentID === null || documentID !== event.documentID) {
            log.debug("[History] Ignoring this historyState event, probably because it was for a non-current document");
            return Promise.resolve();
        }

        var payload = {
            source: "listener", // for human convenience
            documentID: documentID,
            name: event.name,
            totalStates: event.historyStates + 1, // yes, seriously.
            currentState: event.currentHistoryState // seems to be zero-base already (unlike get historyState)
        };
        return this.dispatchAsync(events.history.PS_HISTORY_EVENT, payload);
    };
    handleHistoryState.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [locks.JS_HISTORY],
        modal: true
    };

    /**
     * Given a history state event from photoshop that comes directly after a "select" event,
     * Interpret this event as cause to nuke history and update doc.  Ideally, we would be
     * able to intelligently step back through cached states, but because photoshop might emit these faster than
     * we can keep up with, things like "reset layer visibility" based on our intermediate cached states might fail
     *
     * @return {Promise}
     */
    var handleHistoryStateAfterSelect = function () {
        // This assumption of current document could be problematic
        // but would require a core change to include document ID
        var documentID = this.flux.store("application").getCurrentDocumentID();

        if (documentID === null) {
            return Promise.resolve();
        }

        return this.dispatchAsync(events.history.DELETE_DOCUMENT_HISTORY, { documentID: documentID })
            .then(function () {
                return this.transfer(documentActions.updateDocument);
            });
    };
    handleHistoryStateAfterSelect.action = {
        reads: [locks.JS_DOC],
        writes: [],
        transfers: ["documents.updateDocument"],
        modal: true
    };

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _historyStateHandler,
        _historySelectHandler;

    /**
     * String value of the most recent "select" event from photoshop.  Null if the event "expired"
     * @type {?string}
     */
    var _recentSelectEvent,
        _recentSelectTimer;

    /**
     * Register event listeners for step back/forward commands
     * @return {Promise}
     */
    var beforeStartup = function () {
        var debouncedHandleHistoryStateAfterSelect =
            _.debounce(this.flux.actions.history.handleHistoryStateAfterSelect.bind(this), 200);

        // We get these every time there is a new history state being created
        _historyStateHandler = function (event) {
            log.debug("[History] History state event from photoshop (raw): currentState (index) %d, total states: %d",
                 event.currentHistoryState, event.historyStates);

            if (_recentSelectTimer) {
                // If a "select" event (undo/redo) was recently received, handle this event specially.
                // This will validate the event and attempt to incr/decr history
                window.clearTimeout(_recentSelectTimer);
                log.debug("[History] History state event received, and there was a recent history select event: %s",
                    _recentSelectEvent);

                debouncedHandleHistoryStateAfterSelect();
                _recentSelectTimer = null;
                _recentSelectEvent = null;
            } else {
                // Handle this historyState event conventionally
                this.flux.actions.history.handleHistoryState(event);
            }
        }.bind(this);
        descriptor.addListener("historyState", _historyStateHandler);

        // We get these every time there is a "select" event of type historyState
        // This indicates an out of band undo/redo event that we try to handle
        _historySelectHandler = function (event) {
            var eventData = event["null"];
            if (eventData && eventData._ref === "historyState" && eventData._value) {
                log.debug("[History] History SELECT event from photoshop _value: %s", eventData._value);

                _recentSelectEvent = eventData._value;
                _recentSelectTimer = window.setTimeout(function () {
                    // If we don't get a timely follow-up historyState event, then just handle it anyway
                    debouncedHandleHistoryStateAfterSelect();
                    _recentSelectEvent = null;
                    _recentSelectTimer = null;
                }, 700);
            }
        }.bind(this);
        descriptor.addListener("select", _historySelectHandler);

        return Promise.resolve();
    };
    beforeStartup.action = {
        reads: [],
        writes: [],
        modal: true
    };
    
    /** @ignore */
    var onReset = function () {
        descriptor.removeListener("historyState", _historyStateHandler);
        descriptor.removeListener("select", _historySelectHandler);
        _recentSelectEvent = null;
        _recentSelectTimer = null;

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: []
    };

    exports.queryCurrentHistory = queryCurrentHistory;
    exports.initNewHistory = initNewHistory;
    exports.incrementHistory = incrementHistory;
    exports.decrementHistory = decrementHistory;
    exports.newHistoryState = newHistoryState;
    exports.newHistoryStateRogueSafe = newHistoryStateRogueSafe;
    exports.revertCurrentDocument = revertCurrentDocument;
    exports.handleHistoryState = handleHistoryState;
    exports.handleHistoryStateAfterSelect = handleHistoryStateAfterSelect;
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
