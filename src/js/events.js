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
            DOCUMENT_LIST_UPDATED: "documentsUpdated",
            DOCUMENT_UPDATED: "documentUpdate",
            SCROLL_DOCUMENTS: "scrollDocuments"
        },
        layers: {
            SELECT_LAYER: "selectLayer",
            SELECT_LAYER_FAILED: "selectLayerFailed",
            RENAME_LAYER: "renameLayer",
            RENAME_LAYER_FAILED: "renameLayerFailed",
            DESELECT_ALL: "deselectAllLayers",
            DESELECT_ALL_FAILED: "deselectAllFailed",
            GROUP_SELECTED: "groupSelectedLayers",
            GROUP_SELECTED_FAILED: "groupSelectedLayersFailed"
        },
        tools: {
            SELECT_TOOL: "selectTool",
            SELECT_TOOL_FAILED: "selectToolFailed"
        }
    };
});
