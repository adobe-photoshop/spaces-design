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
        Immutable = require("immutable");

    var events = require("../events"),
        collection = require("js/util/collection");

    var DialogStore = Fluxxor.createStore({
        /**
         * Information about the set of open documents.
         * 
         * @private
         * @type {Map.<string, {exclusive: boolean, transient: boolean}>}
         */
        _openDialogs: Immutable.Map(),

        initialize: function () {
            this.bindActions(
                events.dialog.OPEN_DIALOG, this._handleOpen,
                events.dialog.CLOSE_DIALOG, this._handleClose,
                events.dialog.CLOSE_ALL_DIALOGS, this._handleCloseAll,
                events.document.SELECT_LAYERS_BY_ID, this._handleSelectionChange,
                events.document.SELECT_LAYERS_BY_INDEX, this._handleSelectionChange,
                events.document.GROUP_SELECTED, this._handleSelectionChange,
                events.document.CLOSE_DOCUMENT, this._handleDocumentChange,
                events.document.SELECT_DOCUMENT, this._handleDocumentChange
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
                currentDocument = applicationStore.getCurrentDocument();

            if (!currentDocument) {
                return null;
            }

            var kinds = collection.pluck(currentDocument.layers.selected, "kind");

            return collection.uniformValue(kinds);
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
            this._openDialogs = this._openDialogs.reduce(function (dialogs, dialogState, dialogID) {
                if (dialogState.policy.dialogOpen) {
                    return dialogs;
                } else {
                    return dialogs.set(dialogID, dialogState);
                }
            }, Immutable.Map([[id, state]]), this);

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
                this._openDialogs = Immutable.Map(this._openDialogs.reduce(function (dialogs, state, dialogID) {
                    if (state.policy.documentChange && state.documentID !== this._getCurrentDocumentID()) {
                        return dialogs;
                    } else {
                        return dialogs.set(dialogID, state);
                    }
                }, new Map(), this));

                this.emit("change");
            });
        },

        /**
         * Close all dialogs with a selectionTypeChange dismissal policy.
         *
         * @private
         */
        _handleSelectionChange: function () {
            this.waitFor(["document", "application"], function () {
                this._openDialogs = Immutable.Map(this._openDialogs.reduce(function (dialogs, state, dialogID) {
                    if (state.policy.selectionTypeChange && state.selectionType !== this._getCurrentSelectionType()) {
                        return dialogs;
                    } else {
                        return dialogs.set(dialogID, state);
                    }
                }, new Map(), this));

                this.emit("change");
            });
        }
    });

    module.exports = DialogStore;
});
