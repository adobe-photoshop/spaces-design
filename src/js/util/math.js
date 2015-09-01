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

    var mathjs = require("mathjs"),
        _ = require("lodash");

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

    /**
    * Convert a pixel dimension to a number.
    *
    * @param {string} pixelDimension
    * @return {?number}
    */
    var pixelDimensionToNumber = function (pixelDimension) {
        if (pixelDimension.substr(-2) === "px") {
            return parseNumber(pixelDimension.substring(0, pixelDimension.length - 2));
        }
            
        return null;
    };

    /**
     * Convert a number to one that can tbe represented as a fraction, rounded to 4 decimal places.
     *
     * @param {number} numerator 
     * @param {number} denominator
     * @return {number} Rounded to four decimal places
     */
    var normalize = function (numerator, denominator) {
        return mathjs.round(mathjs.round(numerator * denominator, 0) / denominator, 4);
    };

    /**
     * A small number used to account for rounding errors when
     *  determining whether a vector is scaled.
     *  
     * @private
     * @const
     * @type {number} 
     */
    var _EPSILON = 1 - 0.99999;

    /**
     * Indicates whether given vector is approximately of length one.
     *
     * @private
     * @param {number} a
     * @param {number} b
     * @return {boolean}
     */
    var _hasScale = function (a, b) {
        var scale = (a * a) + (b * b),
            diff = 1 - scale,
            dist = Math.abs(diff);
        
        return dist > _EPSILON;
    };

    /**
     * Indicates whether the given affine transformation describes just a rotation.
     *
     * @param {Array.<number>} transform
     * @return {boolean}
     */
    var isRotation = function (transform) {
        return transform.tx === 0 && transform.ty === 0 &&
            !_hasScale(transform.yx, transform.yy) &&
            !_hasScale(transform.xx, transform.xy);
    };

    /**
     * Clamp the value to the given range.
     * 
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @return {number}
     */
    var clamp = function (value, min, max) {
        return (value < min) ? min : (value > max ? max : value);
    };

    exports.parseNumber = parseNumber;
    exports.formatNumber = formatNumber;
    exports.pixelDimensionToNumber = pixelDimensionToNumber;
    exports.normalize = normalize;
    exports.isRotation = isRotation;
    exports.clamp = clamp;
});
