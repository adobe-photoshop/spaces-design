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

    var _ = require("lodash");

    /**
     * Models a logical tool.
     * 
     * @constructor
     * @param {number} id
     * @param {!string} name
     * @param {!string} nativeToolName
     * @param {object=} nativeToolOptions
     * @param {Array.<KeyboardEventPolicy>=} keyboardPolicyList
     * @param {Array.<PointerEventPolicy>=} pointerPolicyList
     * @param {function()=} onSelect
     * @param {function()=} onDeselect
     */
    var Tool = function (id, name, nativeToolName, nativeToolOptions,
            keyboardPolicyList, pointerPolicyList, onSelect, onDeselect) {
        this.id = id;
        this.name = name;
        this.nativeToolName = nativeToolName;
        this.nativeToolOptions = nativeToolOptions || null;
        this.keyboardPolicyList = keyboardPolicyList || [];
        this.pointerPolicyList = pointerPolicyList || [];
        this.onSelect = onSelect || _.identity;
        this.onDeselect = onDeselect || _.identity;
    };

    /**
     * @type {number}
     */
    Tool.prototype.id = null;

    /**
     * Human-readable tool name
     * @type {!name}
     */
    Tool.prototype.name = null;

    /**
     * Photoshop tool name
     * @type {!string}
     */
    Tool.prototype.nativeToolName = null;

    /**
     * Photoshop tool options
     * @type {!PlayObject}
     */
    Tool.prototype.nativeToolOptions = null;

    /**
     * Keyboard event policies that must be installed for this tool
     * @type {!Array.<KeyboardEventPolicy>}
     */
    Tool.prototype.keyboardPolicy = null;

    /**
     * Pointer event policies that must be installed for this tool
     * @type {!Array.<KeyboardEventPolicy>}
     */
    Tool.prototype.pointerPolicy = null;

    /**
     * Function called when the tool is selected. If this function returns a
     * promise, then tool selection will not be considered to have finished until
     * that promise resolves.
     *
     * @type {function(Fluxxor.Flux):?Promise}
     */
    Tool.prototype.onSelect = null;

    /**
     * Function called when the tool is deselected. If this function returns a
     * promise, tool deselection will not be considered complete (and hence
     * blocking selection of the next tool) until it resolves
     * 
     * @type {function(Fluxxor.Flux):?Promise}
     */
    Tool.prototype.onDeselect = null;

    module.exports = Tool;
});
