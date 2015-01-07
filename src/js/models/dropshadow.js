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
        mathjs = require("mathjs");

    var Color = require("./color"),
        objUtil = require("js/util/object"),
        log = require("js/util/log");

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
     * Model for a Photoshop layer dropShadow.
     * 
     * @constructor
     * @param {object} model
     */
    var DropShadow = Immutable.Record({
        /**
         * @type {boolean} True if dropShadow is enabled
         */
        enabled: null,

        /**
         * @type {Color} True if dropShadow is enabled
         */
        color: null,

        /**
         * @type {number} x coordinate of the dropShadow
         */
        x: null,

        /**
         * @type {number} y coordinate of the dropShadow
         */
        y: null,

        /**
         * @type {number} blur size in pixels
         */
        blur: null,

        /**
         * @type {number} spread size in pixels
         */
        spread: null
    });

    /**
     * Construct a DropShadow model from a Photoshop descriptor. The descriptor
     * is typically included as layerEffects.value.dropShadow property of a layer.
     * 
     * @param {object} dropShadowDescriptor
     * @return {DropShadow}
     */
    DropShadow.fromDropShadowDescriptor = function (dropShadowDescriptor) {
        var model = {},
            dropShadow = dropShadowDescriptor.value;

        model.enabled = dropShadow.enabled;

        var opacity = objUtil.getPath(dropShadow, "opacity.value"),
            rawColor = objUtil.getPath(dropShadow, "color.value");

        model.color = Color.fromPhotoshopColorObj(rawColor, opacity);

        var angle = objUtil.getPath(dropShadow, "localLightingAngle.value"),
            distance = objUtil.getPath(dropShadow, "distance.value"),
            coords = _calculateCartesianCoords(angle, distance);

        model.x = coords.x;
        model.y = coords.y;

        model.blur = objUtil.getPath(dropShadow, "blur.value");
        model.spread = objUtil.getPath(dropShadow, "chokeMatte.value");

        return new DropShadow(model);
    };

    /**
     * Construct a list of DropShadow models from a Photoshop layer descriptor.
     * 
     * @param {object} layerDescriptor
     * @return {Immutable.List.<DropShadow)}
     */
    DropShadow.fromLayerDescriptor = function (layerDescriptor) {
        // test first to see if there is at least some layer effects
        // TODO need to understand the implication of layerFXVisible more betterer
        var layerEffects = layerDescriptor.layerEffects,
            dropShadowDescriptor = objUtil.getPath(layerDescriptor, "layerEffects.value.dropShadow");

        if (layerEffects && layerEffects.obj === "layerFXVisible" && dropShadowDescriptor) {
            try {
                var dropShadow = DropShadow.fromDropShadowDescriptor(dropShadowDescriptor);

                return Immutable.List.of(dropShadow);
            } catch (e) {
                log.error("Failed to build a drop shadow for layer %s: %s", layerDescriptor.id, e.message);
            }
        }

        return Immutable.List();
    };

    module.exports = DropShadow;
});
