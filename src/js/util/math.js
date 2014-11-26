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

    var _ = require("lodash");

    /**
     * Returns the number represented by the provided string, or null if there
     * is no such number.
     * 
     * @param {!string} value
     * @return {?number}
     */
    var parseNumber = function (value) {
        if (/^(\-|\+)?(\d+|\d*\.\d+|Infinity)$/.test(value)) {
            return Number(value);
        }

        return null;
    };

    /**
     * Return a string representation of a (finite) number, or some default
     * representation if the supplied value is not a finite number. If no
     * default is supplied, the empty string is used as a default representation.
     * 
     * @param {!number} value
     * @param {string=} defaultRep
     * @return {!string}
     */
    var formatNumber = function (value, defaultRep) {
        if (_.isFinite(value)) {
            return value.toString();
        } else {
            if (typeof defaultRep === "string") {
                return defaultRep;
            } else {
                return "";
            }
        }
    };

    exports.parseNumber = parseNumber;
    exports.formatNumber = formatNumber;
});
