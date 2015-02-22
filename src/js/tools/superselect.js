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
        PS = require("adapter/ps"),
        system = require("js/util/system"),
        UI = require("adapter/ps/ui"),
        toolLib = require("adapter/lib/tool"),
        Tool = require("js/models/tool"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy,
        PointerEventPolicy = EventPolicy.PointerEventPolicy;

    var VectorTool = require("./superselect/vector"),
        TypeTool = require("./superselect/type");

    var _ = require("lodash");

    var SuperselectOverlay = require("jsx!js/jsx/tools/SuperselectOverlay");

    // This command disables all guides / layer bounds etc PS draws.
    var SHOW_NO_OVERLAYS = 3508;

    /**
     * @implements {Tool}
     * @constructor
     */
    var SuperSelectTool = function () {
        this.id = "newSelect";
        this.icon = "newSelect";
        this.name = "Super Select";
        this.nativeToolName = "moveTool";
        this.dragging = false;
        this.dragEvent = null;
        this.activationKey = "v";
        
        var selectHandler = function () {
            var toolOptions = {
                "$AtSl": false, // Auto select on drag
                "$ASGr": false, // Auto select Groups,
                "$Abbx": false // Don't show transform controls
            };
            
            return descriptor.playObject(toolLib.setToolOptions("moveTool", toolOptions))
                .then(function () {
                    return PS.performMenuCommand(SHOW_NO_OVERLAYS);
                });
        };

        this.selectHandler = selectHandler;

        var escapeKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ESCAPE),
            tabKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.TAB),
            enterKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ENTER);
        this.keyboardPolicyList = [escapeKeyPolicy, tabKeyPolicy, enterKeyPolicy];

        var pointerPolicy = new PointerEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.LEFT_MOUSE_DOWN);
        this.pointerPolicyList = [pointerPolicy];

        this.subToolList = [
            new VectorTool(),
            new TypeTool()
        ];
    };
    util.inherits(SuperSelectTool, Tool);

    /**
     * Handler for mouse down events, installed when the tool is active.
     * 
     * @param {SyntheticEvent} event
     */
    SuperSelectTool.prototype.onMouseDown = function (event) {
        this.dragging = true;
        this.dragEvent = _.clone(event);
    };

    /**
     * Handler for mouse up, turns off dragging
     * 
     * @param {SyntheticEvent} event
     */
    SuperSelectTool.prototype.onMouseUp = function (event) {
        var flux = this.getFlux(),
            applicationStore = flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            mouseDownFlag = !!this.dragEvent,
            diveIn = false;

        if (mouseDownFlag) {
            diveIn = system.isMac ? this.dragEvent.metaKey : this.dragEvent.ctrlKey;
        }

        // Clean up even if we're canceling out
        this.dragging = false;
        this.dragEvent = null;
        
        // if dragEvent is null, mouse down was not hit, so we shouldn't try to click
        if (!currentDocument || !mouseDownFlag) {
            return;
        }
        
        flux.actions.superselect.click(currentDocument, event.pageX, event.pageY, diveIn, event.shiftKey);
    };

    /**
     * Handler for mouse move, sends a click to Photoshop at mouse down location
     */
    SuperSelectTool.prototype.onMouseMove = function () {
        if (!this.dragging) {
            return;
        }
        this.dragging = false;
        
        var flux = this.getFlux(),
            applicationStore = flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return;
        }

        var dragEvent = this.dragEvent,
            modifiers = {
                option: dragEvent.altKey,
                command: dragEvent.metaKey,
                shift: dragEvent.shiftKey,
                control: dragEvent.ctrlKey
            };

        // Since we don't get the mouse up after we start dragging in PS, we need to reset the event here
        this.dragEvent = null;
        flux.actions.superselect.drag(currentDocument, dragEvent.pageX, dragEvent.pageY, modifiers);
    };

    SuperSelectTool.prototype.onClick = function (event) {
        // Prevents clicks from reaching the window and dismissing onWindowClick dialogs
        event.stopPropagation();
    };

    /**
     * Handler for mouse click events, installed when the tool is active.
     *
     * @param {SyntheticEvent} event
     */
    SuperSelectTool.prototype.onDoubleClick = function (event) {
        var flux = this.getFlux(),
            applicationStore = flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return;
        }

        flux.actions.superselect.doubleClick(currentDocument, event.pageX, event.pageY);
    };



    /**
     * Handler for keydown events, installed when the tool is active.
     *
     * @todo  Fix this after keyboard policies are more in place
     * @param {CustomEvent} event
     */
    SuperSelectTool.prototype.onKeyDown = function (event) {
        var flux = this.getFlux(),
            applicationStore = flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return;
        }

        var detail = event.detail;
        switch (detail.keyCode) {
        case 27: // Escape
            var dontDeselectAll = system.isMac ? detail.modifiers.alt : detail.modifiers.shift;
            flux.actions.superselect.backOut(currentDocument, dontDeselectAll);
            break;
        case 9: // Tab
            var cycleBack = detail.modifiers.shift;
            flux.actions.superselect.nextSibling(currentDocument, cycleBack);
            break;
        case 13: // Enter
            flux.actions.superselect.diveIn(currentDocument);
            break;
        }
    };

    SuperSelectTool.prototype.toolOverlay = SuperselectOverlay;

    module.exports = SuperSelectTool;
});
