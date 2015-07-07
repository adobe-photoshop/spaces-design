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
        RESET: "reset",
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
            history: {
                optimistic: {
                    DELETE_LAYERS: "deleteLayers",
                    RESIZE_DOCUMENT: "resizeDocument",
                    RENAME_LAYER: "renameLayer",
                    GROUP_SELECTED: "groupSelectedLayers",
                    LOCK_CHANGED: "layerLockChanged",
                    OPACITY_CHANGED: "opacityChanged",
                    BLEND_MODE_CHANGED: "blendModeChanged",
                    REORDER_LAYERS: "reorderLayers",
                    REPOSITION_LAYERS: "repositionLayers",
                    NUDGE_LAYERS: "nudgeLayers",
                    RESIZE_LAYERS: "resizeLayers",
                    SET_LAYERS_PROPORTIONAL: "setLayersProportional",
                    STROKE_COLOR_CHANGED: "strokeColorChanged",
                    STROKE_OPACITY_CHANGED: "strokeOpacityChanged",
                    FILL_COLOR_CHANGED: "fillColorChanged",
                    FILL_OPACITY_CHANGED: "fillOpacityChanged",
                    FILL_ADDED: "fillAdded",
                    LAYER_EFFECT_CHANGED: "layerEffectChanged",
                    RADII_CHANGED: "radiiChanged",
                    TYPE_COLOR_CHANGED: "typeColorChanged"
                },
                nonOptimistic: {
                    STROKE_ADDED: "strokeAdded",
                    RESET_BOUNDS: "resetBoundsWithHistory",
                    UNGROUP_SELECTED: "ungroupSelectedLayers",
                    ADD_LAYERS: "addLayers",
                    COMBINE_SHAPES: "combineShapes",
                    DELETE_LAYERS: "deleteLayersNonOptimistic" // eg: ps deletes the entire layer after last path del
                }
            },
            DELETE_LAYERS_NO_HISTORY: "deleteLayersNoHistory",
            SELECT_LAYERS_BY_ID: "selectLayersByID",
            SELECT_LAYERS_BY_INDEX: "selectLayersByIndex",
            VISIBILITY_CHANGED: "layerVisibilityChanged",
            REORDER_LAYERS: "reorderLayersNoHistory",
            LAYER_BOUNDS_CHANGED: "layerBoundsChanged",
            RESET_BOUNDS: "resetBoundsNoHistory", // slightly different than above LAYER_BOUNDS_CHANGED
            RESET_LAYERS: "resetLayers",
            RESET_LAYERS_BY_INDEX: "resetLayersByIndex",
            TRANSLATE_LAYERS: "translateLayers",
            GUIDES_VISIBILITY_CHANGED: "guidesVisibilityChanged",
            SELECT_DOCUMENT: "selectDocument",
            SAVE_DOCUMENT: "saveDocument",
            CLOSE_DOCUMENT: "closeDocument",
            DOCUMENT_RENAMED: "renameDocument",
            DOCUMENT_UPDATED: "updateDocument",
            // The following stroke/type events rely on subsequent bounds fetch
            STROKE_ENABLED_CHANGED: "strokeEnabledChanged",
            STROKE_WIDTH_CHANGED: "strokeWidthChanged",
            STROKE_ALIGNMENT_CHANGED: "strokeAlignmentChanged",
            TYPE_FACE_CHANGED: "typeFaceChanged",
            TYPE_SIZE_CHANGED: "typeSizeChanged",
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
            TOOLBAR_PINNED: "toolbarPinned",
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
            PS_HISTORY_EVENT: "psHistoryStateEvent",
            LOAD_HISTORY_STATE: "loadHistoryState",
            LOAD_HISTORY_STATE_REVERT: "loadHistoryStateRevert",
            ADJUST_HISTORY_STATE: "adjustHistoryState",
            DELETE_DOCUMENT_HISTORY: "deleteDocumentHistory"
        }
    };
});
