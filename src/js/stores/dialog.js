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
        events = require("../events");

    var _ = require("lodash");

    var DialogStore = Fluxxor.createStore({
        /**
         * Information about the set of open documents.
         * 
         * @private
         * @type {Map.<string, {exclusive: boolean, transient: boolean}>}
         */
        _openDialogs: null,

        initialize: function () {
            this._openDialogs = new Map();

            this.bindActions(
                events.dialog.OPEN_DIALOG, this._handleOpen,
                events.dialog.CLOSE_DIALOG, this._handleClose,
                events.dialog.CLOSE_ALL_DIALOGS, this._handleCloseAll,
                events.layers.SELECT_LAYERS_BY_ID, this._handleSelectionChange,
                events.layers.SELECT_LAYERS_BY_INDEX, this._handleSelectionChange,
                events.layers.DESELECT_ALL, this._handleSelectionChange,
                events.layers.GROUP_SELECTED, this._handleSelectionChange,
                events.documents.CLOSE_DOCUMENT, this._handleDocumentChange,
                events.documents.SELECT_DOCUMENT, this._handleDocumentChange
            );
        },

        getState: function () {
            return {
                openDialogs: this._openDialogs
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
         * @return {string}
         */
        _getCurrentSelectionType: function () {
            var applicationStore = this.flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument(),
                selectedLayers = currentDocument.getSelectedLayers();

            if (selectedLayers.length === 0) {
                return null;
            }

            var kinds = _.pluck(selectedLayers, "kind");
            if (kinds.length === 1) {
                return kinds[0];
            }

            return kinds.slice(1).reduce(function (prev, kind) {
                if (prev === kind) {
                    return prev;
                }
                return null;
            }, kinds[0]);
        },

        /**
         * Handle an open-dialog event.
         *
         * @private
         * @param {{id: string, dismissalPolicy: object}} payload
         */
        _handleOpen: function (payload) {
            var id = payload.id,
                policy = payload.dismissalPolicy,
                state = {
                    policy: policy
                };

            if (policy.documentChange) {
                state.documentID = this._getCurrentDocumentID();
            }

            if (policy.selectionTypeChange) {
                state.selectionType = this._getCurrentSelectionType();
            }

            // Close dialogs with the "openDialog" dismissal policy
            this._openDialogs.forEach(function (dialogState, dialogID) {
                if (dialogState.policy.dialogOpen) {
                    this._openDialogs.delete(dialogID);
                }
            }, this);

            this._openDialogs.set(id, state);
            this.emit("change");
        },

        /**
         * Handle a close-dialog event.
         *
         * @private
         * @param {{id: number}} payload
         */
        _handleClose: function (payload) {
            this._openDialogs.delete(payload.id);
            this.emit("change");
        },

        /**
         * Handle a close-all-dialogs event.
         *
         * @private
         */
        _handleCloseAll: function () {
            this._openDialogs.clear();
            this.emit("change");
        },

        /**
         * Close all dialogs with a documentChange dismissal policy.
         *
         * @private
         */
        _handleDocumentChange: function () {
            this.waitFor(["layer", "document", "application"], function () {
                this._openDialogs.forEach(function (state, dialogID) {
                    if (state.policy.documentChange) {
                        if (state.documentID !== this._getCurrentDocumentID()) {
                            this._openDialogs.delete(dialogID);
                        }
                    }
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
            this.waitFor(["layer", "document", "application"], function () {
                this._openDialogs.forEach(function (state, dialogID) {
                    if (state.policy.selectionTypeChange) {
                        if (state.selectionType !== this._getCurrentSelectionType()) {
                            this._openDialogs.delete(dialogID);
                        }
                    }
                }, this);

                this.emit("change");
            });
        }
    });

    module.exports = DialogStore;
});
