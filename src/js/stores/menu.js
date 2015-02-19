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
        MenuBar = require("js/models/menubar"),
        events = require("../events");

    /**
     * The Menu store keeps track of the application menu
     * and the state of items in it
     * 
     * @constructor
     */
    var MenuStore = Fluxxor.createStore({
        /**
         * Current application menubar
         * 
         * @private
         * @type {MenuBar}
         */
        _applicationMenu: null,

        /**
         * Initialize the policy sets
         */
        initialize: function () {
            this._applicationMenu = new MenuBar();

            this.bindActions(
                events.menus.LOAD_MENUS, this._handleMenuLoad,
                events.document.DOCUMENT_UPDATED, this._updateMenuItems,
                events.document.CLOSE_DOCUMENT, this._updateMenuItems,
                events.document.RESET_DOCUMENTS, this._updateMenuItems,
                events.document.RESET_LAYERS, this._updateMenuItems,
                events.document.SELECT_DOCUMENT, this._updateMenuItems,
                events.document.SELECT_LAYERS_BY_INDEX, this._updateMenuItems,
                events.document.SELECT_LAYERS_BY_ID, this._updateMenuItems,
                events.document.DELETE_SELECTED, this._updateMenuItems,
                events.document.GROUP_SELECTED, this._updateMenuItems

            );
        },

        /**
         * Dispatched by menu actions when json files are first loaded
         * Loads them into the MenuBar object
         *
         * Menu actions listen to the change event from this store,
         * and send a installMenu call to Photoshop. 
         * 
         * This is unique to this situation, because we skip the 
         * React component in the Flux cycle
         *
         * @private
         * @param {{menus: <object>, actions: <object>}} payload
         */
        _handleMenuLoad: function (payload) {
            this._applicationMenu.loadMenus(payload.menus, payload.actions);

            this.emit("change");
        },

        /**
         * This is our main listener for most of the events in the app
         * that cause a change in document or selection that would cause
         * a menu item to be disabled
         *
         * @private
         * @param {object} payload
         */
        _updateMenuItems: function (payload) {
            this.waitFor(["document"], function () {
                var documentID;

                // Events we listen to send the document ID in different properties
                if (payload.hasOwnProperty("documentID")) {
                    documentID = payload.documentID;
                } else if (payload.hasOwnProperty("selectedDocumentID")) {
                    documentID = payload.selectedDocumentID;
                } else if (payload.hasOwnProperty("document")) {
                    documentID = payload.document.documentID;
                }
                
                // Most actions dispatch document ID, except updateDocument
                // which dispatches the raw document descriptor
                if (!documentID) {
                    throw new Error("No valid document ID in payload for _updateMenuItems");
                }

                var docStore = this.flux.store("document"),
                    document = docStore.getDocument(documentID);

                this._applicationMenu.updateMenuItems(document);

                this.emit("change");
            }.bind(this));
        },

        /**
         * Gets the root of the menu, ready to be sent to Photoshop
         *
         * @return {object}
         */
        getMenuRoot: function () {
            return this._applicationMenu.getMasterMenuList();
        },

        /**
         * Gets the action definition for the given menu item
         *
         * @param {string} itemID dot delimited string for the menu item
         * @return {object} 
         */
        getMenuAction: function (itemID) {
            return this._applicationMenu.getMenuAction(itemID);
        }
    });

    module.exports = MenuStore;
});
