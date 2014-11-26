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
        unit = require("../util/unit"),
        objUtil = require("js/util/object"),
        contentLayerLib = require("adapter/lib/contentLayer"),
        colorUtil = require("js/util/color");

    /**
     * A mapping of photoshop stroke types to playground internal types
     * @type {Map}
     */
    var _strokeTypeMap = new Map([
            ["patternLayer", contentLayerLib.contentTypes.PATTERN],
            ["solidColorLayer", contentLayerLib.contentTypes.SOLID_COLOR],
            ["gradientLayer", contentLayerLib.contentTypes.GRADIENT]
        ]);

    /**
     * Model for a Photoshop layer stroke
     *
     * The provided descriptor is typically included as AGMStrokeStyleInfo property of a layer
     * @constructor
     * @param {object} strokeStyleDescriptor
     */
    var Stroke = function (strokeStyleDescriptor) {
        // pull out the root of the style info
        var strokeStyleValue = strokeStyleDescriptor.value,
            colorValue = objUtil.getPath(strokeStyleValue, "strokeStyleContent.value.color.value"),
            typeValue = objUtil.getPath(strokeStyleValue, "strokeStyleContent.obj"),
            opacityPercentage = strokeStyleValue && objUtil.getPath(strokeStyleValue, "strokeStyleOpacity.value");

        // Enabled
        this._enabled = !strokeStyleValue || strokeStyleValue.strokeEnabled;

        // Stroke Type
        if (typeValue && _strokeTypeMap.has(typeValue)) {
            this._type = _strokeTypeMap.get(typeValue);
        } else {
            throw new Error("Stroke type not supplied or type unknown");
        }

        // Width
        if (_.has(strokeStyleValue, "strokeStyleLineWidth")) {
            this._width = unit.toPixels(
                strokeStyleValue.strokeStyleLineWidth,
                strokeStyleValue.strokeStyleResolution
            );
            if (!this._width) {
                throw new Error("Stroke width could not be converted toPixels");
            }
        } else {
            throw new Error("Stroke width and resolution not supplied");
        }

        // Color - Only popluate for solidColor strokes
        if (this._type === contentLayerLib.contentTypes.SOLID_COLOR && colorValue && _.isObject(colorValue)) {
            this._color = colorUtil.fromPhotoshopColorObj(colorValue, opacityPercentage);
        } else {
            this._color = null;
        }
    };

    Object.defineProperties(Stroke.prototype, {
        "id": {
            get: function () { return this._id; }
        },
        "type": {
            get: function () { return this._type; }
        },
        "enabled": {
            get: function () { return this._enabled; }
        },
        "color": {
            get: function () { return this._color; }
        },
        "width": {
            get: function () { return this._width; }
        },
        "contentTypes": {
            get: function () { return contentLayerLib.contentTypes; }
        }
    });

    /**
     * @type {number} Id of layer
     */
    Stroke.prototype._id = null;

    /**
     * @type {string} True if stroke is enabled
     */
    Stroke.prototype._type = null;

    /**
     * @type {boolean} True if stroke is enabled
     */
    Stroke.prototype._enabled = null;

    /**
     * @type {{r: number, g: number, b: number}}
     */
    Stroke.prototype._color = null;

    /**
     * @type {number} width value of the stroke
     */
    Stroke.prototype._width = null;

    /**
     * Checks to see if the supplied stroke(s) are equal (enough) to this one
     * @param {Stroke|Array.<Stroke>} otherStrokes
     * @return {boolean}
     */
    Stroke.prototype.equals = function (otherStrokes) {
        if (_.isObject(otherStrokes)) {
            otherStrokes = [otherStrokes];
        }
        if (_.isArray(otherStrokes)) {
            return _.every(otherStrokes, function (otherStroke) {
                return _.isEqual(otherStroke.color, this.color) &&
                    otherStroke.width === this.width &&
                    otherStroke.enabled === this.enabled &&
                    otherStroke.type === this.type;
            }, this);
        } else {
            return false;
        }
    };

    module.exports = Stroke;
});
