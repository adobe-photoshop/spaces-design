/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

import * as Promise from "bluebird";

import { ps as PS, os as OS, lib } from "adapter";

var UI = PS.ui,
    descriptor = PS.descriptor,
    toolLib = lib.tool;
    
import * as shortcuts from "js/actions/shortcuts";
import * as locks from "js/locks";

var _TOGGLE_TARGET_PATH = 3502,
    _CLEAR_PATH = 106;

/**
 * Handler for pathComponentSelectionChanged events
 */
var _pathSelectionhandler;

/**
 * Sets the selection mode to only active layers for direct select tool
 * @private
 */
export var select = function () {
    var deleteFn = function (event) {
        event.stopPropagation();
        
        var flux = this.flux,
            toolStore = flux.store("tool");

        if (toolStore.getVectorMode()) {
            flux.actions.mask.handleDeleteVectorMask();
        } else {
            return PS.performMenuCommand(_CLEAR_PATH)
                .catch(function () {
                    // Silence the errors here
                });
        }
    }.bind(this);

    _pathSelectionhandler = function (event) {
        if (event.pathID && event.pathID.length === 0) {
            var toolStore = this.flux.store("tool");

            this.flux.actions.tools.select(toolStore.getToolByID("newSelect"));
        }
    }.bind(this);
    descriptor.addListener("pathComponentSelectionChanged", _pathSelectionhandler);
    
    var optionsPromise = descriptor.playObject(toolLib.setDirectSelectOptionForAllLayers(false)),
        suppressionPromise = UI.setSuppressTargetPaths(false),
        backspacePromise = this.transfer(shortcuts.addShortcut,
            OS.eventKeyCode.BACKSPACE, {}, deleteFn, "vectorBackspace", true),
        deletePromise = this.transfer(shortcuts.addShortcut,
            OS.eventKeyCode.DELETE, {}, deleteFn, "vectorDelete", true),
        getPathVisiblePromise = descriptor.getProperty("document", "targetPathVisibility");

    return Promise.join(getPathVisiblePromise,
        optionsPromise,
        suppressionPromise,
        backspacePromise,
        deletePromise,
        function (visible) {
            if (!visible) {
                return PS.performMenuCommand(_TOGGLE_TARGET_PATH);
            }
        });
};
select.action = {
    reads: [],
    writes: [locks.PS_APP, locks.PS_TOOL],
    transfers: ["shortcuts.addShortcut"],
    modal: true
};

/**
 * Updates current document because we may have changed bounds in Photoshop
 *
 * @return {Promise}
 */
export var deselect = function () {
    var currentDocument = this.flux.store("application").getCurrentDocument();

    var backspacePromise = this.transfer(shortcuts.removeShortcut, "vectorBackspace"),
        deletePromise = this.transfer(shortcuts.removeShortcut, "vectorDelete");

    descriptor.removeListener("pathComponentSelectionChanged", _pathSelectionhandler);
    _pathSelectionhandler = null;

    return Promise.join(backspacePromise, deletePromise)
        .bind(this)
        .then(function () {
            if (currentDocument) {
                this.flux.actions.layers.resetLayers(currentDocument, currentDocument.layers.selected);
            }
        });
};
deselect.action = {
    reads: [locks.JS_APP],
    writes: [],
    transfers: ["shortcuts.removeShortcut"],
    modal: true
};
