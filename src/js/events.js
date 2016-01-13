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
                ADD_LAYERS: "addLayers",
                ADD_VECTOR_MASK_TO_LAYER: "AddVectorMaskToLayer",
                BLEND_MODE_CHANGED: "blendModeChanged",
                DELETE_LAYERS: "deleteLayers",
                FILL_COLOR_CHANGED: "fillColorChanged",
                FILL_OPACITY_CHANGED: "fillOpacityChanged",
                GROUP_SELECTED: "groupSelectedLayers",
                GUIDE_SET: "guideSet",
                GUIDES_CLEARED: "guidesCleared",
                GUIDE_DELETED: "guideDeleted",
                GUIDES_UPDATED: "guidesUpdated",
                LAYER_EFFECTS_BATCH_CHANGED: "layerEffectsBatchChanged",
                LAYER_EFFECT_CHANGED: "layerEffectChanged",
                LAYER_EFFECT_DELETED: "layerEffectDeleted",
                LAYER_EXPORT_ENABLED_CHANGED: "layerExportEnabledChanged",
                LOCK_CHANGED: "layerLockChanged",
                OPACITY_CHANGED: "opacityChanged",
                RADII_CHANGED: "radiiChanged",
                REMOVE_VECTOR_MASK_FROM_LAYER: "RemoveVectorMaskFromLayer",
                RENAME_LAYER: "renameLayer",
                REORDER_LAYERS: "reorderLayersAmendment",
                REPOSITION_LAYERS: "repositionLayers",
                RESET_BOUNDS: "resetBoundsAmendment",
                RESET_LAYERS: "resetLayers",
                RESET_LAYERS_BY_INDEX: "resetLayersByIndex",
                RESIZE_DOCUMENT: "resizeDocument",
                RESIZE_LAYERS: "resizeLayers",
                SET_LAYERS_PROPORTIONAL: "setLayersProportional",
                STROKE_ADDED: "strokeAdded",
                STROKE_ENABLED_CHANGED: "strokeEnabledChanged",
                STROKE_ALIGNMENT_CHANGED: "strokeAlignmentChanged",
                STROKE_WIDTH_CHANGED: "strokeWidthChanged",
                STROKE_COLOR_CHANGED: "strokeColorChanged",
                STROKE_OPACITY_CHANGED: "strokeOpacityChanged",
                STROKE_CHANGED: "strokeChanged",
                TYPE_FACE_CHANGED: "typeFaceChanged",
                TYPE_SIZE_CHANGED: "typeSizeChanged",
                TYPE_TRACKING_CHANGED: "typeTrackingChanged",
                TYPE_LEADING_CHANGED: "typeLeadingChanged",
                TYPE_ALIGNMENT_CHANGED: "typeAlignmentChanged",
                TYPE_PROPERTIES_CHANGED: "typePropertiesChanged",
                TYPE_COLOR_CHANGED: "typeColorChanged",
                UNGROUP_SELECTED: "ungroupSelectedLayers"
            },
            SELECT_LAYERS_BY_ID: "selectLayersByID",
            SELECT_LAYERS_BY_INDEX: "selectLayersByIndex",
            SET_GROUP_EXPANSION: "setGroupExpansion",
            VISIBILITY_CHANGED: "layerVisibilityChanged",
            GUIDES_VISIBILITY_CHANGED: "guidesVisibilityChanged",
            SELECT_DOCUMENT: "selectDocument",
            SAVE_DOCUMENT: "saveDocument",
            CLOSE_DOCUMENT: "closeDocument",
            DOCUMENT_RENAMED: "renameDocument",
            DOCUMENT_UPDATED: "updateDocument"
        },
        export: {
            ASSET_CHANGED: "exportAssetChangedQuietly",
            SERVICE_STATUS_CHANGED: "exportServiceStatusChanged",
            SET_AS_REQUESTED: "exportSetStatusRequested",
            SET_STATE_PROPERTY: "setUseArtboardPrefix",
            history: {
                ASSET_CHANGED: "exportAssetChanged",
                ASSET_ADDED: "exportAssetAdded",
                DELETE_ASSET: "exportDeleteLayerAsset"
            }
        },
        tool: {
            SELECT_TOOL_START: "selectToolStart",
            SELECT_TOOL_END: "selectToolEnd",
            MODAL_STATE_CHANGE: "modalStateChange",
            VECTOR_MASK_MODE_CHANGE: "vectorMaskModeChange",
            VECTOR_MASK_POLICY_CHANGE: "vectorMaskPolicyChange",
            SUPERSELECT_DRAG_UPDATE: "superselectDragUpdate"
        },
        ui: {
            TRANSFORM_UPDATED: "transformUpdated",
            DISPLAY_CHANGED: "displayChanged"
        },
        panel: {
            PANELS_RESIZED: "panelsResized",
            START_CANVAS_UPDATE: "startCanvasUpdate",
            END_CANVAS_UPDATE: "endCanvasUpdate",
            SUPERSELECT_MARQUEE: "superselectMarquee",
            REFERENCE_POINT_CHANGED: "referencePointChanged",
            COLOR_STOP_CHANGED: "colorStopChanged",
            MOUSE_POSITION_CHANGED: "mousePositionChanged"
        },
        modifiers: {
            MODIFIERS_CHANGED: "modifiersChanged"
        },
        shortcut: {
            ADD_SHORTCUT: "addShortcut",
            ADD_SHORTCUTS: "addShortcuts",
            REMOVE_SHORTCUT: "removeShortcut"
        },
        style: {
            COPY_STYLE: "copyStyle",
            COPY_EFFECTS: "copyEffects",
            SHOW_HUD: "showStyleHUD",
            HIDE_HUD: "hideStyleHUD"
        },
        dialog: {
            OPEN_DIALOG: "openDialog",
            CLOSE_DIALOG: "closeDialog",
            CLOSE_ALL_DIALOGS: "closeAllDialogs"
        },
        font: {
            INIT_FONTS: "initFonts"
        },
        menus: {
            INIT_MENUS: "initMenus",
            UPDATE_MENUS: "updateMenus",
            PLACE_COMMAND: "placeCommand"
        },
        preferences: {
            SET_PREFERENCE: "setPreference",
            SET_PREFERENCES: "setPreferences",
            DELETE_PREFERENCE: "deletePreference",
            CLEAR_PREFERENCES: "clearPreferences"
        },
        history: {
            PS_HISTORY_EVENT: "psHistoryStateEvent",
            NEW_HISTORY_STATE: "newHistoryState",
            LOAD_HISTORY_STATE: "loadHistoryState",
            LOAD_HISTORY_STATE_REVERT: "loadHistoryStateRevert",
            ADJUST_HISTORY_STATE: "adjustHistoryState",
            FINISH_ADJUSTING_HISTORY_STATE: "finishedAdjustingHistoryState",
            DELETE_DOCUMENT_HISTORY: "deleteDocumentHistory"
        },
        libraries: {
            LIBRARIES_API_LOADED: "librariesAPILoaded",
            LIBRARIES_LOADED: "librariesLoaded",
            LIBRARIES_UNLOADED: "librariesUnloaded",
            ASSET_CREATED: "libraryAssetCreated",
            ASSET_REMOVED: "libraryAssetRemoved",
            ASSET_RENAMED: "libraryAssetRenamed",
            OPEN_GRAPHIC_FOR_EDIT: "libraryOpenGraphicForEdit",
            PLACE_GRAPHIC_UPDATED: "libraryPlaceGraphicUpdated",
            UPDATING_GRAPHIC_CONTENT: "libraryUpdatingGraphicContent",
            UPDATED_GRAPHIC_CONTENT: "libraryUpdatedGraphicContent",
            DELETED_GRAPHIC_TEMP_FILES: "libraryDeletedGraphicTempFiles",
            LIBRARY_CREATED: "libraryCreated",
            LIBRARY_REMOVED: "libraryRemoved",
            LIBRARY_RENAMED: "libraryRenamed",
            LIBRARY_SELECTED: "librarySelected",
            SYNC_LIBRARIES: "librarySyncLibraries",
            SYNCING_LIBRARIES: "librarySyncingLibraries"
        },
        search: {
            REGISTER_SEARCH_PROVIDER: "registerSearchProvider"
        },
        policies: {
            POLICIES_INSTALLED: "policiesInstalled",
            MODE_CHANGED: "modeChanged"
        }
    };
});
