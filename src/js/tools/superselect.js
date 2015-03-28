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

    /**
     * Failsafe check for pointer policy list
     * So we don't mistakenly remove default policies
     */
    var _initialPointerPolicyListLength;

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
        
        var selectHandler = function (tool) {
            var toolOptions = {
                "$AtSl": false, // Auto select on drag
                "$ASGr": false, // Auto select Groups,
                "$Abbx": false // Don't show transform controls
            };

            var centerOffsets = this.flux.store("ui").getState().centerOffsets,
                panelWidth = centerOffsets ? centerOffsets.right : 0,
                scrimArea = {
                    x: 0,
                    y: 0,
                    width: document.body.clientWidth - panelWidth,
                    height: document.body.clientHeight
                };

            var scrimScrollPolicy = new PointerEventPolicy(UI.policyAction.ALWAYS_PROPAGATE,
                    OS.eventKind.MOUSE_WHEEL, null, scrimArea);

            tool.pointerPolicyList.push(scrimScrollPolicy);
                    
            return descriptor.playObject(toolLib.setToolOptions("moveTool", toolOptions))
                .then(function () {
                    UI.setPointerPropagationMode({
                        defaultMode: UI.pointerPropagationMode.NEVER_PROPAGATE
                    });
                });
        };

        var deselectHandler = function (tool) {
            // If for some reason we've come here and we only have the default policies installed,
            // we shouldn't alter the pointer policy list
            if (tool.pointerPolicyList.length > _initialPointerPolicyListLength) {
                tool.pointerPolicyList.pop();
            }
            
            return UI.setPointerPropagationMode({
                defaultMode: UI.pointerPropagationMode.ALPHA_PROPAGATE
            });
        };

        this.selectHandler = selectHandler;
        this.deselectHandler = deselectHandler;

        var escapeKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ESCAPE),
            tabKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.TAB),
            enterKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ENTER),
            arrowUpKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_UP),
            arrowDownKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_DOWN),
            arrowLeftKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_LEFT),
            arrowRightKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_RIGHT);

        this.keyboardPolicyList = [
            escapeKeyPolicy,
            tabKeyPolicy,
            enterKeyPolicy,
            arrowUpKeyPolicy,
            arrowDownKeyPolicy,
            arrowLeftKeyPolicy,
            arrowRightKeyPolicy
        ];

        var pointerPolicy = new PointerEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.LEFT_MOUSE_DOWN);
        this.pointerPolicyList = [pointerPolicy];

        _initialPointerPolicyListLength = this.pointerPolicyList.length;

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
        // We don't want to handle right or middle clicks!
        if (event.button !== 0) {
            return;
        }

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
        case OS.eventKeyCode.ESCAPE: // Escape
            var dontDeselectAll = system.isMac ? detail.modifiers.alt : detail.modifiers.shift;
            flux.actions.superselect.backOut(currentDocument, dontDeselectAll);
            break;
        case OS.eventKeyCode.TAB: // Tab
            var cycleBack = detail.modifiers.shift;
            flux.actions.superselect.nextSibling(currentDocument, cycleBack);
            break;
        case OS.eventKeyCode.ENTER: // Enter
            flux.actions.superselect.diveIn(currentDocument);
            break;
        case OS.eventKeyCode.ARROW_UP:
        case OS.eventKeyCode.ARROW_DOWN:
        case OS.eventKeyCode.ARROW_LEFT:
        case OS.eventKeyCode.ARROW_RIGHT:
            var bigStep = detail.modifiers.shift,
                selected = currentDocument.layers.selected;
            flux.actions.transform.nudgeLayersDebounced(currentDocument, selected, detail.keyCode, bigStep);
            break;
        }
    };

    SuperSelectTool.prototype.toolOverlay = SuperselectOverlay;

    module.exports = SuperSelectTool;
});
