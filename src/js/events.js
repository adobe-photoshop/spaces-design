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
            HOST_VERSION: "hostVersion"
        },
        documents: {
            SELECT_DOCUMENT: "selectDocument",
            OPEN_DOCUMENT: "openDocument",
            NEW_DOCUMENT: "newDocument",
            SAVE_DOCUMENT: "saveDocument",
            CLOSE_DOCUMENT: "closeDocument",
            DOCUMENT_UPDATED: "updateDocument",
            CURRENT_DOCUMENT_UPDATED: "updateCurrentDocument",
            RESET_DOCUMENTS: "resetDocuments",
            SCROLL_DOCUMENTS: "scrollDocuments"
        },
        layers: {
            SELECT_LAYERS_BY_ID: "selectLayersByID",
            SELECT_LAYERS_BY_INDEX: "selectLayersByIndex",
            RENAME_LAYER: "renameLayer",
            DESELECT_ALL: "deselectAllLayers",
            GROUP_SELECTED: "groupSelectedLayers",
            VISIBILITY_CHANGED: "layerVisibilityChanged",
            LOCK_CHANGED: "layerLockChanged",
            REORDER_LAYERS: "reorderLayers"
        },
        strokes: {
            STROKE_ENABLED_CHANGED: "strokeEnabledChanged",
            STROKE_WIDTH_CHANGED: "strokeWidthChanged",
            STROKE_COLOR_CHANGED: "strokeColorChanged",
            STROKE_ADDED: "strokeAdded"
        },
        fills: {
            FILL_ENABLED_CHANGED: "fillEnabledChanged",
            FILL_COLOR_CHANGED: "fillColorChanged",
            FILL_OPACITY_CHANGED: "fillOpacityChanged",
            FILL_ADDED: "fillAdded"
        },
        transform: {
            FLIP_LAYERS: "flipLayers",
            TRANSLATE_LAYERS: "translateLayers",
            RESIZE_LAYERS: "resizeLayers",
            RESIZE_DOCUMENT: "resizeDocument",
            RADII_CHANGED: "radiiChanged"
        },
        tools: {
            SELECT_TOOL: "selectTool",
            MODAL_STATE_CHANGE: "modalStateChange"
        },
        ui: {
            TRANSFORM_UPDATED: "transformUpdated"
        },
        shortcuts: {
            ADD_SHORTCUT: "addShortcut"
        },
        dialog: {
            OPEN_DIALOG: "openDialog",
            CLOSE_DIALOG: "closeDialog",
            CLOSE_ALL_DIALOGS: "closeAllDialogs"
        }
    };
});
