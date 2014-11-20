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

        dismissalPolicy: {
            WINDOW_CLICK: "windowClick",
            CANVAS_CLICK: "canvasClick",
            DOCUMENT_CHANGE: "documentChange",
            SELECTION_TYPE_CHANGE: "selectionTypeChange"
        },

        initialize: function () {
            this._openDialogs = new Map();

            this.bindActions(
                events.dialog.OPEN_DIALOG, this._handleOpen,
                events.dialog.CLOSE_DIALOG, this._handleClose,
                events.dialog.CLOSE_ALL_DIALOGS, this._handleCloseAll,
                events.layers.SELECT_LAYERS_BY_ID, this._handleSelectionChange,
                events.layers.SELECT_LAYERS_BY_INDEX, this._handleSelectionChange,
                events.layers.DESELECT_ALL, this._handleSelectionChange,
                events.layers.GROUP_SELECTED, this._handleSelectionChange
            );
        },

        getState: function () {
            return {
                openDialogs: this._openDialogs
            };
        },

        _getCurrentDocumentID: function () {
            var applicationStore = this.flux.store("application");
                
            return applicationStore.getCurrentDocumentID();
        },

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

        _handleOpen: function (payload) {
            var id = payload.id,
                policy = payload.dismissalPolicy,
                state = {
                    policy: policy
                };

            if (policy[this.dismissalPolicy.DOCUMENT_CHANGE]) {
                state.documentID = this._getCurrentDocumentID();
            }

            if (policy[this.dismissalPolicy.SELECTION_TYPE_CHANGE]) {
                state.selectionType = this._getCurrentSelectionType();
            }

            this._openDialogs.set(id, state);
            this.emit("change");
        },

        _handleClose: function (payload) {
            this._openDialogs.delete(payload.id);
            this.emit("change");
        },

        _handleCloseAll: function () {
            this._openDialogs.clear();
            this.emit("change");
        },

        _handleDocumentChange: function () {
            this.waitFor(["layer", "document", "application"], function () {
                var state;
                for (var dialogID of this._openDialogs.keys()) {
                    state = this._openDialogs.get(dialogID);
                    if (state.policy[this.dismissalPolicy.DOCUMENT_CHANGE]) {
                        if (state.documentID !== this._getCurrentDocumentID()) {
                            this._openDialogs.clear(dialogID);
                        }
                    }
                }

                this.emit("change");
            });
        },

        _handleSelectionChange: function () {
            this.waitFor(["layer", "document", "application"], function () {
                var state;
                for (var dialogID of this._openDialogs.keys()) {
                    state = this._openDialogs.get(dialogID);
                    if (state.policy[this.dismissalPolicy.SELECTION_TYPE_CHANGE]) {
                        if (state.selectionType !== this._getCurrentSelectionType()) {
                            this._openDialogs.clear(dialogID);
                        }
                    }
                }

                this.emit("change");
            });
        }
    });

    module.exports = DialogStore;
});
