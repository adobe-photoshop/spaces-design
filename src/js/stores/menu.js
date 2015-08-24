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
        
    var MenuBar = require("js/models/menubar"),
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
            this.bindActions(
                events.RESET, this._handleReset,

                events.application.UPDATE_RECENT_FILES, this._updateRecentFiles,
                events.menus.INIT_MENUS, this._handleMenuInitialize,
                events.menus.UPDATE_MENUS, this._updateMenuItems,

                events.document.SELECT_DOCUMENT, this._updateMenuItems,
                events.document.DOCUMENT_UPDATED, this._updateMenuItems,
                events.document.SAVE_DOCUMENT, this._updateMenuItems,
                events.document.DOCUMENT_RENAMED, this._updateMenuItems,
                events.document.CLOSE_DOCUMENT, this._updateMenuItems,
                events.document.history.nonOptimistic.ADD_LAYERS, this._updateMenuItems,
                events.document.GUIDES_VISIBILITY_CHANGED, this._updateMenuItems,
                events.document.history.nonOptimistic.GUIDE_SET, this._updateMenuItems,
                events.document.history.nonOptimistic.GUIDE_DELETED, this._updateMenuItems,
                events.document.RESET_LAYERS, this._updateMenuItems,
                events.document.RESET_LAYERS_BY_INDEX, this._updateMenuItems,
                events.document.history.nonOptimistic.RESET_BOUNDS, this._updateMenuItems,
                events.document.history.optimistic.REORDER_LAYERS, this._updateMenuItems,
                events.document.REORDER_LAYERS, this._updateMenuItems,
                events.document.SELECT_LAYERS_BY_ID, this._updateMenuItems,
                events.document.SELECT_LAYERS_BY_INDEX, this._updateMenuItems,
                events.document.VISIBILITY_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.LOCK_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.OPACITY_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.BLEND_MODE_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.RENAME_LAYER, this._updateMenuItems,
                events.document.history.optimistic.DELETE_LAYERS, this._updateMenuItems,
                events.document.history.nonOptimistic.DELETE_LAYERS, this._updateMenuItems,
                events.document.history.optimistic.GROUP_SELECTED, this._updateMenuItems,
                events.document.history.optimistic.REPOSITION_LAYERS, this._updateMenuItems,
                events.document.TRANSLATE_LAYERS, this._updateMenuItems,
                events.document.history.optimistic.RESIZE_LAYERS, this._updateMenuItems,
                events.document.history.optimistic.SET_LAYERS_PROPORTIONAL, this._updateMenuItems,
                events.document.history.optimistic.RESIZE_DOCUMENT, this._updateMenuItems,
                events.document.history.optimistic.RADII_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.FILL_COLOR_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.FILL_OPACITY_CHANGED, this._updateMenuItems,
                events.document.STROKE_ALIGNMENT_CHANGED, this._updateMenuItems,
                events.document.STROKE_ENABLED_CHANGED, this._updateMenuItems,
                events.document.STROKE_WIDTH_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.STROKE_COLOR_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.STROKE_OPACITY_CHANGED, this._updateMenuItems,
                events.document.history.nonOptimistic.STROKE_ADDED, this._updateMenuItems,
                events.document.history.optimistic.LAYER_EFFECT_CHANGED, this._updateMenuItems,
                events.document.TYPE_FACE_CHANGED, this._updateMenuItems,
                events.document.TYPE_SIZE_CHANGED, this._updateMenuItems,
                events.document.history.optimistic.TYPE_COLOR_CHANGED, this._updateMenuItems,
                events.document.TYPE_TRACKING_CHANGED, this._updateMenuItems,
                events.document.TYPE_LEADING_CHANGED, this._updateMenuItems,
                events.document.TYPE_ALIGNMENT_CHANGED, this._updateMenuItems,
                events.dialog.OPEN_DIALOG, this._updateMenuItems,
                events.dialog.CLOSE_DIALOG, this._updateMenuItems,
                events.history.LOAD_HISTORY_STATE, this._updateMenuItems,
                events.history.LOAD_HISTORY_STATE_REVERT, this._updateMenuItems,
                events.export.SERVICE_STATUS_CHANGED, this._updateMenuItems,

                events.document.GUIDES_VISIBILITY_CHANGED, this._updateViewMenu,
                events.preferences.SET_PREFERENCE, this._updatePreferencesBasedMenuItems
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._applicationMenu = new MenuBar();
        },

        /**
         * Returns the current application menu object
         *
         * @return {MenuBar}
         */
        getApplicationMenu: function () {
            return this._applicationMenu;
        },

        /**
         * Dispatched by menu actions when json files are first loaded
         * Initializes the menus in a MenuBar object
         *
         * Menu actions listen to the change event from this store,
         * and send a installMenu call to Photoshop. 
         * 
         * This is unique to this situation, because we skip the 
         * React component in the Flux cycle
         *
         * @private
         * @param {{menus: object, shortcuts: object, actions: object, templates: Array.<object>}} payload
         */
        _handleMenuInitialize: function (payload) {
            var menus = payload.menus,
                shortcuts = payload.shortcuts,
                actions = payload.actions,
                templates = payload.templates;

            this._applicationMenu = MenuBar.fromJSONObjects(menus, shortcuts, actions, templates);

            this.emit("change");
        },

        /**
         * Helper function to update menu items once the document and application
         * store have updated. NOTE: this is throttled because the underlying operation
         * is relatively expensive.
         *
         * @private
         * @param {DocumentStore} docStore
         * @param {ApplicationStore} appStore
         */
        _updateMenuItemsHelper: _.debounce(function (docStore, appStore, dialogStore,
            preferencesStore, historyStore, exportStore) {
            var document = appStore.getCurrentDocument(),
                openDocuments = docStore.getAllDocuments(),
                appIsModal = dialogStore.getState().appIsModal,
                appIsInputModal = dialogStore.getState().appIsInputModal,
                hasPreviousHistoryState = document && historyStore.hasPreviousState(document.id),
                hasNextHistoryState = document && historyStore.hasNextState(document.id),
                exportEnabled = exportStore.getState().serviceAvailable,
                preferences = preferencesStore.getState(),
                oldMenu = this._applicationMenu;
                
            this._applicationMenu = this._applicationMenu.updateMenuItems(openDocuments, document,
                hasPreviousHistoryState, hasNextHistoryState, appIsModal, appIsInputModal, exportEnabled);
            this._applicationMenu = this._applicationMenu.updateOpenDocuments(openDocuments, document, appIsModal);

            // Note: this only needs to be called when the active document is loaded/reset, 
            // We could have two levels of "update menu" handler ... but that's not really scalable?
            // Alternately, we could build this logic into the menubar.updateMenuItems process,
            // but that's non-trivial
            this._applicationMenu = this._applicationMenu.updateViewMenuItems(document);
            this._applicationMenu = this._applicationMenu.updatePreferenceBasedMenuItems(preferences);

            if (!Immutable.is(oldMenu, this._applicationMenu)) {
                this.emit("change");
            }
        }, 200),

        /**
         * This is our main listener for most of the events in the app
         * that cause a change in document or selection that would cause
         * a menu item to be disabled
         *
         * @private
         */
        _updateMenuItems: function () {
            this.waitFor(["document", "application", "dialog", "preferences", "history", "export"],
                this._updateMenuItemsHelper);
        },

        /**
         * Updates the recent files menu
         * @private
         */
        _updateRecentFiles: function () {
            this.waitFor(["application"], function (appStore) {
                var recentFiles = appStore.getRecentFiles(),
                    oldMenu = this._applicationMenu;

                this._applicationMenu = this._applicationMenu.updateRecentFiles(recentFiles);

                if (!Immutable.is(oldMenu, this._applicationMenu)) {
                    this.emit("change");
                }
            }.bind(this));
        },

        /**
         * Updates the view menu only
         * @private
         */
        _updateViewMenu: function () {
            this.waitFor(["document", "application"], function (docStore, appStore) {
                var document = appStore.getCurrentDocument(),
                    oldMenu = this._applicationMenu;
                    
                this._applicationMenu = this._applicationMenu.updateViewMenuItems(document);

                if (!Immutable.is(oldMenu, this._applicationMenu)) {
                    this.emit("change");
                }
            }.bind(this));
        },
        
        /**
         * Updates the entries reliant on preferences
         * @private
         */
        _updatePreferencesBasedMenuItems: function () {
            this.waitFor(["preferences"], function (preferencesStore) {
                var preferences = preferencesStore.getState(),
                    oldMenu = this._applicationMenu;
                    
                this._applicationMenu = this._applicationMenu.updatePreferenceBasedMenuItems(preferences);

                if (!Immutable.is(oldMenu, this._applicationMenu)) {
                    this.emit("change");
                }
            }.bind(this));
        }

    });

    module.exports = MenuStore;
});
