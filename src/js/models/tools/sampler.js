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

    var OS = require("adapter").os,
        UI = require("adapter").ps.ui,
        util = require("adapter").util;

    var Tool = require("js/models/tool"),
        EventPolicy = require("js/models/eventpolicy"),
        PointerEventPolicy = EventPolicy.PointerEventPolicy,
        SamplerOverlay = require("jsx!js/jsx/tools/SamplerOverlay"),
        shortcuts = require("js/util/shortcuts");

    /**
     * @implements {Tool}
     * @constructor
     */
    var SamplerTool = function () {
        Tool.call(this, "sampler", "Sampler", "eyedropperTool");

        this.icon = "eyedropper";
        this.activationKey = shortcuts.GLOBAL.TOOLS.SAMPLER;

        this.selectHandler = "toolSampler.select";
        this.deselectHandler = "toolSampler.deselect";

        var pointerPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_TO_BROWSER,
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
            
        if (!currentDocument) {
            return;
        }

        if (event.detail.keyChar === " ") {
            var uiStore = flux.store("ui"),
                position = uiStore.getCurrentMousePosition();

            if (!position) {
                return;
            }

            flux.actions.sampler.showHUD(currentDocument, position.currentMouseX, position.currentMouseY);
        } else if (event.detail.keyCode === OS.eventKeyCode.ESCAPE) {
            flux.actions.sampler.hideHUD();
        }
    };

    SamplerTool.prototype.toolOverlay = SamplerOverlay;

    module.exports = SamplerTool;
});
