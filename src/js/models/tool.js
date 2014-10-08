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
     */
    var Tool = function (id, name, nativeToolName, nativeToolOptions,
            keyboardPolicyList, pointerPolicyList) {
        this.id = id;
        this.name = name;
        this.nativeToolName = nativeToolName;
        this.nativeToolOptions = nativeToolOptions || null;
        this.keyboardPolicyList = keyboardPolicyList || [];
        this.pointerPolicyList = pointerPolicyList || [];
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
     * Optional click event handler.
     * @type {?function(React.Event):boolean}
     */
    Tool.prototype.onClick = null;

    /**
     * Optional mousedown event handler.
     * @type {?function(React.Event):boolean}
     */
    Tool.prototype.onMouseDown = null;

    /**
     * Optional keypress event handler.
     * @type {?function(React.Event):boolean}
     */
    Tool.prototype.onKeyPress = null;

    /**
     * Optional keydown event handler.
     * @type {?function(React.Event):boolean}
     */
    Tool.prototype.onKeyDown = null;

    /**
     * Optional tool activation key for a keyboard shortcut.
     * @type {?string}
     */
    Tool.prototype.activationKey = null;

    module.exports = Tool;
});
