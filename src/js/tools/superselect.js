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
        OS = require("adapter/os"),
        UI = require("adapter/ps/ui"),
        toolLib = require("adapter/lib/tool"),
        Tool = require("js/models/tool"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy,
        PointerEventPolicy = EventPolicy.PointerEventPolicy,
        log = require("js/util/log");

    var superSelectClickHandler = function (flux, event) {
        log.debug("Click!", event);
    };

    var superSelectKeypressHandler = function (flux, event) {
        log.debug("Keypress!", event);
    };

    /**
     * @implements {Tool}
     * @constructor
     */
    var SuperSelectTool = function () {
        this.id = "newSelect";
        this.name = "Super Select";
        this.nativeToolName = "directSelectTool";
        this.nativeToolOptions = toolLib.setDirectSelectOptionForAllLayers(true);

        var keyboardPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ESCAPE);
        this.keyboardPolicyList = [keyboardPolicy];

        var pointerPolicy = new PointerEventPolicy(UI.policyAction.NEVER_PROPAGATE,
                OS.eventKind.LEFT_MOUSE_DOWN);
        this.pointerPolicyList = [pointerPolicy];
    };
    util.inherits(SuperSelectTool, Tool);

    /**
     * Note: ideally this parameter would be bound at instantiation time, but for
     * some reason the Fluxxor object isn't available at store intialization time,
     * which is when these objects are instantiated.
     * 
     * @override Tool.prototype.onSelect
     * @param {Fluxxor.Flux} flux
     */
    SuperSelectTool.prototype.onSelect = function (flux) {
        this._handleSuperSelectClick = superSelectClickHandler.bind(this, flux);
        this._handleSuperSelectKeypress = superSelectKeypressHandler.bind(this, flux);

        window.addEventListener("click", this._handleSuperSelectClick);
        window.addEventListener("keypress", this._handleSuperSelectKeypress);
    };

    /**
     * @override Tool.prototype.onDeselect
     */
    SuperSelectTool.prototype.onDeselect = function () {
        window.removeEventListener("click", this._handleSuperSelectClick);
        window.removeEventListener("keypress", this._handleSuperSelectKeypress);

        this._handleSuperSelectClick = null;
        this._handleSuperSelectKeypress = null;
    };

    module.exports = SuperSelectTool;
});
