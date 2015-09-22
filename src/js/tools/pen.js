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
        PS = require("adapter/ps"),
        OS = require("adapter/os"),
        UI = require("adapter/ps/ui"),
        toolLib = require("adapter/lib/tool"),
        descriptor = require("adapter/ps/descriptor");

    var Tool = require("js/models/tool"),
        shortcuts = require("js/actions/shortcuts"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy,
        shortcutUtil = require("js/util/shortcuts");

    var _CLEAR_PATH = 106;

    /**
     * @implements {Tool}
     * @constructor
     */
    var PenTool = function () {
        Tool.call(this, "pen", "Pen", "penTool");

        var toolOptions = {
            "$AAdd": true // Automatically creates a new layer if the current path is closed
        };

        var selectHandler = function () {
            var deleteFn = function (event) {
                event.stopPropagation();

                return PS.performMenuCommand(_CLEAR_PATH)
                    .catch(function () {
                        // Silence the errors here
                    });
            };
            
            // Reset the mode of the pen tool to "shape"
            var resetObj = toolLib.resetShapeTool(),
                optionsObj = toolLib.setToolOptions("penTool", toolOptions),
                backspacePromise = this.transfer(shortcuts.addShortcut,
                    OS.eventKeyCode.BACKSPACE, {}, deleteFn, "penBackspace", true),
                deletePromise = this.transfer(shortcuts.addShortcut,
                    OS.eventKeyCode.DELETE, {}, deleteFn, "penDelete", true),
                resetPromise = descriptor.playObject(resetObj).then(function () {
                    return descriptor.playObject(optionsObj);
                });

            // Disable target path suppression
            var disableSuppressionPromise = UI.setSuppressTargetPaths(false);

            return Promise.join(resetPromise,
                disableSuppressionPromise, backspacePromise, deletePromise);
        };

        var deselectHandler = function () {
            var targetPathsPromise = UI.setSuppressTargetPaths(true),
                backspacePromise = this.transfer(shortcuts.removeShortcut, "penBackspace"),
                deletePromise = this.transfer(shortcuts.removeShortcut, "penDelete");

            return Promise.join(targetPathsPromise, backspacePromise, deletePromise);
        };

        var backspaceKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.BACKSPACE),
            deleteKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.DELETE);
            
        this.keyboardPolicyList = [
            backspaceKeyPolicy,
            deleteKeyPolicy
        ];
        
        this.selectHandler = selectHandler;
        this.deselectHandler = deselectHandler;
        this.activationKey = shortcutUtil.GLOBAL.TOOLS.PEN;
    };
    util.inherits(PenTool, Tool);

    module.exports = PenTool;
});
