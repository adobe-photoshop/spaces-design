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
        descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool");
        
    var Tool = require("js/models/tool"),
        shortcuts = require("js/actions/shortcuts"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy;

    var _TOGGLE_TARGET_PATH = 3502,
        _CLEAR_PATH = 106;

    /**
     * Updates current document because we may have changed bounds in Photoshop
     * @private
     */
    var _deselectHandler = function () {
        var currentDocument = this.flux.store("application").getCurrentDocument();

        var targetPathsPromise = UI.setSuppressTargetPaths(true),
            backspacePromise = this.transfer(shortcuts.removeShortcut, "vectorBackspace"),
            deletePromise = this.transfer(shortcuts.removeShortcut, "vectorDelete");

        return Promise.join(targetPathsPromise, backspacePromise, deletePromise)
            .bind(this)
            .then(function () {
                if (currentDocument) {
                    this.flux.actions.layers.resetLayers(currentDocument, currentDocument.layers.selected);
                }
            });
    };

    /**
     * Sets the selection mode to only active layers for direct select tool
     * @private
     */
    var _selectHandler = function () {
        var deleteFn = function (event) {
            event.stopPropagation();

            return PS.performMenuCommand(_CLEAR_PATH)
                .catch(function () {
                    // Silence the errors here
                });
        };
        
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

    /**
     * @implements {Tool}
     * @constructor
     */
    var SuperSelectVectorTool = function () {
        Tool.call(this, "superselectVector", "Superselect - Direct Select", "directSelectTool");
        this.icon = "directSelect";
        this.isMainTool = false;

        var escapeKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ESCAPE),
            enterKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ENTER),
            backspaceKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.BACKSPACE),
            deleteKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.DELETE),
            arrowLeftPolicy = new KeyboardEventPolicy(UI.policyAction.ALWAYS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_LEFT),
            arrowUpPolicy = new KeyboardEventPolicy(UI.policyAction.ALWAYS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_UP),
            arrowRightPolicy = new KeyboardEventPolicy(UI.policyAction.ALWAYS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_RIGHT),
            arrowDownPolicy = new KeyboardEventPolicy(UI.policyAction.ALWAYS_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_DOWN);
            
            
        this.keyboardPolicyList = [
            escapeKeyPolicy, // Switch back to newSelect
            enterKeyPolicy, // Switch back to newSelect
            backspaceKeyPolicy, // Delete selected vertices
            deleteKeyPolicy, // Delete selected vertices
            arrowLeftPolicy, // We want all arrow keys to go into Photoshop in vector edit mode
            arrowDownPolicy,
            arrowRightPolicy,
            arrowUpPolicy
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

        var detail = event.detail;
        if (detail.keyCode === 27) { // Escape
            flux.actions.tools.select(toolStore.getToolByID("newSelect"));
        } else if (detail.keyCode === 13) { // Enter
            flux.actions.tools.select(toolStore.getToolByID("newSelect"));
        }
    };

    module.exports = SuperSelectVectorTool;
});
