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
        os = require("adapter/os");

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

        if (modifiers.alt) {
            if (system.isMac) {
                throw new Error("Alt is not a supported modifier on Mac");
            }

            modifierBits += os.eventModifiers.ALT;
        } else if (modifiers.option) {
            if (!system.isMac) {
                throw new Error("Option is only a supported modifier on Mac");
            }

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
        var hasShift = (modifierBits & os.eventModifiers.SHIFT) === 1,
            hasControl = (modifierBits & os.eventModifiers.CONTROL) === 1,
            hasAlt = (modifierBits & os.eventModifiers.ALT) === 1,
            hasCommand = (modifierBits & os.eventModifiers.COMMAND) === 1;
        /* jshint bitwise: true*/

        var modifiers = {
            shift: hasShift,
            control: hasControl,
            command: hasCommand
        };

        if (system.isMac) {
            modifiers.option = hasAlt;
        } else {
            modifiers.alt = hasAlt;
        }

        return modifiers;
    };

    exports.modifiersToBits = modifiersToBits;
    exports.bitsToModifiers = bitsToModifiers;
});
