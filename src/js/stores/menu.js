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
         * @type {?MenuBar}
         */
        _applicationMenu: null,
        
        /**
         * @private
         * @type {boolean}
         */
        _isExecutingPlaceCommand: null,

        /**
         * Initialize the policy sets
         */
        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,

                events.application.UPDATE_RECENT_FILES, this._updateRecentFiles,
                events.menus.INIT_MENUS, this._handleMenuInitialize,
                events.menus.UPDATE_MENUS, this._updateMenuItems,
                events.menus.PLACE_COMMAND, this._handlePlaceCommand,

                events.document.SELECT_DOCUMENT, this._updateMenuItems,
                events.document.DOCUMENT_UPDATED, this._updateMenuItems,
                events.document.SAVE_DOCUMENT, this._updateMenuItems,
                events.document.DOCUMENT_RENAMED, this._updateMenuItems,
                events.document.CLOSE_DOCUMENT, this._updateMenuItems,
                events.document.history.ADD_LAYERS, this._updateMenuItems,
                events.document.GUIDES_VISIBILITY_CHANGED, this._updateMenuItems,
                events.document.history.GUIDE_SET, this._updateMenuItems,
                events.document.history.GUIDE_DELETED, this._updateMenuItems,
                events.document.history.GUIDES_CLEARED, this._updateMenuItems,
                events.document.history.RESET_LAYERS, this._updateMenuItems,
                events.document.history.RESET_LAYERS_BY_INDEX, this._updateMenuItems,
                events.document.history.RESET_BOUNDS, this._updateMenuItems,
                events.document.history.REORDER_LAYERS, this._updateMenuItems,
                events.document.SELECT_LAYERS_BY_ID, this._updateMenuItems,
                events.document.SELECT_LAYERS_BY_INDEX, this._updateMenuItems,
                events.document.VISIBILITY_CHANGED, this._updateMenuItems,
                events.document.history.LOCK_CHANGED, this._updateMenuItems,
                events.document.history.OPACITY_CHANGED, this._updateMenuItems,
                events.document.history.BLEND_MODE_CHANGED, this._updateMenuItems,
                events.document.history.RENAME_LAYER, this._updateMenuItems,
                events.document.history.DELETE_LAYERS, this._updateMenuItems,
                events.document.history.GROUP_SELECTED, this._updateMenuItems,
                events.document.history.UNGROUP_SELECTED, this._updateMenuItems,
                events.document.history.REPOSITION_LAYERS, this._updateMenuItems,
                events.document.history.RESIZE_LAYERS, this._updateMenuItems,
                events.document.history.SET_LAYERS_PROPORTIONAL, this._updateMenuItems,
                events.document.history.RESIZE_DOCUMENT, this._updateMenuItems,
                events.document.history.RADII_CHANGED, this._updateMenuItems,
                events.document.history.FILL_COLOR_CHANGED, this._updateMenuItems,
                events.document.history.FILL_OPACITY_CHANGED, this._updateMenuItems,
                events.document.SET_GROUP_EXPANSION, this._updateMenuItems,
                events.document.history.STROKE_ALIGNMENT_CHANGED, this._updateMenuItems,
                events.document.history.STROKE_ENABLED_CHANGED, this._updateMenuItems,
                events.document.history.STROKE_WIDTH_CHANGED, this._updateMenuItems,
                events.document.history.STROKE_COLOR_CHANGED, this._updateMenuItems,
                events.document.history.STROKE_OPACITY_CHANGED, this._updateMenuItems,
                events.document.history.STROKE_ADDED, this._updateMenuItems,
                events.document.history.LAYER_EFFECT_CHANGED, this._updateMenuItems,
                events.document.history.TYPE_FACE_CHANGED, this._updateMenuItems,
                events.document.history.TYPE_SIZE_CHANGED, this._updateMenuItems,
                events.document.history.TYPE_COLOR_CHANGED, this._updateMenuItems,
                events.document.history.TYPE_TRACKING_CHANGED, this._updateMenuItems,
                events.document.history.TYPE_LEADING_CHANGED, this._updateMenuItems,
                events.document.history.TYPE_ALIGNMENT_CHANGED, this._updateMenuItems,
                events.dialog.OPEN_DIALOG, this._updateMenuItems,
                events.dialog.CLOSE_DIALOG, this._updateMenuItems,
                events.history.LOAD_HISTORY_STATE, this._updateMenuItems,
                events.history.LOAD_HISTORY_STATE_REVERT, this._updateMenuItems,
                events.export.SERVICE_STATUS_CHANGED, this._updateMenuItems,
                events.tool.VECTOR_MASK_MODE_CHANGE, this._updateMenuItems,

                events.document.GUIDES_VISIBILITY_CHANGED, this._updateViewMenu,
                events.panel.COLOR_STOP_CHANGED, this._updateColorStop,
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
            this._applicationMenu = null;
            this._isExecutingPlaceCommand = false;
        },
        
        getState: function () {
            return {
                isExecutingPlaceCommand: this._isExecutingPlaceCommand
            };
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
         * @param {DialogStore} dialogStore
         * @param {PreferencesStore} preferencesStore
         * @param {HistoryStore} historyStore
         * @param {ExportStore} exportStore
         * @param {ToolStore} toolStore
         */
        _updateMenuItemsHelper: _.debounce(function (docStore, appStore, dialogStore,
            preferencesStore, historyStore, exportStore, toolStore) {
            var oldMenu = this._applicationMenu;
            if (!oldMenu) {
                return;
            }

            var document = appStore.getCurrentDocument(),
                openDocuments = docStore.getAllDocuments(),
                appIsModal = dialogStore.getState().appIsModal,
                appIsInputModal = dialogStore.getState().appIsInputModal,
                hasPreviousHistoryState = document && historyStore.hasPreviousState(document.id),
                hasNextHistoryState = document && historyStore.hasNextState(document.id),
                exportEnabled = exportStore.getState().serviceAvailable,
                preferences = preferencesStore.getState(),
                vectorMaskMode = toolStore.getVectorMode();
                
            this._applicationMenu = this._applicationMenu.updateMenuItems(openDocuments, document,
                hasPreviousHistoryState, hasNextHistoryState, appIsModal, appIsInputModal, exportEnabled,
                vectorMaskMode);
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
        }, 400),

        /**
         * This is our main listener for most of the events in the app
         * that cause a change in document or selection that would cause
         * a menu item to be disabled
         *
         * @private
         */
        _updateMenuItems: function () {
            this.waitFor(["document", "application", "dialog", "preferences", "history", "export", "tool"],
                this._updateMenuItemsHelper);
        },
        
        /**
         * Handle status update of place command.
         *
         * @private
         * @param {object} payload
         * @param {boolean} payload.executing
         */
        _handlePlaceCommand: function (payload) {
            this._isExecutingPlaceCommand = payload.executing;
        },

        /**
         * Updates the recent files menu
         * @private
         */
        _updateRecentFiles: function () {
            this.waitFor(["application"], function (appStore) {
                var recentFiles = appStore.getRecentFiles(),
                    oldMenu = this._applicationMenu;

                if (!oldMenu) {
                    return;
                }

                this._applicationMenu = oldMenu.updateRecentFiles(recentFiles);

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

                if (!oldMenu) {
                    return;
                }

                this._applicationMenu = oldMenu.updateViewMenuItems(document);

                if (!Immutable.is(oldMenu, this._applicationMenu)) {
                    this.emit("change");
                }
            }.bind(this));
        },
        
        /**
         * Updates the color theme menu items.
         * @private
         */
        _updateColorStop: function () {
            this.waitFor(["panel"], function (panelStore) {
                var colorStop = panelStore.getColorStop(),
                    oldMenu = this._applicationMenu;

                if (!oldMenu) {
                    return;
                }

                this._applicationMenu = oldMenu.updateColorThemeItems(colorStop);

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

                if (!oldMenu) {
                    return;
                }

                this._applicationMenu = oldMenu.updatePreferenceBasedMenuItems(preferences);

                if (!Immutable.is(oldMenu, this._applicationMenu)) {
                    this.emit("change");
                }
            }.bind(this));
        }

    });

    module.exports = MenuStore;
});
