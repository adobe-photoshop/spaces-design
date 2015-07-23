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

    var system = require("js/util/system"),
        os = require("adapter/os"),
        _ = require("lodash");

    /**
     * Convert a set of semantic key modifers to a sequence of bits, suitable
     * for processing by the adapter. Throws an error if a modifier is used
     * that is unsupported for the platform.
     *
     * @see os.eventModifiers
     * @param {{shift: boolean, control: boolean, alt: boolean, option: boolean, command: boolean}} modifiers
     * @return {number} A bit sequence encoded as a number
     */
    var modifiersToBits = function (modifiers) {
        var modifierBits = os.eventModifiers.NONE;

        if (modifiers.shift) {
            modifierBits += os.eventModifiers.SHIFT;
        }

        if (modifiers.control) {
            modifierBits += os.eventModifiers.CONTROL;
        }

        if (modifiers.alt || modifiers.option) {
            modifierBits += os.eventModifiers.ALT;
        }

        if (modifiers.command) {
            if (!system.isMac) {
                throw new Error("Command is only a supported modifier on Mac");
            }

            modifierBits += os.eventModifiers.COMMAND;
        }

        return modifierBits;
    };

    /**
     * Convert a sequence of event modifier bits encoded as a number
     * into a semantic set of modifiers.
     *
     * @param {number} modifierBits
     * @return {{shift: boolean, control: boolean, alt: boolean, command: boolean}}
     */
    var bitsToModifiers = function (modifierBits) {
        /* jshint bitwise: false*/
        var hasShift = !!(modifierBits & os.eventModifiers.SHIFT),
            hasControl = !!(modifierBits & os.eventModifiers.CONTROL),
            hasAlt = !!(modifierBits & os.eventModifiers.ALT),
            hasCommand = !!(modifierBits & os.eventModifiers.COMMAND);
        /* jshint bitwise: true*/

        var modifiers = {
            shift: hasShift,
            control: hasControl,
            alt: hasAlt,
            command: hasCommand
        };

        return modifiers;
    };

    /**
     * Build table of key codes mapped to readable strings
     *
     * @return {object}
     */
    var _getKeyCodeTable = function () {
        var codes = os.eventKeyCode,
            table = {};

        _.forEach(Object.keys(codes), function (keyCode) {
            var value = keyCode,
                words = keyCode.split("_");

            if (keyCode.indexOf("KEY") === 0) {
                // F1 through F12
                value = words[1];
            } else if (keyCode.indexOf("WIN") === 0) {
                value = "Windows";
            } else {
                value = _.reduce(words, function (formatted, word) {
                    return formatted += word.charAt(0) + word.slice(1).toLowerCase() + " ";
                }, "");
            }
            table[codes[keyCode]] = value.trim();
        });
        return table;
    };

    /*
     * @type {object}
    */
    var keyCodeTable = _getKeyCodeTable();
    
    /**
     * Gets readable string corresponding with keycode
     *
     * @param {number} keyCode A key code from os.eventKeyCode
     * @return {string}
     */
    var getKeyCodeString = function (keyCode) {
        return keyCodeTable[keyCode];
    };

    exports.modifiersToBits = modifiersToBits;
    exports.bitsToModifiers = bitsToModifiers;
    exports.getKeyCodeString = getKeyCodeString;
});
