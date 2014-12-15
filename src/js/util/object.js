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
     * Search for a deep property in an object guided by a path. For example:
     * 
     * obj = { a: { b: { c: 1 } } }
     * getPath(obj, "a")
     * > { b: { c: 1 } }
     * getPath(obj, "a.b")
     * > { c: 1 }
     * getPath(obj, "a.b.c")
     * > 1
     * getPath(obj, "a.d")
     * > undefined
     *
     * @param {object} obj
     * @param {string} path
     * @return {*} Returns the value found at the path, or undefined.
     */
    var getPath = function (obj, path) {
        if (typeof obj !== "object") {
            return undefined;
        }

        path.split(".").some(function (part) {
            if (obj.hasOwnProperty(part)) {
                obj = obj[part];
            } else {
                obj = undefined;
                return true;
            }
        });

        return obj;
    };

    /**
     * Test if all elements of the array are equal
     *
     * @param {array} array 
     * @param {boolean} deepCompare If true, compare elements using deep comparison.  otherwise use `===`
     *
     * @return {[type]} [description]
     */
    var arrayValuesEqual = function (array, deepCompare) {
        if (!Array.isArray(array)) {
            return false;
        } else if (array.length <= 1) {
            return true;
        } else {
            var firstVal = array[0];
            return array.slice(1).every(function (currentValue) {
                    if (deepCompare) {
                        return _.isEqual(currentValue, firstVal);
                    } else {
                        return currentValue === firstVal;
                    }
                }
            );
        }
    };

    exports.getPath = getPath;
    exports.arrayValuesEqual = arrayValuesEqual;
});
