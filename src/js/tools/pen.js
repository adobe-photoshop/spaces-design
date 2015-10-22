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

    var Promise = require("bluebird");
    
    var util = require("adapter/util"),
        OS = require("adapter/os"),
        UI = require("adapter/ps/ui"),
        toolLib = require("adapter/lib/tool"),
        descriptor = require("adapter/ps/descriptor"),
        vectorMaskLib = require("adapter/lib/vectorMask");

    var Tool = require("js/models/tool"),
        shortcuts = require("js/actions/shortcuts"),
        layerActions = require("js/actions/layers"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy,
        shortcutUtil = require("js/util/shortcuts");

    var _CLEAR_PATH = 106;
    
    /**
     * Sets the tool into either path or shape mode and calls the approprate PS actions based on that mode
     *
     * @private
     */
    var _selectHandler = function () {
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
                            return this.transfer(layerActions.deleteSelected);
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
            selectVectorMask = descriptor.playObject(vectorMaskLib.dropPathSelection());
        }
        return Promise.join(setPromise, selectVectorMask, disableSuppressionPromise,
            backspacePromise, deletePromise);
    };

    /**
     * @implements {Tool}
     * @constructor
     */
    var PenTool = function () {
        Tool.call(this, "pen", "Pen", "penTool");

        var deselectHandler = function () {
            var backspacePromise = this.transfer(shortcuts.removeShortcut, "penBackspace"),
                deletePromise = this.transfer(shortcuts.removeShortcut, "penDelete");

            return Promise.join(backspacePromise, deletePromise);
        };

        var backspaceKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.BACKSPACE),
            deleteKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.DELETE),
            escapeKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ESCAPE),
            arrowUpKeyPolicy = new KeyboardEventPolicy(UI.policyAction.FOCUS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_UP),
            arrowRightKeyPolicy = new KeyboardEventPolicy(UI.policyAction.FOCUS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_RIGHT),
            arrowDownKeyPolicy = new KeyboardEventPolicy(UI.policyAction.FOCUS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_DOWN),
            arrowLeftKeyPolicy = new KeyboardEventPolicy(UI.policyAction.FOCUS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_LEFT);
            
        this.keyboardPolicyList = [
            backspaceKeyPolicy,
            deleteKeyPolicy,
            escapeKeyPolicy,
            arrowUpKeyPolicy, // Arrow keys for nudging points
            arrowRightKeyPolicy,
            arrowDownKeyPolicy,
            arrowLeftKeyPolicy
        ];
        
        this.selectHandler = _selectHandler;
        this.deselectHandler = deselectHandler;
        this.activationKey = shortcutUtil.GLOBAL.TOOLS.PEN;
        this.handleVectorMaskMode = true;
    };
    util.inherits(PenTool, Tool);

    /**
     * Handler for keydown events, installed when the tool is active.
     *
     * @param {CustomEvent} event
     */
    PenTool.prototype.onKeyDown = function (event) {
        var flux = this.getFlux(),
            toolStore = flux.store("tool"),
            detail = event.detail;
  
        if (toolStore.getVectorMode() && detail.keyCode === OS.eventKeyCode.ESCAPE) {
            flux.actions.tools.changeVectorMaskMode(false);
        }
    };

    module.exports = PenTool;
});
