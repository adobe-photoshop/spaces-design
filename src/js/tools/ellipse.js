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
        descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool"),
        OS = require("adapter/os"),
        UI = require("adapter/ps/ui");

    var Tool = require("js/models/tool"),
        toolActions = require("js/actions/tools"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy,
        shortcuts = require("js/util/shortcuts");

    /**
     * @implements {Tool}
     * @constructor
     */
    var EllipseTool = function () {
        var resetPromise = descriptor.playObject(toolLib.resetShapeTool()),
            firstLaunch = true;
            
        /** @ignore */
        var selectHandler = function () {
            var defaultPromise;

            if (firstLaunch) {
                var fillColor = [217, 217, 217],
                    strokeColor = [157, 157, 157];

                defaultPromise = this.transfer(toolActions.installShapeDefaults,
                    "ellipseTool", strokeColor, 2, 100, fillColor);

                firstLaunch = false;
                return Promise.join(defaultPromise, resetPromise);
            } else {
                return resetPromise;
            }
        };

        var shiftUKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, { shift: true }, shortcuts.GLOBAL.TOOLS.SHAPE);
        
        Tool.call(this, "ellipse", "Ellipse", "ellipseTool", selectHandler);

        this.keyboardPolicyList = [shiftUKeyPolicy];
        this.activationKey = shortcuts.GLOBAL.TOOLS.ELLIPSE;
    };
    util.inherits(EllipseTool, Tool);

    /**
     * Handler for keydown events, installed when the tool is active.
     *
     * @param {CustomEvent} event
     */
    EllipseTool.prototype.onKeyDown = function (event) {
        var flux = this.getFlux(),
            toolStore = flux.store("tool"),
            detail = event.detail;

        if (detail.keyChar === shortcuts.GLOBAL.TOOLS.SHAPE && detail.modifiers.shift) {
            flux.actions.tools.select(toolStore.getToolByID("rectangle"));
        }
    };
    module.exports = EllipseTool;
});
