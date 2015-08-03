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
        UI = require("adapter/ps/ui"),
        vectorMaskLib = require("adapter/lib/vectorMask");

    var Tool = require("js/models/tool"),
        toolActions = require("js/actions/tools"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy,
        utilShortcuts = require("js/util/shortcuts");

    /**
     * Sets the tool into either path or shape mode and calls the approprate PS actions based on that mode
     *
     * @private
     */
    var _selectHandler = function () {
        var toolStore = this.flux.store("tool"),
            vectorMode = toolStore.getVectorMode() || false,
            toolMode = toolLib.shapeVectorTool,
            firstLaunch = true;

        if (vectorMode) {
            toolMode = toolLib.pathVectorTool;
        }

        var setObj = toolLib.setShapeTool(toolMode);

        var setPromise = descriptor.batchPlayObjects([setObj]);

        if (!vectorMode && firstLaunch) {
            var fillColor = [217, 217, 217],
                strokeColor = [157, 157, 157];

            var defaultPromise = this.transfer(toolActions.installShapeDefaults,
                "rectangleTool", strokeColor, 2, 100, fillColor);

            firstLaunch = false;
            return Promise.join(defaultPromise, setPromise);
        } else if (!vectorMode) {
            return Promise.join(setPromise);
        } else {
            return setPromise
            .then(function () {
                return UI.setSuppressTargetPaths(false);
            })
            .then(function () {
                return descriptor.playObject(vectorMaskLib.activateVectorMaskEditing());
            });
        }
    };

    /**
     * @implements {Tool}
     * @constructor
     */
    var RectangleTool = function () {
        var shiftUKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, { shift: true }, utilShortcuts.GLOBAL.TOOLS.SHAPE);

        Tool.call(this, "rectangle", "Rectangle", "rectangleTool", _selectHandler);
       
        this.keyboardPolicyList = [shiftUKeyPolicy];
        this.activationKey = utilShortcuts.GLOBAL.TOOLS.RECTANGLE;
        this.handleVectorMaskMode = true;
    };
    util.inherits(RectangleTool, Tool);

    /**
     * Handler for keydown events, installed when the tool is active.
     *
     * @param {CustomEvent} event
     */
    RectangleTool.prototype.onKeyDown = function (event) {
        var flux = this.getFlux(),
            toolStore = flux.store("tool"),
            detail = event.detail;

        if (detail.keyChar === utilShortcuts.GLOBAL.TOOLS.SHAPE && detail.modifiers.shift) {
            flux.actions.tools.select(toolStore.getToolByID("ellipse"));
        }
    };

    RectangleTool.prototype.toolMode = toolLib.shapeVectorTool;

    module.exports = RectangleTool;
});
