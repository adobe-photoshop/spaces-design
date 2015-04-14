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

    module.exports = {
        example: {
            SYNC_ACTION: "syncAction",
            ASYNC_ACTION_START: "asyncActionStart",
            ASYNC_ACTION_SUCCESS: "asyncActionSuccess",
            ASYNC_ACTION_FAIL: "asyncActionFail"
        },
        application: {
            HOST_VERSION: "hostVersion",
            UPDATE_RECENT_FILES: "updateRecentFiles",
            INITIALIZED: "appInitialized"
        },
        document: {
            SELECT_DOCUMENT: "selectDocument",
            OPEN_DOCUMENT: "openDocument",
            NEW_DOCUMENT: "newDocument",
            SAVE_DOCUMENT: "saveDocument",
            CLOSE_DOCUMENT: "closeDocument",
            DOCUMENT_RENAMED: "renameDocument",
            DOCUMENT_UPDATED: "updateDocument",
            CURRENT_DOCUMENT_UPDATED: "updateCurrentDocument",
            RESIZE_DOCUMENT: "resizeDocument",
            RESET_DOCUMENTS: "resetDocuments",
            ADD_LAYERS: "addLayers",
            GUIDES_VISIBILITY_CHANGED: "guidesVisibilityChanged",
            RESET_LAYERS: "resetLayers",
            RESET_LAYERS_BY_INDEX: "resetLayersByIndex",
            RESET_BOUNDS: "resetBounds",
            DELETE_LAYERS: "deleteLayers",
            SELECT_LAYERS_BY_ID: "selectLayersByID",
            SELECT_LAYERS_BY_INDEX: "selectLayersByIndex",
            RENAME_LAYER: "renameLayer",
            GROUP_SELECTED: "groupSelectedLayers",
            VISIBILITY_CHANGED: "layerVisibilityChanged",
            LOCK_CHANGED: "layerLockChanged",
            OPACITY_CHANGED: "opacityChanged",
            BLEND_MODE_CHANGED: "blendModeChanged",
            REORDER_LAYERS: "reorderLayers",
            REPOSITION_LAYERS: "repositionLayers",
            NUDGE_LAYERS: "nudgeLayers",
            LAYER_BOUNDS_CHANGED: "layerBoundsChanged",
            TRANSLATE_LAYERS: "translateLayers",
            RESIZE_LAYERS: "resizeLayers",
            SET_LAYERS_PROPORTIONAL: "setLayersProportional",
            FLIP_LAYERS: "flipLayers",
            STROKE_ENABLED_CHANGED: "strokeEnabledChanged",
            STROKE_WIDTH_CHANGED: "strokeWidthChanged",
            STROKE_COLOR_CHANGED: "strokeColorChanged",
            STROKE_OPACITY_CHANGED: "strokeOpacityChanged",
            STROKE_ALIGNMENT_CHANGED: "strokeAlignmentChanged",
            STROKE_ADDED: "strokeAdded",
            FILL_COLOR_CHANGED: "fillColorChanged",
            FILL_OPACITY_CHANGED: "fillOpacityChanged",
            FILL_ADDED: "fillAdded",
            LAYER_EFFECT_ADDED: "layerEffectAdded",
            LAYER_EFFECT_CHANGED: "layerEffectChanged",
            RADII_CHANGED: "radiiChanged",
            TYPE_FACE_CHANGED: "typeFaceChanged",
            TYPE_SIZE_CHANGED: "typeSizeChanged",
            TYPE_COLOR_CHANGED: "typeColorChanged",
            TYPE_TRACKING_CHANGED: "typeTrackingChanged",
            TYPE_LEADING_CHANGED: "typeLeadingChanged",
            TYPE_ALIGNMENT_CHANGED: "typeAlignmentChanged"
        },
        tool: {
            SELECT_TOOL: "selectTool",
            MODAL_STATE_CHANGE: "modalStateChange"
        },
        ui: {
            TRANSFORM_UPDATED: "transformUpdated",
            PANELS_RESIZED: "panelsResized",
            TOGGLE_OVERLAYS: "toggleOverlays",
            SUPERSELECT_MARQUEE: "superselectMarquee"
        },
        shortcut: {
            ADD_SHORTCUT: "addShortcut",
            REMOVE_SHORTCUT: "removeShortcut"
        },
        dialog: {
            REGISTER_DIALOG: "registerDialog",
            DEREGISTER_DIALOG: "deregisterDialog",
            OPEN_DIALOG: "openDialog",
            CLOSE_DIALOG: "closeDialog",
            CLOSE_ALL_DIALOGS: "closeAllDialogs"
        },
        font: {
            INIT_FONTS: "initFonts"
        },
        menus: {
            INIT_MENUS: "initMenus",
            UPDATE_MENUS: "updateMenus"
        },
        preferences: {
            SET_PREFERENCE: "setPreference",
            SET_PREFERENCES: "setPreferences",
            DELETE_PREFERENCE: "deletePreference",
            CLEAR_PREFERENCES: "clearPreferences"
        },
        history: {
            NEW_HISTORY_STATE: "newHistoryState",
            HISTORY_STATE_CHANGE: "historyStateChange"
        }
    };
});
