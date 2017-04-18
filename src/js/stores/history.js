/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

define(function (require, exports, module) {
    "use strict";

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable"),
        _ = require("lodash");

    var HistoryState = require("js/models/historystate"),
        events = require("../events"),
        storeUtil = require("js/util/store"),
        log = require("js/util/log");

    var HistoryStore = Fluxxor.createStore({

        /**
         * Map of history states, keyed by the document ID
         * Values are an Immutable.List of HistoryStates
         *
         * @type {Immutable.Map<number, Immutable.List.<HistoryState>>}
         */
        _history: null,

        /**
         * Map of documentID to current history index
         *
         * @type {Immutable.Map<number, number>}
         */
        _current: null,

        /**
         * Map of documentID to last saved history index
         *
         * @type {Immutable.Map<number, number>}
         */
        _saved: null,

        /**
         * @const
         * @type {number}
         */
        MAX_HISTORY_SIZE: 51,

        /**
         * Loads saved preferences from local storage and binds flux actions.
         */
        initialize: function () {
            this._history = new Immutable.Map();
            this._current = new Immutable.Map();
            this._saved = new Immutable.Map();

            // dynamically bind subsets of events.document
            var binder = this.bindActions.bind(this);
            storeUtil.bindEvents(events.export.history, this._handleUnifiedHistory, binder);
            storeUtil.bindEvents(events.document.history, this._handleUnifiedHistory, binder);

            this.bindActions(
                events.RESET, this._deleteAllHistory,
                events.history.PS_HISTORY_EVENT, this._handleHistoryFromPhotoshop,
                events.history.LOAD_HISTORY_STATE, this._loadHistoryState,
                events.history.LOAD_HISTORY_STATE_REVERT, this._loadLastSavedHistoryState,
                events.history.NEW_HISTORY_STATE, this._handleUnifiedHistory,
                events.history.ADJUST_HISTORY_STATE, this._adjustHistoryState,
                events.history.FINISH_ADJUSTING_HISTORY_STATE, this._finishAdjustingHistoryState,
                events.history.DELETE_DOCUMENT_HISTORY, this._deleteHistory,
                events.document.CLOSE_DOCUMENT, this._deleteHistory,
                events.document.DOCUMENT_RENAMED, this._deleteHistory,
                events.document.DOCUMENT_UPDATED, this._handleDocumentUpdate,
                events.document.SAVE_DOCUMENT, this._handleSaveEvent
            );
        },

        /**
         * Finds index of the most recently saved history in this document's list,
         * ensures that a document object with an ID exists in state
         *
         * @param {number} documentID
         * @return {?number}
         */
        lastSavedStateIndex: function (documentID) {
            var savedHistoryIndex = this._saved.get(documentID);
            if (this._history.hasIn([documentID, savedHistoryIndex, "document", "id"])) {
                return savedHistoryIndex;
            } else {
                return null;
            }
        },

        /**
         * Find the current pointer by documentID
         *
         * @param {number} documentID
         * @return {?number}
         */
        currentIndex: function (documentID) {
            return this._current.get(documentID);
        },

        /**
         * Is there a next state in the document's history, regardless of status of the document in our cache
         *
         * @param {number} documentID
         * @return {boolean}
         */
        hasNextState: function (documentID) {
            var history = this._history.get(documentID, Immutable.List()),
                current = this._current.get(documentID, -1);
            return (history.size > current + 1);
        },

        /**
         * Checks to see if a history log exists for the given document
         *
         * @param {number} documentID
         * @return {boolean}
         */
        hasInitializedHistory: function (documentID) {
            return this._history.has(documentID);
        },

        /**
         * Is there a next state which has a valid document model
         * TODO this could use an isValid boolean on the HistoryState?
         *
         * @param {number} documentID
         * @return {boolean}
         */
        hasNextStateCached: function (documentID) {
            var history = this._history.get(documentID),
                current = this._current.get(documentID),
                nextState = history && current && history.get(current + 1); // use .hasIn instead?
            return nextState && !!nextState.document;
        },

        /**
         * Is there a previous state in the document's history, regardless of status of the document in our cache
         * Does not allow the zero index (because photoshop)
         *
         * @param {number} documentID
         * @return {boolean}
         */
        hasPreviousState: function (documentID) {
            var current = this._current.get(documentID, -1);
            return current > 1;
        },

        /**
         * Is there a previous state which has a valid document model
         * TODO this could use an isValid boolean on the HistoryState?
         *
         * @param {number} documentID
         * @return {boolean}
         */
        hasPreviousStateCached: function (documentID) {
            var history = this._history.get(documentID),
                current = this._current.get(documentID),
                nextState = history && current && history.get(current - 1); // use .hasIn instead?
            return nextState && !!nextState.document;
        },

        /**
         * Helper function to build out the skeleton of the history list to match the photoshop history
         *
         * @private
         * @param {object} payload
         * @param {Document} document
         * @param {DocumentExports} documentExports
         */
        _initializeHistory: function (payload, document, documentExports) {
            // initialize this document's history
            var documentID = document.id,
                historyList = [];

            var currentState = new HistoryState({
                id: payload.id,
                name: payload.name,
                document: document,
                documentExports: documentExports
            });

            // build out the full list of history states with null placeholder, except current
            var blankHistory = new HistoryState();
            log.debug("[History] Initializing history with %d states", payload.totalStates);

            for (var i = 0; i < payload.totalStates; i++) {
                if (i === payload.currentState) {
                    historyList.push(currentState);
                } else {
                    historyList.push(blankHistory);
                }
            }
            this._history = this._history.set(documentID, Immutable.List(historyList));
            this._current = this._current.set(documentID, payload.currentState);

            if (!document.dirty) {
                this._saved = this._saved.set(documentID, payload.currentState);
            }

            this.emit("change");
        },

        /**
         * Handle history state information from Photoshop, either via an explicit query, or an event.
         *
         * If we already have history for this document,
         * we reconcile the current state information from photoshop (supplied in the payload)
         * - If it agrees with our current state exactly, then it is validated and lightly merged.
         * - If it is ahead by one, treat it as a rogue event and push the history state
         * - Otherwise, give up and re-initialize
         *
         * The "light merge" mentioned above will decorate our history model with ID and name from photoshop.
         * If the payload has either of values, that implies that this was an explicit adapter get("selectHistory")
         *
         * If we do not already have history for this doc, it is initialized.
         * This includes generating a list of blank states based on the total history size reported by PS.
         *
         * payload: {
         *     documentID: !number,
         *     totalStates: !number,
         *     currentState: !number,
         *     name: string=,
         *     id: number=
         * }
         */
        _handleHistoryFromPhotoshop: function (payload) {
            var documentID = payload.documentID;
            this.waitFor(["document", "export", "application"], function (documentStore, exportStore) {
                var document = documentStore.getDocument(documentID),
                    documentExports = exportStore.getDocumentExports(documentID),
                    history = this._history.get(documentID),
                    current = this._current.get(documentID),
                    currentState;

                if (!document) {
                    throw new Error("Received history status from ps, but could not find document with ID: " +
                        payload.documentID);
                }

                if (!_.isFinite(payload.totalStates) || !_.isFinite(payload.currentState)) {
                    throw new Error("Received history status from ps, but basic stats were bad: " +
                        payload.currentState + " / " + payload.totalStates);
                }

                if (history && current) {
                    // history has been initialized
                    if (payload.currentState === 0) {
                        log.debug("[History] Ignoring history status because currentState is zero");
                    } else if (current === payload.currentState) {
                        // validate the current state
                        currentState = history.get(current);
                        if (!currentState) {
                            throw new Error("Could not find current state (%d) in our history: " + current);
                        }

                        // If we have a document in state, it should match the doc store version
                        // But, if we're at the history max limit, then we will assume this is new rogue state
                        // TODO in the future, ps will hopefully provide a more positive way to recognize this
                        if (currentState.isInconsistent(document, documentExports)) {
                            if (current === this.MAX_HISTORY_SIZE - 1) {
                                // handle this like a rogue
                                log.debug("[History] Handling this '50th' as though it were a rogue");
                                return this._pushHistoryState.call(this, {
                                    id: payload.id,
                                    name: payload.name,
                                    document: document,
                                    documentExports: documentExports,
                                    rogue: true
                                });
                            }
                            log.debug("[History] Photoshop history status matches ours, " +
                                "but the documents differ. %O", payload);
                        } else if (document.equals(currentState.document) && current === this.MAX_HISTORY_SIZE - 1) {
                            log.debug("[History] 50th history state, but ignoring because it is equal");
                            return;
                        }

                        // if we have IDs stored in the current state AND the payload, validate that they are equal
                        if (currentState.id && payload.id && currentState.id !== payload.id) {
                            throw new Error("Photoshop's curent state has ID " + payload.id +
                                " but our model's current state has ID" + currentState.id);
                        }

                        // merge in new state props
                        var updatedState = currentState.merge({
                            id: payload.id,
                            name: payload.name,
                            document: document,
                            documentExports: documentExports
                        });

                        if (history.size > payload.totalStates) {
                            // safety
                            log.debug("[History] Trimming future states, possibly just diverging from stale future. " +
                                "Photoshop says the totalStates is " + payload.totalStates + ", " +
                                "but our model says " + history.size);
                            this._history = this._history.slice(0, payload.totalStates);
                            this.emit("change");
                        }

                        if (!updatedState.equals(currentState)) {
                            this._history = this._history.setIn([documentID, current], updatedState);
                            this.emit("change");
                        }
                    } else if (payload.source !== "query" && payload.currentState - current === 1) {
                        // Handle the case where the payload is one step ahead.  A "rogue" update
                        // Push a fresh history on the stack and set the rogue flag
                        log.debug("[History] This is a ROGUE history-changing event %O", payload);
                        if (history.size > payload.totalStates) {
                            // This could simply be that we are diverging from a previous redo future list
                            // But it is a safety feature too
                            log.debug("[History] Trimming future states, possibly just diverging from stale future. " +
                                "Photoshop thinks the totalStates is " + payload.totalStates + ", " +
                                "but our model says " + history.size);
                            this._history = this._history.slice(0, payload.totalStates);
                        }
                        this._pushHistoryState.call(this, {
                            id: payload.id,
                            name: payload.name,
                            document: document,
                            documentExports: documentExports,
                            rogue: true
                        });
                    } else {
                        log.warn("[History] Re-initializing history because photoshop thinks the current state is " +
                            payload.currentState + " of " + payload.totalStates + ", " +
                            "while our model says " + current + " of " + history.size);
                        this._initializeHistory.call(this, payload, document, documentExports);
                    }
                } else {
                    log.debug("[History] Initializing history based on historyState event from ps. %O", payload);
                    this._initializeHistory.call(this, payload, document, documentExports);
                }
            });
        },

        /**
         * This is essentially a wrapper for _handleHistoryFromPhotoshop which extracts the history payload
         * out of a combined document-updated + history-state-fetched action
         *
         * @param {object} payload via DOCUMENT_UPDATED
         */
        _handleDocumentUpdate: function (payload) {
            var historyPayload = payload.history;

            // If history was not fetched for this doc updates
            if (!historyPayload) {
                return;
            }
            historyPayload.documentID = payload.document.documentID;
            return this._handleHistoryFromPhotoshop(historyPayload);
        },

        /**
         * Helper function to mine the documentID from the unstructured payload
         * hope to structure this better in the future
         *
         * @private
         * @param {object} payload
         * @return {number}
         */
        _getDocumentID: function (payload) {
            if (payload.hasOwnProperty("documentID")) {
                return payload.documentID;
            } else if (payload.hasOwnProperty("document") &&
                payload.document.hasOwnProperty("documentID")) {
                return payload.document.documentID;
            } else {
                throw new Error("Payload does not contain documentID");
            }
        },

        /**
         * Move the "current" pointer and UPDATE the document store with a model off the history stack if it exists.
         * Uses the absolute index provided, or "count" as an offset of current.
         * One of these must be supplied in payload
         *
         * Pre-condition: the next state should have a valid document
         *
         * payload.selectedIndices allows the layer selection to be updated, and the cached version discarded
         *
         * @param {{documentID: number, selectedIndices: Array.<number>, count: number=, index: number=}} payload
         */
        _loadHistoryState: function (payload) {
            // TODO validate that count and next are not crazy values
            var documentID = payload.documentID,
                count = payload.count || 0,
                history = this._history.get(documentID),
                current = this._current.get(documentID),
                nextIndex,
                nextState;

            if (!history || !current) {
                throw new Error("Trying to change history, but none is found for document: " + documentID);
            }

            nextIndex = payload.index ? payload.index : (current + count);
            nextState = history.get(nextIndex);
            if (!nextState) {
                throw new Error("No history state found at index " + nextIndex);
            }

            // update the current pointer
            this._current = this._current.set(documentID, nextIndex);

            if (!nextState.document) {
                throw new Error("Could not find a valid document for the requested state");
            } else {
                var currentDocument = this.flux.store("application").getCurrentDocument(),
                    nextDocument = nextState.document,
                    nextDocumentExports = nextState.documentExports;

                if (payload.selectedIndices) {
                    var selectedLayers = Immutable.Set(payload.selectedIndices.map(function (index) {
                            return nextDocument.layers.byIndex(index + 1).id;
                        })),
                        nextLayers = nextDocument.layers.updateSelection(selectedLayers);
                        
                    nextDocument = nextDocument.set("layers", nextLayers);
                }

                // Overlay layer visibility values from the current document.
                // Even though we will also fetch layer visibilities separately from Photoshop,
                // this will allow us to paint most of the UI with our best guess
                // and only late-change the layers panel in the rare case that visibility was re-enabled
                // by undoing to a history state that deals with an otherwise invisible layer
                nextDocument = nextDocument.overlayVisibility(currentDocument);

                // these will emit their own changes
                this.flux.store("export").setDocumentExports(documentID, nextDocumentExports);
                this.flux.store("document").setDocument(nextDocument)
                    .bind(this)
                    .then(function () {
                        // Emit the event after the document store finished dispatching its `change` event.
                        this.emit("timetravel");
                    });
            }
        },

        /**
         * Load the last-saved document, and push it on to the end of the history list
         * This matches photoshop's 'revert' behavior which creates a new history state
         *
         * Pre-condition: document must be cached.  see `lastSavedStateIndex` to validate this
         *
         * @param {{documentID: number}} payload
         */
        _loadLastSavedHistoryState: function (payload) {
            var documentID = payload.documentID,
                lastHistoryState = this._history.getIn([documentID, this.lastSavedStateIndex(documentID)]);

            if (!lastHistoryState || !lastHistoryState.document) {
                throw new Error("Could not revert using cached history state, document model not found");
            }

            var newState = {
                document: lastHistoryState.document,
                documentExports: lastHistoryState.documentExports
            };

            // push a new history on top of current
            this._pushHistoryState.call(this, newState, false, true);
            this._saved = this._saved.set(documentID, this._current.get(documentID));

            // these will emit their own changes
            this.flux.store("export").setDocumentExports(lastHistoryState.documentExports);
            this.flux.store("document").setDocument(lastHistoryState.document)
                .bind(this)
                .then(function () {
                    // Emit the event after the document store finished dispatching its `change` event.
                    this.emit("timetravel");
                });
        },

        /**
         * This simply adjusts the 'current' pointer and emits a change event.
         * This is used in the "cache miss" flow, to pre-increment our history
         * before the updateDocument completes. This does NOT emit a timetravel
         * event because the document may not have updated at this point. (That
         * happens in the handler for FINISH_ADJUSTING_HISTORY_STATE.)
         *
         * @param {object} payload provides a document ID and count(offset)
         */
        _adjustHistoryState: function (payload) {
            var documentID = payload.documentID,
                count = payload.count || 0,
                history = this._history.get(documentID),
                current = this._current.get(documentID),
                next = current ? (current + count) : -1,
                nextState = history && next >= 0 && history.get(next);

            if (!nextState) {
                throw new Error("Could not find next state to adjust");
            }

            if (nextState.document) {
                // If this next state already has a document, we probably should have loaded it
                // This function is intended for pointing to blank states
                log.warn("[History] Adjusting history state, but the next state already has a document.");
            }

            this._current = this._current.set(documentID, next);
            this.emit("change");
        },

        /**
         * This happens after the history state has been adjusted and the document
         * model has finished loading. Emits a timetravel event.
         *
         * @private
         */
        _finishAdjustingHistoryState: function () {
            this.emit("timetravel");
        },

        /**
         * Upon document save, update the history with the non-dirty document, and move the saved pointer
         *
         * @param {{documentID: number}} payload
         */
        _handleSaveEvent: function (payload) {
            this.waitFor(["document", "export", "application"], function (documentStore, exportStore) {
                var documentID = this._getDocumentID(payload),
                    document = documentStore.getDocument(documentID),
                    documentExports = exportStore.getDocumentExports(documentID),
                    currentIndex = this._current.get(documentID);

                if (!currentIndex) {
                    throw new Error("Could not handle save event for document + " + documentID +
                        " because couldn't find current index");
                }

                this._history = this._history.setIn([documentID, currentIndex, "document"], document);
                this._history = this._history.setIn([documentID, currentIndex, "documentExports"], documentExports);
                this._saved = this._saved.set(documentID, currentIndex);
                this.emit("change");
            });
        },

        /**
         * Delete history for all documents
         */
        _deleteAllHistory: function () {
            this._history = Immutable.Map();
            this._current = Immutable.Map();
            this._saved = Immutable.Map();
        },

        /**
         * Delete history for the given set of documents
         *
         * @param {object} payload
         */
        _deleteHistory: function (payload) {
            this.waitFor(["document", "application"], function () {
                var documentID = this._getDocumentID(payload);

                this._history = this._history.delete(documentID);
                this._current = this._current.delete(documentID);
                this._saved = this._saved.delete(documentID);
            });
        },

        /**
         * A tracked-change has occurred, so we push the current state onto our history stack
         * and update the current pointer.  This allows for the possibility of a rogue state
         * having been pushed prior, in which case this will merge instead of push.
         *
         * @param {object} payload
         */
        _handlePostHistoryEvent: function (payload) {
            log.debug("[History] Pushing state after we expect to have gotten a rogue history event");
            this.waitFor(["document", "export", "application"], function (documentStore, exportStore) {
                var documentID = this._getDocumentID(payload),
                    document = documentStore.getDocument(documentID),
                    documentExports = exportStore.getDocumentExports(documentID),
                    nextState = {
                        document: document,
                        documentExports: documentExports
                    };

                if (payload.history && payload.history.name) {
                    nextState.name = payload.history.name;
                }

                if (!document) {
                    throw new Error("Could not push history state, document not found: " + documentID);
                }

                return this._pushHistoryState.call(this, nextState, payload.coalesce, true);
            });
        },

        /**
         * A tracked-change has occurred, so we push the current state onto our history stack
         * ad update the current pointer.
         *
         * @param {object} payload
         */
        _handlePreHistoryEvent: function (payload) {
            this.waitFor(["document", "export", "application"], function (documentStore, exportStore) {
                var documentID = this._getDocumentID(payload),
                    document = documentStore.getDocument(documentID),
                    documentExports = exportStore.getDocumentExports(documentID),
                    nextState = {
                        document: document,
                        documentExports: documentExports
                    };

                if (payload.history && payload.history.name) {
                    nextState.name = payload.history.name;
                }

                if (!document) {
                    throw new Error("Could not push history state, document not found: " + documentID);
                }

                return this._pushHistoryState.call(this, nextState, payload.coalesce);
            });
        },

        /**
         * Amend the current history state with the current document
         *
         * @param {object} payload
         */
        _handleHistoryAmendment: function (payload) {
            this.waitFor(["document", "export", "application"], function (documentStore, exportStore) {
                var documentID = this._getDocumentID(payload),
                    document = documentStore.getDocument(documentID),
                    documentExports = exportStore.getDocumentExports(documentID),
                    stateProps = { document: document, documentExports: documentExports };

                if (!document) {
                    throw new Error("Could not amend history state, document not found: " + documentID);
                }

                var history = this._history.get(documentID, Immutable.List()),
                    current = this._current.get(documentID, -1),
                    currentState = history.get(current),
                    nextState;

                if (!history || !currentState || current < 0) {
                    log.warn("[History] Could not amend history, document history not found: " + documentID);
                    return;
                }

                nextState = currentState.merge(stateProps);

                if (!nextState.equals(currentState)) {
                    history = history.splice(current, 1, nextState);
                    this._history = this._history.set(documentID, history);
                    this.emit("change");
                }
            });
        },

        /**
         * New and improved "unified" history event handler.  payload.history determines
         * whether or not history state is created or amended.
         *
         * @param {object} payload
         */
        _handleUnifiedHistory: function (payload) {
            if (payload.history && payload.history.newState) {
                if (payload.history.amendRogue) {
                    this._handlePostHistoryEvent.call(this, payload);
                } else {
                    this._handlePreHistoryEvent.call(this, payload);
                }
            } else {
                this._handleHistoryAmendment.call(this, payload);
            }
        },

        /**
         * Helper function that pushes a given state onto the history list
         * It will coalesce/merge based on those flags, as well as handle shifting after hitting the max
         *
         * Pre-condition: a state with a valid document
         *
         * @param {object} state props to push on to history
         * @param {boolean=} coalesce if true, merge this on to the previous
         * @param {boolean=} allowRogue if true, merge this on to the previous IFF it has the rogue flag
         */
        _pushHistoryState: function (state, coalesce, allowRogue) {
            var document = state.document,
                documentID = document.id,
                history = this._history.get(documentID, Immutable.List()),
                current = this._current.get(documentID, -1);

            // trim the stale future state
            if (current > -1 && history.size > current + 1) {
                history = history.slice(0, current + 1);
            }

            var lastHistory = history.last();
            if (coalesce || (allowRogue && lastHistory && lastHistory.rogue)) {
                if (!history.size) {
                    throw new Error("Initial must not be coalesced");
                }
                log.debug("[History] Updating the previous history state (coalesce or rogue-catchup)");
                history = history.splice(-1, 1, lastHistory.merge(state).set("rogue", false));
            } else {
                if (history.size === this.MAX_HISTORY_SIZE) {
                    history = history.shift().push(new HistoryState(state));

                    // adjust saved pointer
                    var saved = this._saved.get(documentID);
                    if (saved > 1) {
                        this._saved = this._saved.set(documentID, saved - 1);
                    } else if (saved) {
                        this._saved = this._saved.delete(documentID);
                    }
                } else {
                    history = history.push(new HistoryState(state));
                }
            }

            current = history.size - 1;

            log.debug("[History] History state added or merged: %d", current);
            this._history = this._history.set(documentID, history);
            this._current = this._current.set(documentID, current);
            this.emit("change");
        }
    });

    module.exports = HistoryStore;
});
