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

    var mathjs = require("mathjs");

    /**
     * Normalize the Photoshop color representation into our standard format
     * 
     * @param {{red: number, grain: number, blue: number}} rgb
     * @param {number} opacityPercentage optional opacity as a percentage [0,100]
     * @return {{r: number, g: number, b: number, a: number}}
     */
    var fromPhotoshopColorObj = function (rgb, opacityPercentage) {
        return {
            "r": rgb.red,
            "g": rgb.grain,
            "b": rgb.blue,
            "a": opacityPercentage ? mathjs.round(opacityPercentage / 100, 4) : 1
        };
    };

    /**
     * Given a color, return the opacity rounded to a value that can be represented as a fraction of 255
     *
     * @param {{r: number, g: number, b: number, a: number}} color
     *
     * @return {{r: number, g: number, b: number, a: number}} where alpha value is appropriately rounded
     */
    var normalizeColorAlpha = function (color) {
        color.a = normalizeAlpha(color.a);
        return color;
    };

    /**
     * Convert an opacity value to one that can tbe represented as a fraction of 255, rounded to 4 decimal places
     *
     * @param {number} opacity opacity value [0,1]
     *
     * @return {number} [0,1] rounded to four decimal places
     */
    var normalizeAlpha = function (opacity) {
        return mathjs.round(mathjs.round(opacity * 255, 0) / 255, 4);
    };

    /**
     * Clone the given color with the given opacity value.
     * 
     * @param {Color} color
     * @param {number} opacityPercentage In the range [0, 100]
     * @return {Color}
     */
    var withAlpha = function (color, opacityPercentage) {
        return {
            r: color.r,
            g: color.g,
            b: color.b,
            a: mathjs.round(opacityPercentage / 100, 4)
        };
    };

    /**
     * Create an opaque copy of the given color.
     *
     * @param {Color} color
     * @return {Color}
     */
    var opaque = function (color) {
        return withAlpha(color, 100);
    };

    exports.fromPhotoshopColorObj = fromPhotoshopColorObj;
    exports.normalizeColorAlpha = normalizeColorAlpha;
    exports.normalizeAlpha = normalizeAlpha;
    exports.withAlpha = withAlpha;
    exports.opaque = opaque;
});
