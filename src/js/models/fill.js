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

    var _ = require("lodash"),
        contentLayerLib = require("adapter/lib/contentLayer"),
        colorUtil = require("js/util/color");

    /**
     * A mapping of photoshop fill types to playground internal types
     * @type {Map}
     */
    var _fillTypeMap = new Map([
            ["patternLayer", contentLayerLib.contentTypes.PATTERN],
            ["solidColorLayer", contentLayerLib.contentTypes.SOLID_COLOR],
            ["gradientLayer", contentLayerLib.contentTypes.GRADIENT]
        ]);

    /**
     * Model for a Photoshop layer fill
     *
     * The provided properties are a sill mishmash of partially normalized photoshop grenades.
     * @constructor
     * @param {object} fillProperties
     */
    var Fill = function (fillProperties) {

        // Enabled
        this._enabled = !fillProperties || fillProperties.fillEnabled;

        // Opacity (default to 1 if not supplied)
        this._opacity = _.isNumber(fillProperties.fillOpacity) ?
            colorUtil.normalizeAlpha(fillProperties.fillOpacity / 255) : 1;

        // Fill Type
        if (fillProperties.type && _fillTypeMap.has(fillProperties.type)) {
            this._type = _fillTypeMap.get(fillProperties.type);
        } else {
            throw new Error("Fill type not supplied or type unknown");
        }

        // Color - Only popluate for solidColor fills
        if (this._type === contentLayerLib.contentTypes.SOLID_COLOR && _.isObject(fillProperties.color)) {
            this._color = colorUtil.fromPhotoshopColorObj(fillProperties.color, this._opacity * 100);
        } else {
            this._color = null;
        }
    };

    Object.defineProperties(Fill.prototype, {
        "id": {
            get: function () { return this._id; }
        },
        "type": {
            get: function () { return this._type; }
        },
        "enabled": {
            get: function () { return this._enabled; }
        },
        "opacity": {
            get: function () { return this._opacity; }
        },
        "color": {
            get: function () { return this._color; }
        }
    });

    /**
     * @type {number} Id of layer
     */
    Fill.prototype._id = null;

    /**
     * @type {string} True if fill is enabled
     */
    Fill.prototype._type = null;

    /**
     * @type {boolean} True if fill is enabled
     */
    Fill.prototype._enabled = null;

    /**
     * @type {number}
     */
    Fill.prototype._opacity = null;

    /**
     * @type {{r: number, g: number, b: number, a: number}}
     */
    Fill.prototype._color = null;
    

    module.exports = Fill;
});
