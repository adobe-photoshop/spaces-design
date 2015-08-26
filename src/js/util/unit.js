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

/**
 * A set of utilities for dealing with photoshop units.
 */
define(function (require, exports) {
    "use strict";

    /**
     * conversion constants
     *
     * @private
     * @type {Object}
     */
    var _toInches = {
        rulerInches: 1,
        pointsUnit: 1 / 72,
        millimetersUnit: 1 / 25.4,
        rulerCm: 1 / 2.54
    };

    /**
     * Return a special object representation of a kind, val pair 
     * @param {string} kind
     * @param {number} val
     * @return {{_unit: string, _value: number}}
     */
    var unit = function (kind, val) {
        return {
            _unit: kind + "Unit",
            _value: val
        };
    };

    /**
     * Convert units+resolution to a pixel value
     * Valid values for unitValue._unit are: pixelsUnit, rulerInches, pointsUnit, millimetersUnit, rulerCm
     * Returns null if invalid unit provided
     * 
     * @param {{value: number, _unit: string}} unitValue
     * @param {number} resolution
     * @return {number|null}
     */
    var toPixels = function (unitValue, resolution) {
        var rawValue = unitValue._value,
            unit = unitValue._unit,
            factor;

        if (unit === "pixelsUnit") {
            factor = 1;
        } else if (_toInches[unit]) {
            factor = resolution * _toInches[unit];
        } else {
            return null;
        }
        return rawValue * factor;
    };

    exports._unit = unit;
    exports.toPixels = toPixels;

    exports.density = unit.bind(null, "density");
    exports.pixels = unit.bind(null, "pixels");
    exports.percent = unit.bind(null, "percent");
    exports.angle = unit.bind(null, "angle");
});
