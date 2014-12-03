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
     * Equality-by-reference predicate.
     * 
     * @param {*} a
     * @param {*} b
     * @return {boolean} True if a and b are equal references
     */
    var _referenceEquality = function (a, b) {
        return a === b;
    };

    /**
     * Extracts a "uniform" value from a list of values, where uniformity is
     * tested using the given equality predicate. If the equality predicate is
     * undefined, reference equality is used. If the list is determined to have
     * a uniform value, the first such value is returned. If not, null is
     * returned.
     * 
     * @param {Array.<*>} values
     * @param {function(*,*):boolean=} equals Optional equality predicate.
     * @param {*} receiver Bound to the predicate
     * @return {*} The first value if the the values are uniform, or null.
     */
    var uniformValue = function (values, equals, receiver) {
        if (!values || values.length === 0) {
            return null;
        }

        var first = values[0];
        if (values.length === 1) {
            return first;
        }

        if (equals === undefined) {
            equals = _referenceEquality;
        }

        var nonuniform = _(values)
            .rest()
            .some(function (b) {
                return !equals.call(receiver, first, b);
            });

        if (nonuniform) {
            return null;
        }
        
        return first;
    };

    exports.uniformValue = uniformValue;
});
