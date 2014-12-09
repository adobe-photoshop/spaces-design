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
        PS = require("adapter/ps"),
        OS = require("adapter/os"),
        UI = require("adapter/ps/ui"),
        descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool");
        
    var Tool = require("js/models/tool"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy;

    var _SHOW_TARGET_PATH = 3502,
        _SHOW_NO_OVERLAYS = 3508;

    /**
     * Updates current document because we may have changed bounds in Photoshop
     * @private
     */
    var _deselectHandler = function () {
        return PS.performMenuCommand(_SHOW_NO_OVERLAYS)
            .bind(this)
            .then(function () {
                this.flux.actions.documents.updateCurrentDocument();
            });
    };

    /**
     * Sets the selection mode to only active layers for direct select tool
     * @private
     */
    var _selectHandler = function () {
        return descriptor.playObject(toolLib.setDirectSelectOptionForAllLayers(false))
            .then(function () {
                return PS.performMenuCommand(_SHOW_TARGET_PATH);
            });
    };

    /**
     * @implements {Tool}
     * @constructor
     */
    var SuperSelectVectorTool = function () {
        Tool.call(this, "superselectVector", "Superselect - Direct Select", "directSelectTool");
        this.icon = "directSelect";

        var escapeKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ESCAPE),
            enterKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ENTER),
            backspaceKeyPolicy = new KeyboardEventPolicy(UI.policyAction.ALWAYS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.BACKSPACE),
            deleteKeyPolicy = new KeyboardEventPolicy(UI.policyAction.ALWAYS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.DELETE);

        this.keyboardPolicyList = [
            escapeKeyPolicy, // Switch back to newSelect
            enterKeyPolicy, // Switch back to newSelect
            backspaceKeyPolicy, // Delete selected vertices (Handled by PS)
            deleteKeyPolicy // Delete selected vertices (Handled by PS)
        ];

        this.selectHandler = _selectHandler;
        this.deselectHandler = _deselectHandler;
    };
    util.inherits(SuperSelectVectorTool, Tool);


    /**
     * Handler for key down events
     * Enter and escape switches back to super select tool
     * 
     * @param  {KeyboardEvent} event
     */
    SuperSelectVectorTool.prototype.onKeyDown = function (event) {
        var flux = this.getFlux(),
            toolStore = flux.store("tool");

        if (event.keyCode === 27) { // Escape
            flux.actions.tools.select(toolStore.getToolByID("newSelect"));
        } else if (event.keyCode === 13) { // Enter
            flux.actions.tools.select(toolStore.getToolByID("newSelect"));
        }
    };

    module.exports = SuperSelectVectorTool;
});
