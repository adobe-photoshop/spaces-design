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
        _ = require("lodash");

    var Color = require("./color"),
        objUtil = require("js/util/object"),
        log = require("js/util/log");

    /**
     * Maximum Photoshop-supported shadow distance
     *
     * @const
     * @type {number}
     */
    var MAX_DISTANCE = 30000;

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
     * Given an x,y coordinate pair, calculate the appropriate polar coordinates
     * distance in pixels, and angle in degrees
     *
     * @private
     * @param {number} x x coordinate in pixels
     * @param {number} y y coordinate in pixels
     *
     * @return {?{distance: number, angle: number}} object containing distance in pixels and angle in degrees
     */
    var _calculatePolarCoords = function (x, y) {
        if (!_.isNumber(x) || !_.isNumber(y)) {
            return null;
        }
        return {
            distance: Math.sqrt((y * y) + (x * x)),
            angle: Math.atan2(y, -x) * (180 / Math.PI)
        };
    };

    /**
     * Model for a Photoshop layer shadow.
     *
     * @constructor
     * @param {object} model
     */
    var Shadow = Immutable.Record({
        /**
         * True if shadow is enabled
         * @type {boolean}
         */
        enabled: true,

        /**
         * Color of the shadow
         * @type {Color}
         */
        color: Color.DEFAULT,

        /**
         * X coordinate of the shadow
         * @type {number}
         */
        x: 0,

        /**
         * Y coordinate of the shadow
         * @type {number}
         */
        y: 5,

        /**
         * Blur size in pixels
         * @type {number}
         */
        blur: 5,

        /**
         * Spread size in pixels
         * @type {number}
         */
        spread: 5,

        /**
         * Blend mode of the shadow
         * @type {BlendMode}
         */
        blendMode: "normal"

    });

    /**
     * Set x value.
     *
     * @param {number} x Value to set shadow's x value to
     * @return {Shadow}
     */
    Shadow.prototype.setX = function (x) {
        return this._setCoordinate("x", x);
    };

    /**
     * Set y value.
     *
     * @param {number} y Value to set shadow's y value to
     * @return {Shadow}
     */
    Shadow.prototype.setY = function (y) {
        return this._setCoordinate("y", y);
    };

    /**
     * Set x or y value. If new value makes total distance greater than the maximum distance,
     * then normalize it so that the distance is equal to maximum distance.
     *
     * @private
     * @param {string} coordinate "x" or "y"
     * @param {number} value Value to set shadow coordinate to
     * @return {Shadow}
     */
    Shadow.prototype._setCoordinate = function (coordinate, value) {
        if (coordinate !== "x" && coordinate !== "y") {
            return;
        }

        var otherValue = coordinate === "x" ? this.y : this.x,
            distance = Math.sqrt((value * value) + (otherValue * otherValue)),
            newValue = value;

        if (distance > MAX_DISTANCE) {
            newValue = mathjs.round(Math.sqrt((MAX_DISTANCE * MAX_DISTANCE) - (otherValue * otherValue)), 2);
            newValue = value < 0 ? (-1 * newValue) : newValue;
        }

        return this.set(coordinate, newValue);
    };

    /**
     * Represent this shadow in an intermediate format that is useful to playground-adapter
     * This includes renaming some properties, and converting from cart to polar coords
     *
     * @return {object} photoshop-like object representation of a shadow layer effect
     */
    Shadow.prototype.toAdapterObject = function () {
        var polarCoords = _calculatePolarCoords(this.x, this.y);
        return {
            enabled: this.enabled,
            color: this.color,
            opacity: this.color && this.color.opacity,
            chokeMatte: this.spread,
            blur: this.blur,
            localLightingAngle: polarCoords && polarCoords.angle,
            distance: polarCoords && polarCoords.distance,
            useGlobalAngle: false, // Force this
            blendMode: this.blendMode
        };
    };

    /**
     * Construct a shadow model from a Photoshop descriptor. The descriptor
     * is typically included as layerEffects._value.shadow property of a layer.
     *
     * @param {object} shadowDescriptor
     * @param {number} globalLightingAngle
     * @return {Shadow}
     */
    Shadow.fromShadowDescriptor = function (shadowDescriptor, globalLightingAngle) {
        var model = {};

        model.enabled = shadowDescriptor.enabled;

        var opacity = objUtil.getPath(shadowDescriptor, "opacity._value"),
            rawColor = objUtil.getPath(shadowDescriptor, "color");

        if (Color.isValidPhotoshopColorObj(rawColor)) {
            model.color = Color.fromPhotoshopColorObj(rawColor, opacity);
        } else {
            log.warn("Could not parse shadow color because photoshop did not supply a valid RGB color");
        }

        var angle = objUtil.getPath(shadowDescriptor, "localLightingAngle._value"),
            distance = objUtil.getPath(shadowDescriptor, "distance._value");

        if (objUtil.getPath(shadowDescriptor, "useGlobalAngle")) {
            angle = globalLightingAngle;
        }

        var coords = _calculateCartesianCoords(angle, distance);

        model.x = coords.x;
        model.y = coords.y;

        model.blur = objUtil.getPath(shadowDescriptor, "blur._value");
        model.spread = objUtil.getPath(shadowDescriptor, "chokeMatte._value");

        model.blendMode = objUtil.getPath(shadowDescriptor, "mode._value");

        return new Shadow(model);
    };

    /**
     * Construct a list of Shadow models from a Photoshop layer descriptor.
     *
     * @param {object} layerDescriptor
     * @return {Immutable.List.<Shadow>}
     */
    Shadow.fromLayerDescriptor = function (layerDescriptor, kind) {
        var layerEffects = layerDescriptor.layerEffects;
        if (!layerEffects) {
            return Immutable.List();
        }

        var shadowDescriptors = objUtil.getPath(layerDescriptor, "layerEffects." + kind + "Multi");
        if (!shadowDescriptors) {
            // layerDescriptor.layerEffects.*Shadow[Multi] will be undefined if the shadows are all deleted
            // in Design Space. 
            var singleShadowDescriptor = objUtil.getPath(layerDescriptor, "layerEffects." + kind);
            shadowDescriptors = singleShadowDescriptor ? [singleShadowDescriptor] : [];
        }

        return Immutable.List(shadowDescriptors.reduce(function (result, shadowDescriptor) {
            // the enabled state should also respect the "master" layerFXVisible flag
            shadowDescriptor.enabled =
                shadowDescriptor.enabled && layerDescriptor.layerFXVisible;

            if (shadowDescriptor.present) {
                result.push(Shadow.fromShadowDescriptor(shadowDescriptor, layerDescriptor.globalAngle));
            }
            return result;
        }, []));
    };

    module.exports = Shadow;
});
