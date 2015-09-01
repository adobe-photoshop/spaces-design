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

define(function (require, exports) {
    "use strict";

    var util = require("adapter/util"),
        keyutil = require("js/util/key");

    /**
     * @constructor
     * @param {!number} action
     * @param {!number} eventKind
     * @param {{shift: boolean, control: boolean, alt: boolean, command: boolean}=} modifiers
     */
    var BaseEventPolicy = function (action, eventKind, modifiers) {
        this.action = action;
        this.eventKind = eventKind;

        if (modifiers) {
            this.modifiers = keyutil.modifiersToBits(modifiers);
        }
    };

    /**
     * @type {number}
     */
    BaseEventPolicy.prototype.action = null;

    /**
     * @type {number}
     */
    BaseEventPolicy.prototype.event = null;

    /**
     * @type {Array.<number>=}
     */
    BaseEventPolicy.prototype.modifiers = null;

    /**
     * Returns a JSONifiable object representation of this policy that omits
     * null properties.
     * 
     * @return {object}
     */
    BaseEventPolicy.prototype.toJSONObject = function () {
        return Object.keys(this).reduce(function (obj, key) {
            var value = this[key];
            if (value !== null) {
                obj[key] = value;
            }
            return obj;
        }.bind(this), {});
    };

    /**
     * @constructor
     * @param {!number} action
     * @param {!number} event
     * @param {{shift: boolean, control: boolean, alt: boolean, command: boolean}=} modifiers
     * @param {number=|string=} key
     */
    var KeyboardEventPolicy = function (action, event, modifiers, key) {
        BaseEventPolicy.call(this, action, event, modifiers);

        switch (typeof key) {
        case "number":
            this.keyCode = key;
            break;
        case "string":
            this.keyChar = key;
            break;
        default:
            throw new Error("Missing key specification");
        }
    };
    util.inherits(KeyboardEventPolicy, BaseEventPolicy);

    /**
     * @type {number=}
     */
    KeyboardEventPolicy.prototype.keyCode = null;

    /**
     * @constructor
     * @param {!number} action
     * @param {!number} event
     * @param {{shift: boolean, control: boolean, alt: boolean, command: boolean}=} modifiers
     * @param {{x: number, y: number, width: number, height: number}=} area
     */
    var PointerEventPolicy = function (action, event, modifiers, area) {
        BaseEventPolicy.call(this, action, event, modifiers);
 
        if (area) {
            this.area = [area.x, area.y, area.width, area.height];
        }
    };
    util.inherits(PointerEventPolicy, BaseEventPolicy);

    /**
     * @type {{x: number, y: number, width: number, height: number}=}
     */
    PointerEventPolicy.prototype.area = null;

    exports.KeyboardEventPolicy = KeyboardEventPolicy;
    exports.PointerEventPolicy = PointerEventPolicy;
});
