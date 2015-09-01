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

define(function (require, exports, module) {
    "use strict";

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable"),
        _ = require("lodash");

    var events = require("../events"),
        collection = require("js/util/collection"),
        log = require("js/util/log");

    var DialogStore = Fluxxor.createStore({
        /**
         * The set of open Dialog IDs
         * 
         * @private
         * @type {Immutable.Set.<string>}
         */
        _openDialogs: Immutable.Set(),

        /**
         * Information/state for all registered dialogs
         *
         * The value of the map represents the state of the given dialog.
         * It is a map with the following optional keys:
         *     policy: Immutable.Map.<string, boolean>,
         *     documentID: number,
         *     selectionType: string

         * @private
         * @type {Immutable.Map.<string, Immutable.Map<string, object>>}
         */
        _registeredDialogs: Immutable.Map(),

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.dialog.OPEN_DIALOG, this._handleOpen,
                events.dialog.CLOSE_DIALOG, this._handleClose,
                events.dialog.CLOSE_ALL_DIALOGS, this._handleCloseAll,
                events.document.SELECT_LAYERS_BY_ID, this._handleSelectionChange,
                events.document.SELECT_LAYERS_BY_INDEX, this._handleSelectionChange,
                events.document.history.optimistic.GROUP_SELECTED, this._handleSelectionChange,
                events.document.CLOSE_DOCUMENT, this._handleDocumentChange,
                events.document.SELECT_DOCUMENT, this._handleDocumentChange
            );
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._openDialogs = Immutable.Set();
            this._registeredDialogs = Immutable.Map();
        },

        getState: function () {
            return {
                openDialogs: this._openDialogs,
                appIsModal: this._openDialogs.contains("first-launch-dialog") ||
                            this._openDialogs.contains("keyboard-shortcut-dialog"),
                appIsInputModal: this._openDialogs.contains("search-bar-dialog")
            };
        },

        /**
         * Fetch the current document ID, or null if there is no current document.
         *
         * @private
         * @return {?number}
         */
        _getCurrentDocumentID: function () {
            var applicationStore = this.flux.store("application");
                
            return applicationStore.getCurrentDocumentID();
        },

        /**
         * Fetch the type of the current layer selection, or none if there is no
         * consistent type.
         *
         * @private
         * @return {?string}
         */
        _getCurrentSelectionType: function () {
            var applicationStore = this.flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();

            if (!currentDocument) {
                return null;
            }

            var kinds = collection.pluck(currentDocument.layers.selected, "kind");

            return collection.uniformValue(kinds);
        },

        /**
         * Merges state if this event has already been registered
         *
         * @param {string} id Dialog ID
         * @param {object} dismissalPolicy
         */
        registerDialog: function (id, dismissalPolicy) {
            if (this._registeredDialogs.has(id)) {
                throw new Error("Failed to register dialog: " + id + " already exists.");
            }

            var state = Immutable.Map({
                policy: Immutable.Map(dismissalPolicy)
            });

            this._registeredDialogs = this._registeredDialogs.set(id, state);
        },

        /**
         * Deregisters a dialog and
         * emits a change event if this dialog was open
         *
         * @private
         * @param {string} id
         */
        deregisterDialog: function (id) {
            if (!this._registeredDialogs.has(id)) {
                // This a warning instead of an error because the store's state
                // may be reset as a result of a controller reset, which would 
                // explain the missing dialog. Hence, this is most likely benign.
                log.warn("Failed to deregister dialog: " + id + " does not exist.");
            }

            this._registeredDialogs = this._registeredDialogs.delete(id);
            if (this._openDialogs.has(id)) {
                this._openDialogs = this._openDialogs.delete(id);
                this.emit("change");
            }
        },

        /**
         * Handle an open-dialog event.
         * If this dialog has not been pre-registered, it must contain a dismissal policy in the payload
         * Otherwise, the optional dismissal policy will overwrite the previous
         *
         * @private
         * @param {{id: string, dismissalPolicy: object=}} payload
         */
        _handleOpen: function (payload) {
            var id = payload.id,
                newState = Immutable.Map({
                    policy: Immutable.Map(payload.dismissalPolicy || {})
                });

            // register on the fly, but warn if a dismissal policy was not provided
            if (!this._registeredDialogs.has(id)) {
                if (_.isEmpty(payload.dismissalPolicy)) {
                    log.warn("Opening an un-registered dialog without providing a dismissalPolicy");
                }
            } else {
                // merge the new policy, if it was provided
                newState = this._registeredDialogs.get(id).merge(newState);
            }

            if (newState.getIn(["policy", "documentChange"])) {
                newState = newState.set("documentID", this._getCurrentDocumentID());
            }

            if (newState.getIn(["policy", "selectionTypeChange"])) {
                newState = newState.set("selectionType", this._getCurrentSelectionType());
            }

            // update the registry
            this._registeredDialogs = this._registeredDialogs.set(id, newState);

            // Close dialogs with the "openDialog" dismissal policy
            // and add this new one
            this._openDialogs = this._openDialogs
                .filterNot(function (dialogID) {
                    return this._registeredDialogs.getIn([dialogID, "policy", "dialogOpen"], false);
                }, this)
                .add(id);

            this.emit("change");
        },

        /**
         * Handle a close-dialog event.
         *
         * @private
         * @param {{id: number}} payload
         */
        _handleClose: function (payload) {
            this._openDialogs = this._openDialogs.delete(payload.id);
            this.emit("change");
        },

        /**
         * Handle a close-all-dialogs event.
         *
         * @private
         */
        _handleCloseAll: function () {
            this._openDialogs = this._openDialogs.clear();
            this.emit("change");
        },

        /**
         * Close all dialogs with a documentChange dismissal policy.
         *
         * @private
         */
        _handleDocumentChange: function () {
            this.waitFor(["document", "application"], function () {
                this._openDialogs = this._openDialogs.filterNot(function (dialogID) {
                    var state = this._registeredDialogs.get(dialogID);
                    return state.get("policy").get("documentChange") &&
                        state.get("documentID") !== this._getCurrentDocumentID();
                }, this);

                this.emit("change");
            });
        },

        /**
         * Close all dialogs with a selectionTypeChange dismissal policy.
         *
         * @private
         */
        _handleSelectionChange: function () {
            this.waitFor(["document"], function () {
                this._openDialogs = this._openDialogs.filterNot(function (dialogID) {
                    var state = this._registeredDialogs.get(dialogID);
                    return state.get("policy").get("selectionTypeChange") &&
                        state.get("selectionType") !== this._getCurrentSelectionType();
                }, this);

                this.emit("change");
            });
        }
    });

    module.exports = DialogStore;
});
