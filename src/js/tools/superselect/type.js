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

    var util = require("adapter/util"),
        descriptor = require("adapter/ps/descriptor"),
        OS = require("adapter/os"),
        UI = require("adapter/ps/ui");
        
    var Tool = require("js/models/tool"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy;


    var _selectHandler = function () {
        var flux = this.flux,
            controller = this.controller,
            toolStore = flux.store("tool");

        descriptor.once("set", function (event) {
            if (event.null._ref === "textLayer" && event.to._obj === "textLayer" &&
                !controller.isActionActive("tools.selectTool")) {
                flux.actions.tools.selectTool(toolStore.getToolByID("newSelect"));
            }
        });
    };

    /**
     * @implements {Tool}
     * @constructor
     */
    var SuperSelectTypeTool = function () {
        Tool.call(this, "superselectType", "Superselect-Type", "typeCreateOrEditTool");
        this.icon = "typeCreateOrEdit";

        var escapeKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ESCAPE);
        this.keyboardPolicyList = [escapeKeyPolicy];
        this.selectHandler = _selectHandler;
        this.isMainTool = false;
    };
    util.inherits(SuperSelectTypeTool, Tool);

    /**
     * Handler for key down events
     * Escape switches back to super select tool
     * 
     * @param  {KeyboardEvent} event
     */
    SuperSelectTypeTool.prototype.onKeyDown = function (event) {
        var flux = this.getFlux(),
            toolStore = flux.store("tool");

        if (event.detail.keyCode === 27) { // Escape
            flux.actions.tools.selectTool(toolStore.getToolByID("newSelect"));
        }
    };

    module.exports = SuperSelectTypeTool;
});
