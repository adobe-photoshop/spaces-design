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

define(function (require, exports) {
    "use strict";

    var Promise = require("bluebird");
    
    var OS = require("adapter").os,
        UI = require("adapter").ps.ui,
        toolLib = require("adapter").lib.tool,
        descriptor = require("adapter").ps.descriptor,
        vectorMaskLib = require("adapter").lib.vectorMask;

    var shortcuts = require("js/actions/shortcuts"),
        locks = require("js/locks");

    var _CLEAR_PATH = 106;
    
    /**
     * Sets the tool into either path or shape mode and calls the approprate PS actions based on that mode
     *
     * @private
     */
    var select = function () {
        var toolStore = this.flux.store("tool"),
            vectorMode = toolStore.getVectorMode(),
            toolMode = toolLib.toolModes.SHAPE;
            
        if (vectorMode) {
            toolMode = toolLib.toolModes.PATH;
        }

        var toolOptions = {
            "$AAdd": true // Automatically creates a new layer if the current path is closed
        };

        var optionsObj = toolLib.setToolOptions("penTool", toolOptions),
            setPromise = descriptor.playObject(toolLib.setShapeToolMode(toolMode))
                .then(function () {
                    return descriptor.playObject(optionsObj);
                });

        var deleteFn = function (event) {
            event.stopPropagation();
            if (toolStore.getVectorMode()) {
                this.flux.actions.mask.handleDeleteVectorMask();
            } else {
                // When path is selected, hitting DELETE key should delete the selected path, otherwise, 
                // the selected layer(s) should be deleted. We don't know whether a path is selected or not, 
                // so we try to delete a selected path (by running menu command) first. If nothing is deleted,
                // we delete the selected layer(s).
                this.flux.actions.menu.native({ commandID: _CLEAR_PATH })
                    .bind(this)
                    .then(function (pathCleared) {
                        if (!pathCleared) {
                            this.flux.actions.layers.deleteSelected();
                        }
                    });
            }
        }.bind(this);

        var backspacePromise = this.transfer(shortcuts.addShortcut,
                OS.eventKeyCode.BACKSPACE, {}, deleteFn, "penBackspace", true),
            deletePromise = this.transfer(shortcuts.addShortcut,
                OS.eventKeyCode.DELETE, {}, deleteFn, "penDelete", true),
            disableSuppressionPromise = UI.setSuppressTargetPaths(false),
            selectVectorMask;

        if (vectorMode) {
            selectVectorMask = descriptor.playObject(vectorMaskLib.activateVectorMaskEditing());
        } else {
            var applicationStore = this.flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();
            if (currentDocument) {
                selectVectorMask = descriptor.playObject(vectorMaskLib.dropPathSelection());
            } else {
                selectVectorMask = Promise.resolve();
            }
        }

        return Promise.join(setPromise, selectVectorMask, disableSuppressionPromise,
            backspacePromise, deletePromise);
    };
    select.action = {
        reads: [locks.JS_TOOL],
        writes: [],
        transfers: ["shortcuts.addShortcut", "layers.deleteSelected"],
        modal: true
    };

    /**
     * Remove pen tool shortcuts.
     *
     * @return {Promise}
     */
    var deselect = function () {
        var backspacePromise = this.transfer(shortcuts.removeShortcut, "penBackspace"),
            deletePromise = this.transfer(shortcuts.removeShortcut, "penDelete");

        return Promise.join(backspacePromise, deletePromise);
    };
    deselect.action = {
        reads: [],
        writes: [locks.PS_TOOL, locks.PS_APP],
        transfers: ["shortcuts.removeShortcut"],
        modal: true
    };

    exports.select = select;
    exports.deselect = deselect;
});
