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

    var Immutable = require("immutable"),
        mathjs = require("mathjs"),
        tinycolor = require("tinycolor");

    var objUtil = require("js/util/object"),
        mathUtil = require("js/util/math");

    /**
     * @constructor
     * @param {object} model
     */
    var Color = Immutable.Record({
        /**
         * [0, 255]
         * @type {number}
         */
        r: 0,

        /**
         * [0, 255]
         * @type {number}
         */
        g: 0,

        /**
         * [0, 255]
         * @type {number}
         */
        b: 0,

        /**
         * [0, 1]
         * @type {number}
         */
        a: 1
    });

    /**
     * @type {Color}
     */
    Color.DEFAULT = new Color();

    /**
     * Test that a color object supplied by Ps is a valid RGB color object
     *
     * @param {object} obj
     * @return {boolean} true if the supplied object is of type RGBColor
     */
    Color.isValidPhotoshopColorObj = function (obj) {
        return obj && (typeof obj === "object") && (obj._obj === "RGBColor");
    };

    /**
     * Construct a new Color object from a Photoshop color descriptor and
     * opacity percentage.
     * 
     * @param {object} rgb Photoshop color descriptor
     * @param {number} opacityPercentage In [0, 100]
     * @return {Color}
     */
    Color.fromPhotoshopColorObj = function (rgb, opacityPercentage) {
        var green;

        if (rgb.hasOwnProperty("grain")) {
            green = rgb.grain;
        } else if (rgb.hasOwnProperty("green")) {
            green = rgb.green;
        } else {
            throw new Error("Unable to parse Photoshop color object");
        }

        return new Color({
            "r": rgb.red,
            "g": green,
            "b": rgb.blue,
            "a": mathjs.round(opacityPercentage / 100, 4)
        });
    };

    /**
     * Construct a new Color object from a TinyColor instance.
     * 
     * @param {TinyColor} tiny
     * @return {Color}
     */
    Color.fromTinycolor = function (tiny) {
        return new Color(tiny.toRgb());
    };

    Object.defineProperties(Color.prototype, objUtil.cachedGetSpecs({
        /**
         * The opacity percentage of this color object
         * In [0, 100] 
         * @type {number} 
         */
        "opacity": function () {
            return mathjs.round(this.a * 100, 0);
        }
    }));

    /**
     * Set the alpha value of this color, but not its RGB value.
     *
     * @param {number|Color} alpha Number in [0, 1], or a Color object
     * @return {Color}
     */
    Color.prototype.setAlpha = function (alpha) {
        if (alpha instanceof Color) {
            alpha = alpha.a;
        }

        return this.set("a", alpha);
    };

    /**
     * Set the opaque value of this color, but not its alpha value.
     *
     * @param {Color} color
     * @return {Color}
     */
    Color.prototype.setOpaque = function (color) {
        return this.merge({
            r: color.r,
            g: color.g,
            b: color.b
        });
    };

    /**
     * Normalize the alpha value of this color w.r.t. 255.
     *
     * @return {Color}
     */
    Color.prototype.normalizeAlpha = function () {
        return this.set("a", mathUtil.normalize(this.a, 255));
    };

    /**
     * Set the opacity value of this color. 
     * 
     * @param {number} opacityPercentage In [0, 100]
     * @return {Color}
     */
    Color.prototype.setOpacity = function (opacityPercentage) {
        return this.setAlpha(mathjs.round(opacityPercentage / 100, 4));
    };

    /**
     * Get an opaque version of this color.
     *
     * @return {Color}
     */
    Color.prototype.opaque = function () {
        return this.delete("a");
    };
    
    /**
     * Return instance of TinyColor. Provide convenicen for accessing TinyColor functions
     * @return {TinyColor} 
     */
    Color.prototype.toTinyColor = function () {
        return tinycolor(this.toJS());
    };

    module.exports = Color;
});
