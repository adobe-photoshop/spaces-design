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
     * @param {function=} selectHandler
     * @param {function=} deselectHandler
     * @param {Array.<KeyboardEventPolicy>=} keyboardPolicyList
     * @param {Array.<PointerEventPolicy>=} pointerPolicyList
     * @param {Array.<Tool>=} subToolList 
     * @param {boolean} hideTransformOverlay
     */
    var Tool = function (id, name, nativeToolName, selectHandler, deselectHandler,
            keyboardPolicyList, pointerPolicyList, subToolList, hideTransformOverlay) {
        this.id = id;
        this.icon = id;
        this.name = name;
        this.nativeToolName = nativeToolName;
        this.selectHandler = selectHandler || null;
        this.deselectHandler = deselectHandler || null;
        this.keyboardPolicyList = keyboardPolicyList || [];
        this.pointerPolicyList = pointerPolicyList || [];
        this.subToolList = subToolList || [];
        this.hideTransformOverlay = hideTransformOverlay || false;
    };

    /**
     * @type {string}
     */
    Tool.prototype.id = null;

    /**
     * Icon name for the tool
     * @type {string}
     */
    Tool.prototype.icon = null;

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
     * Function to call on select
     * @type {!function}
     */
    Tool.prototype.selectHandler = null;

    /**
     * Function to call upon deselect of this tool
     * @type {!function}
     */
    Tool.prototype.deselectHandler = null;

    /**
     * Keyboard event policies that must be installed for this tool
     * @type {!Array.<KeyboardEventPolicy>}
     */
    Tool.prototype.keyboardPolicyList = null;

    /**
     * Pointer event policies that must be installed for this tool
     * @type {!Array.<KeyboardEventPolicy>}
     */
    Tool.prototype.pointerPolicyList = null;

    /**
     * Other logical tools this tool may use
     * @type {!Array.<Tool>}
     */
    Tool.prototype.subToolList = null;

    /**
     * Optional click event handler.
     * @type {?function(React.Event):boolean}
     */
    Tool.prototype.onClick = null;

    /**
     * Optional double click event handler.
     * @type {?function(React.Event):boolean}
     */
    Tool.prototype.onDoubleClick = null;

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

    /**
     * Pointer to the Tool Overlay class that allows us to draw things on the screen
     * @type {?Object}
     */
    Tool.prototype.toolOverlay = null;

    /**
     * Flag to disable transform controls while this tool is selected
     * @type {?boolean}
     */
    Tool.prototype.disableTransformOveray = null;

    module.exports = Tool;
});
