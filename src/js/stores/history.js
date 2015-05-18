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
        log = require("js/util/log");

    var HistoryStore = Fluxxor.createStore({

        /**
         * Map of history states, keyed by the document ID
         * Values are an Immutable.List of HistoryStates
         *
         * @type {Immutable.Map<number, Immutable.List.<HistoryState>>> }
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

            this.bindActions(
                // FIXME these names really need to be cleaned up!
                events.history.HISTORY_PS_STATUS, this._handleHistoryFromPhotoshop,
                events.history.LOAD_HISTORY_STATE, this._loadHistoryState,
                events.history.LOAD_HISTORY_STATE_REVERT, this._loadHistoryStateRevert,
                events.history.ADJUST_HISTORY_STATE, this._adjustHistoryState,

                events.RESET, this._deleteAllHistory,
                events.document.CLOSE_DOCUMENT, this._deleteHistory,
                events.document.DOCUMENT_RENAMED, this._deleteHistory,
                events.document.DOCUMENT_UPDATED, this._handleDocumentUpdate,
                events.document.SAVE_DOCUMENT, this._handleSaveEvent,
                // events.document.RESET_LAYERS, this._handlePreHistoryEvent,
                // events.document.RESET_LAYERS_BY_INDEX, this._handlePreHistoryEvent,

                events.document.RESET_BOUNDS_WITH_HISTORY, this._handlePostHistoryEvent,
                events.document.ADD_LAYERS, this._handlePostHistoryEvent,

                // Selecting does not seem to cause state changes
                // events.document.SELECT_LAYERS_BY_ID, this._handlePreHistoryEvent,
                // events.document.SELECT_LAYERS_BY_INDEX, this._handlePreHistoryEvent,

                events.document.DELETE_LAYERS, this._handlePreHistoryEvent,
                events.document.RESIZE_DOCUMENT, this._handlePreHistoryEvent,
                events.document.RENAME_LAYER, this._handlePreHistoryEvent,
                events.document.GROUP_SELECTED, this._handlePreHistoryEvent,
                // events.document.VISIBILITY_CHANGED, this._handlePreHistoryEvent, // PS does not track as history
                events.document.LOCK_CHANGED, this._handlePreHistoryEvent,
                events.document.OPACITY_CHANGED, this._handlePreHistoryEvent,
                events.document.BLEND_MODE_CHANGED, this._handlePreHistoryEvent,
                events.document.REORDER_LAYERS, this._handlePreHistoryEvent,
                events.document.REPOSITION_LAYERS, this._handlePreHistoryEvent,
                // events.document.LAYER_BOUNDS_CHANGED, this._handlePreHistoryEvent, // this does NOT update PS
                events.document.TRANSLATE_LAYERS, this._handlePreHistoryEvent,
                events.document.RESIZE_LAYERS, this._handlePreHistoryEvent,
                events.document.SET_LAYERS_PROPORTIONAL, this._handlePreHistoryEvent,
                // events.document.STROKE_WIDTH_CHANGED, this._handlePreHistoryEvent,  // causes a resetBounds
                // events.document.STROKE_COLOR_CHANGED, this._handlePreHistoryEvent, // causes a resetBounds 
                events.document.STROKE_OPACITY_CHANGED, this._handlePreHistoryEvent,
                // events.document.STROKE_ALIGNMENT_CHANGED, this._handlePreHistoryEvent, // causes a resetBounds
                events.document.STROKE_ADDED, this._handlePreHistoryEvent,
                events.document.FILL_COLOR_CHANGED, this._handlePreHistoryEvent,
                events.document.FILL_OPACITY_CHANGED, this._handlePreHistoryEvent,
                events.document.FILL_ADDED, this._handlePreHistoryEvent,
                events.document.LAYER_EFFECT_CHANGED, this._handlePreHistoryEvent,
                events.document.RADII_CHANGED, this._handlePreHistoryEvent,
                // events.document.TYPE_FACE_CHANGED, this._handlePreHistoryEvent,  // causes a resetBounds
                // events.document.TYPE_SIZE_CHANGED, this._handlePreHistoryEvent, // causes a resetBounds
                events.document.TYPE_COLOR_CHANGED, this._handlePreHistoryEvent
                // events.document.TYPE_TRACKING_CHANGED, this._handlePreHistoryEvent, // causes a resetBounds
                // events.document.TYPE_LEADING_CHANGED, this._handlePreHistoryEvent, // causes a resetBounds
                // events.document.TYPE_ALIGNMENT_CHANGED, this._handlePreHistoryEvent // causes a resetBounds
            );
        },

        /**
         * Finds index of the most recently saved history in this document's list
         *
         * @param {number} documentID
         * @return {number}
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
         * Is there a next state in the document's history?
         *
         * @param {number} documentID
         * @return {boolean}
         */
        hasNextState: function (documentID) {
            var history = this._history.get(documentID) || [],
                current = this._current.get(documentID) || -1;
            return (history.size > current + 1);
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
         * Is there a previous state in the document's history, not including the zero index (because photoshop)
         *
         * @param {number} documentID
         * @return {boolean}
         */
        hasPreviousState: function (documentID) {
            var current = this._current.get(documentID) || -1;
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
         * Handle history state information from Photoshop, either via an explicit query, or an event.
         *
         * If we already have history for this document,
         * we reconcile the current state information from photoshop (supplied in the payload)
         * - If it agrees with our current state exactly, then it is validated and lightly merged.
         * - If it is ahead by one, treat it as the doesn't match.
         * - Otherwise we give up and re-initialize
         *
         * The "light merge" mentioned above will decorate our history model with ID and name from photoshop.
         * If the payload has either of those, which implies that this was an explicit adapter get("selectHistory")
         *
         * If we do not already have history for this doc, then it is initialized
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
            log.debug("Handling history from PS" + JSON.stringify(payload, null, "  "));
            var documentID = payload.documentID;
            this.waitFor(["document", "application"], function (documentStore) {
                var document = documentStore.getDocument(documentID),
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
                        log.info("Ignoring history status because currentState is zero, maybe part of a revert?");
                    } else if (current === payload.currentState) {
                        // validate the current state
                        currentState = history.get(current);
                        if (!currentState) {
                            throw new Error("Could not find current state (%d) in our history: " + current);
                        }

                        // If we have a document in state, it should be correct (this may be overly strict, not sure)
                        if (currentState.document && !document.equals(currentState.document)) {
                            if (current === this.MAX_HISTORY_SIZE - 1) {
                                // handle this like a rogue
                                log.info("Handling this '50th' as though it were a rogue");
                                return this._pushHistoryState.call(this, new HistoryState({
                                    id: payload.id,
                                    name: payload.name,
                                    document: document,
                                    rogue: true
                                }));
                            }
                            log.warn("Photoshop history status matches ours, but the documents differ. %O", payload);
                        } else if (document.equals(currentState.document) && current === this.MAX_HISTORY_SIZE - 1) {
                            log.warn("50th, but ignoring because it is equal");
                            return;
                        }

                        // if we have IDs stored in the current state AND the payload, validate that they are equal
                        if (currentState.id && payload.id && currentState.id !== payload.id) {
                            throw new Error("Photoshop's curent state has ID " + payload.id +
                                " but our model's current state has ID" + currentState.id);
                        }

                        // merge in new state props
                        var updatedState = currentState.merge({id: payload.id, name: payload.name, document: document});

                        if (history.size > payload.totalStates) {
                            // safety
                            log.info("We shall trim a bit off the end of the future because " +
                                "Photoshop thinks the totalStates is " + payload.totalStates + ", " +
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
                        log.warn("This is a ROGUE history-changing event %O", payload);
                        if (history.size > payload.totalStates) {
                            // This could simply be that we are diverging from a previous redo future list
                            // But it is a safety feature too
                            log.info("We shall trim a bit off the end of the future because " +
                                "Photoshop thinks the totalStates is " + payload.totalStates + ", " +
                                "but our model says " + history.size);
                            this._history = this._history.slice(0, payload.totalStates);
                        }
                        this._pushHistoryState.call(this, new HistoryState({
                            id: payload.id,
                            name: payload.name,
                            document: document,
                            rogue: true
                        }));
                    } else {
                        log.warn("Re-initializing history because photoshop thinks the current state is " +
                            payload.currentState + " of " + payload.totalStates + ", " +
                            "while our model says " + current + " of " + history.size);
                        this._initializeHistory.call(this, payload, document);
                    }
                } else {
                    this._initializeHistory.call(this, payload, document);
                }
            });
        },

        /**
         * Helper function to build out the skeleton of the history list to match the photoshop history
         *
         * @param {object} payload
         * @param {Document} document
         */
        _initializeHistory: function (payload, document) {
            // initialize this document's history
            var documentID = document.id,
                historyList = [];

            var currentState = new HistoryState({
                id: payload.id,
                name: payload.name,
                document: document
            });

            // build out the full list of history states with null placeholder, except current
            var blankHistory = new HistoryState();
            log.info("initializing history with %d states", payload.totalStates);

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

        /*
        * Helper function to mine the documentID from the unstructured payload
        * hope to structure this better in the future
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
         * Move the current pointer
         * and UPDATE the document store with a model off the history stack if it exists
         * Uses "count" as an offset of current, or accepts an absolute index.
         * One of these must be supplied in payload
         *
         * selectedIndices allows the selection to be updated, and the cached version discarded
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
            log.info("about to switch to history %s, based on this list %O", nextIndex, history);

            // update the current pointer
            this._current = this._current.set(documentID, nextIndex);

            if (!nextState.document) {
                log.warn("could not find a valid document in our internal history, NOT updating doc store");
                // FIXME this is bad, and maybe should THROW.
                // OR is it reasonable to transfer to an action here (I assume not)
            } else {
                var nextDocument = nextState.document,
                    selectedLayers = Immutable.Set(payload.selectedIndices.map(function (index) {
                        return nextDocument.layers.byIndex(index + 1).id;
                    })),
                    nextLayers = nextDocument.layers.updateSelection(selectedLayers);

                // this will emit its own change
                this.flux.store("document").setDocument(nextDocument.set("layers", nextLayers));
            }
        },

        /**
         * Load the last-saved document, and push it on to the end of the history list
         *
         * @param {{documentID: number}} payload
         */
        _loadHistoryStateRevert: function (payload) {
            var documentID = payload.documentID,
                lastSavedDocument = this._history.getIn([documentID, this.lastSavedStateIndex(documentID), "document"]),
                newState = new HistoryState({document: lastSavedDocument});

            if (!lastSavedDocument) {
                throw new Error ("Could not revert using cached history because document model not found");
            }

            // push a new history on top of current
            this._pushHistoryState.call(this, newState, false, true);
            // this will emit its own change
            this.flux.store("document").setDocument(lastSavedDocument);
        },

        /**
         * Upon document save, update the history with the non-dirty document, and move the saved pointer
         *
         * @param {{documentID: number}} payload
         */
        _handleSaveEvent: function (payload) {
            this.waitFor(["document", "application"], function (documentStore) {
                var documentID = payload.documentID,
                    document = documentStore.getDocument(documentID),
                    currentStateIndex = this._current.get(documentID);

                if (!currentStateIndex) {
                    throw new Error("Could not handle save event for document + " + documentID +
                        " because couldn't find current index");
                }

                this._history = this._history.setIn([documentID, currentStateIndex, "document"], document);
                this._saved = this._saved.set(documentID, currentStateIndex);
                this.emit("change");
            });
        },

        /**
         * This simply adjusts the 'current' pointer
         * emits a change
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
                log.warn("weird, I wasn't expecting the next state to have a document already...");
            }

            this._current = this._current.set(documentID, next);
            this.emit("change");
        },

        /**
         * Delete history for all documents
         *
         * @param {object} payload
         */
        _deleteAllHistory: function (payload) {
            payload.documents.forEach(this._deleteHistory, this);
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
         * ad update the current pointer.  This allows for the possibility of a rogue state
         * having been pushed prior, in which case this will merge instead of push.
         *
         * @param {object} payload
         */
        _handlePostHistoryEvent: function (payload) {
            log.info("Pushing history for an action for which we expect to have gotten a rogue history event");
            this.waitFor(["document", "application"], function (documentStore) {
                var documentID = this._getDocumentID(payload),
                    document = documentStore.getDocument(documentID),
                    nextState = new HistoryState({document: document});

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
            this.waitFor(["document", "application"], function (documentStore) {
                var documentID = this._getDocumentID(payload),
                    document = documentStore.getDocument(documentID),
                    nextState = new HistoryState({document: document});

                if (!document) {
                    throw new Error("Could not push history state, document not found: " + documentID);
                }

                return this._pushHistoryState.call(this, nextState, payload.coalesce);
            });
        },

        /**
         * Helper function that pushes a given state onto the history list
         * It will coalesce/merge based on those flags, as well as handle shifting after hitting the max
         *
         * requires a state with a valid document
         *
         * @param {HistoryState} state state to push
         * @param {boolean=} coalesce if true, merge this on to the previous
         * @param {boolean=} noincr if true, merge this on to the previous IFF it has the rogue flag
         *
         * @return {[type]} [description]
         */
        _pushHistoryState: function (state, coalesce, noincr) {
            var document = state.document,
                documentID = document.id,
                history = this._history.get(documentID) || Immutable.List(),
                current = this._current.get(documentID) || -1;

            // trim the stale future state
            if (current > -1 && history.size > current + 1) {
                history = history.slice(0, current + 1);
            }

            var lastHistory = history.last();
            if (coalesce || (noincr && lastHistory && lastHistory.rogue)) {
                if (!history.size) {
                    throw new Error("Initial must not be coalesced");
                }
                log.info("Updating the previous history state instead of pushing (coalesce or rogue-catchup)");
                history = history.splice(-1, 1, lastHistory.merge(state.set("rogue", false)));
            } else {
                if (history.size === this.MAX_HISTORY_SIZE) {
                    history = history.shift().push(state);

                    // adjust saved pointer
                    var saved = this._saved.get(documentID);
                    if (saved > 1) {
                        this._saved = this._saved.set(documentID, saved - 1);
                    } else if (saved) {
                        this._saved = this._saved.delete(documentID);
                    }
                } else {
                    history = history.push(state);
                }
            }

            current = history.size - 1;

            if (!document.dirty) {
                this._saved = this._saved.set(documentID, current);
            }

            this._history = this._history.set(documentID, history);
            this._current = this._current.set(documentID, current);
            this.emit("change");
            log.info("PUSHED HISTORY, current is now: " + current);
        }
    });

    module.exports = HistoryStore;
});
