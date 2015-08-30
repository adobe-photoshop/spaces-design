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
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy,
        TypeTool = require("../type");

    /**
     * Handler for updateTextProperties events, which are emitted turing modal
     * text editing.
     *
     * @private
     * @type {?function}
     */
    var _typeChangedHandler;

    /**
     * Re-activates the select tool when exiting the modal tool state.
     *
     * @private
     * @type {?function}
     */
    var _toolModalStateChangedHandler;

    /**
     * Resets the tool to select after the modal tool state is committed, and listens
     * for updated text properties while in the modal state.
     *
     * @private
     */
    var _selectHandler = function () {
        if (_toolModalStateChangedHandler) {
            descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);
        }
        _toolModalStateChangedHandler = function (event) {
            if (event.kind._value === "tool" && event.tool.ID === "txBx" &&
                event.state._value === "exit") {
                var flux = this.flux,
                    toolStore = flux.store("tool");

                flux.actions.tools.select(toolStore.getToolByID("newSelect"));
            }
        }.bind(this);
        descriptor.addListener("toolModalStateChanged", _toolModalStateChangedHandler);

        if (_typeChangedHandler) {
            descriptor.removeListener("updateTextProperties", _typeChangedHandler);
        }
        _typeChangedHandler = TypeTool.updateTextPropertiesHandler.bind(this);
        descriptor.addListener("updateTextProperties", _typeChangedHandler);
    };

    /**
     * Removes event listeners installed on activation.
     *
     * @private
     */
    var _deselectHandler = function () {
        descriptor.removeListener("updateTextProperties", _typeChangedHandler);
        descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);

        _typeChangedHandler = null;
        _toolModalStateChangedHandler = null;
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
        this.deselectHandler = _deselectHandler;
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
            flux.actions.tools.select(toolStore.getToolByID("newSelect"));
        }
    };

    module.exports = SuperSelectTypeTool;
});
