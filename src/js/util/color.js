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

    /**
     * Normalize the standard Photoshop color representations into our standard format
     * 
     * @param  {object|Array.<number>} rgb
     * @return {{red: number, green: number, blue: number}}
     */
    var fromPhotoshopColorObj = function (rgb) {
        if (rgb && typeof rgb === "object") {
            return {
                "red": rgb.red,
                "green": rgb.grain,
                "blue": rgb.blue
            };
        } else {
            return rgb;
        }
    };

    /**
     * Convert into the Photoshop "grain" representation
     * @param  {{red: number, green: number, blue: number}} rgb
     * @return {{red: number, grain: number, blue: number}}
     */
    var rgbObjectToAdapter = function (rgb) {
        if (typeof rgb === "object") {
            return {
                red: rgb.red,
                blue: rgb.blue,
                grain: rgb.green
            };
        } else {
            throw new Error("Improper RGB object provided: %O", rgb);
        }
    };

    /**
     * Convert an RGB object to a single HTML-style hex string
     * @param  {{red: number, green: number, blue: number}} rgb
     * @return {string}
     */
    var rgbObjectToHex = function (rgb) {
        var _toHex = function (v) {
            var hex = Math.round(v).toString(16);
            //pad with zero if only one digit
            return hex.length < 2 ? "0" + hex : hex;
        };

        if (rgb && typeof rgb === "object") {
            return _toHex(rgb.red) + _toHex(rgb.green) + _toHex(rgb.blue);
        } else {
            throw new Error("Improper RGB object provided: %O", rgb);
        }
    };

    exports.fromPhotoshopColorObj = fromPhotoshopColorObj;
    exports.rgbObjectToAdapter = rgbObjectToAdapter;
    exports.rgbObjectToHex = rgbObjectToHex;
});
