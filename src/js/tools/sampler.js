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

    var OS = require("adapter/os"),
        UI = require("adapter/ps/ui"),
        util = require("adapter/util");

    var events = require("js/events"),
        Tool = require("js/models/tool"),
        EventPolicy = require("js/models/eventpolicy"),
        PointerEventPolicy = EventPolicy.PointerEventPolicy,
        SamplerOverlay = require("jsx!js/jsx/tools/SamplerOverlay"),
        shortcuts = require("js/util/shortcuts");

    /**
     * Used by sampler HUD, we listen to OS notifications to update the locations
     */
    var _currentMouseX,
        _currentMouseY;

    /** @ignore */
    var _mouseMoveHandler = function (event) {
        _currentMouseX = event.location[0];
        _currentMouseY = event.location[1];
    };

    /**
     * @implements {Tool}
     * @constructor
     */
    var SamplerTool = function () {
        Tool.call(this, "sampler", "Sampler", "eyedropperTool");

        this.icon = "eyedropper";
        this.activationKey = shortcuts.GLOBAL.TOOLS.SAMPLER;

        var selectHandler = function () {
            OS.addListener("externalMouseMove", _mouseMoveHandler);

            return UI.setPointerPropagationMode({
                defaultMode: UI.pointerPropagationMode.ALPHA_PROPAGATE_WITH_NOTIFY
            });
        };

        var deselectHandler = function () {
            OS.removeListener("externalMouseMove", _mouseMoveHandler);

            return this.dispatchAsync(events.style.HIDE_HUD)
                .then(function () {
                    return UI.setPointerPropagationMode({
                        defaultMode: UI.pointerPropagationMode.ALPHA_PROPAGATE
                    });
                });
        };

        this.selectHandler = selectHandler;
        this.deselectHandler = deselectHandler;

        var pointerPolicy = new PointerEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.LEFT_MOUSE_DOWN);
        this.pointerPolicyList = [
            pointerPolicy
        ];
    };
    util.inherits(SamplerTool, Tool);

    /** @ignore */
    SamplerTool.prototype.onClick = function (event) {
        var flux = this.getFlux(),
            applicationStore = flux.store("application"),
            styleStore = flux.store("style"),
            currentDocument = applicationStore.getCurrentDocument();
        
        if (!currentDocument) {
            return;
        }

        if (styleStore.getHUDStyles() !== null) {
            flux.actions.sampler.hideHUD();
        } else {
            flux.actions.sampler.click(currentDocument, event.pageX, event.pageY, event.shiftKey);
        }
    };

    /**
     * Handler for keydown events, installed when the tool is active.
     *
     * @param {CustomEvent} event
     */
    SamplerTool.prototype.onKeyDown = function (event) {
        var flux = this.getFlux(),
            applicationStore = flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();
            
        if (event.detail.keyChar === " ") {
            flux.actions.sampler.showHUD(currentDocument, _currentMouseX, _currentMouseY);
        } else if (event.detail.keyCode === OS.eventKeyCode.ESCAPE) {
            flux.actions.sampler.hideHUD();
        }
    };

    SamplerTool.prototype.toolOverlay = SamplerOverlay;

    module.exports = SamplerTool;
});
