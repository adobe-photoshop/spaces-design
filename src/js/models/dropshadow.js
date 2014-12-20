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

define(function (require, exports, module) {
    "use strict";

    var objUtil = require("js/util/object"),
        colorUtil = require("js/util/color"),
        mathjs = require("mathjs");

    /**
     * Given an angle and distance (polar coordinates), calculate the appropriate x/y coordinates in pixels
     *
     * @private
     * @param {number} angle angle in degrees
     * @param {number} distance distance in pixels
     *
     * @return {{x: number, y: number}} object containing numerical x/y values
     */
    var _calculateCartesianCoords = function (angle, distance) {
        var angleRads = angle * (Math.PI / 180.0);
        return {
            x: mathjs.round(-Math.cos(angleRads) * distance, 2),
            y: mathjs.round(Math.sin(angleRads) * distance, 2)
        };
    };

    /**
     * Model for a Photoshop layer dropShadow
     *
     * The provided descriptor is typically included as layerEffects.value.dropShadow property of a layer
     * @constructor
     * @param {object} dropShadowDescriptor
     */
    var DropShadow = function (dropShadowDescriptor) {
        var dropShadow = dropShadowDescriptor.value;

        this._enabled = dropShadow.enabled;

        var opacity = objUtil.getPath(dropShadow, "opacity.value"),
            rawColor = objUtil.getPath(dropShadow, "color.value");

        this._color = colorUtil.fromPhotoshopColorObj(rawColor, opacity);

        var angle = objUtil.getPath(dropShadow, "localLightingAngle.value"),
            distance = objUtil.getPath(dropShadow, "distance.value"),
            coords = _calculateCartesianCoords(angle, distance);

        this._x = coords.x;
        this._y = coords.y;

        this._blur = objUtil.getPath(dropShadow, "blur.value");
        this._spread = objUtil.getPath(dropShadow, "chokeMatte.value");
    };

    Object.defineProperties(DropShadow.prototype, {
        "enabled": {
            get: function () { return this._enabled; }
        },
        "color": {
            get: function () { return this._color; }
        },
        "x": {
            get: function () { return this._x; }
        },
        "y": {
            get: function () { return this._y; }
        },
        "blur": {
            get: function () { return this._blur; }
        },
        "spread": {
            get: function () { return this._spread; }
        }
    });


    /**
     * @type {boolean} True if dropShadow is enabled
     */
    DropShadow.prototype._enabled = null;

    /**
     * @type {Color} True if dropShadow is enabled
     */
    DropShadow.prototype._color = null;

    /**
     * @type {number} x coordinate of the dropShadow
     */
    DropShadow.prototype._x = null;

    /**
     * @type {number} y coordinate of the dropShadow
     */
    DropShadow.prototype._y = null;

    /**
     * @type {number} blur size in pixels
     */
    DropShadow.prototype._blur = null;

    /**
     * @type {number} spread size in pixels
     */
    DropShadow.prototype._spread = null;
    

    module.exports = DropShadow;
});
