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
        colorUtil = require("js/util/color");

    /**
     * Model for a Photoshop layer stroke
     *
     * @constructor
     * @param {{AGMStrokeStyleInfo: object}} descriptor layer descriptor, must include AGMStrokeStyleInfo
     */
    var Stroke = function (descriptor) {
        // pull out the root of the style info
        var styleInfoValue = objUtil.getPath(descriptor, "AGMStrokeStyleInfo.value");

        // TODO this is a hack to avoid gradient weirdness, for now
        if (objUtil.getPath(styleInfoValue, "strokeStyleContent.obj") === "gradientLayer") {
            throw new Error("Can not currently handle gradientLayer for strokes");
        }

        this._enabled = !styleInfoValue || styleInfoValue.strokeEnabled;
        this._color = colorUtil.fromPhotoshopColorObj(
            objUtil.getPath(styleInfoValue, "strokeStyleContent.value.color.value"));
        
        if (_.has(styleInfoValue, "strokeStyleLineWidth") &&
            _.has(styleInfoValue, "strokeStyleResolution")) {
            this._width = unit.toPixels(
                styleInfoValue.strokeStyleLineWidth,
                styleInfoValue.strokeStyleResolution
            );
        }
    };

    Object.defineProperties(Stroke.prototype, {
        "id": {
            get: function () { return this._id; }
        },
        "enabled": {
            get: function () { return this._enabled; }
        },
        "color": {
            get: function () { return this._color; }
        },
        "width": {
            get: function () { return this._width; }
        }
    });

    /**
     * @type {number} Id of layer
     */
    Stroke.prototype._id = null;

    /**
     * @type {boolean} True if stroke is enabled
     */
    Stroke.prototype._enabled = null;

    /**
     * @type {{red: number, green: number, blue: number}}
     */
    Stroke.prototype._color = null;

    /**
     * @type {number} width value of the stroke
     */
    Stroke.prototype._width = null;

    /**
     * Checks to see if the supplied stroke(s) are equal (enough) to this one
     * @param  {Stroke|Array.<Stroke>} otherStrokes
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
                    otherStroke.enabled === this.enabled;
            }, this);
        } else {
            return false;
        }
    };

    module.exports = Stroke;
});
