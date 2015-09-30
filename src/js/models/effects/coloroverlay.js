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

    var Immutable = require("immutable");

    var Color = require("js/models/color"),
        objUtil = require("js/util/object"),
        log = require("js/util/log");

    /**
     * Model for a Photoshop layer colorOverlay.
     *
     * @constructor
     * @param {object} model
     */
    var ColorOverlay = Immutable.Record({
        /**
         * Effect type
         * @type {string}
         */
        type: null,
        
        /**
         * True if colorOverlay is enabled
         * @type {boolean}
         */
        enabled: true,

        /**
         * Color of the colorOverlay
         * @type {Color}
         */
        color: Color.DEFAULT,

        /**
         * Blend mode of the colorOverlay
         * @type {BlendMode}
         */
        blendMode: "normal"
    });
    
    /**
     * Represent this layer effect in an intermediate format that is useful to playground-adapter.
     *
     * @return {object} photoshop-like object representation of a layer effect
     */
    ColorOverlay.prototype.toAdapterObject = function () {
        return {
            enabled: this.enabled,
            color: this.color,
            opacity: this.color && this.color.opacity,
            blendMode: this.blendMode
        };
    };

    /**
     * Construct a ColorOverlay model from a Photoshop descriptor. The descriptor
     * is typically included as layerEffects._value.colorOverlay property of a layer.
     *
     * @param {string} effectType
     * @param {Array.<object>} effectDescriptors
     * @return {Immutable.List.<ColorOverlay>}
     */
    ColorOverlay.fromEffectDescriptors = function (effectType, effectDescriptors) {
        return effectDescriptors.reduce(function (overlays, effectDescriptor) {
            if (!effectDescriptor.present) {
                return overlays;
            }
            
            var opacity = objUtil.getPath(effectDescriptor, "opacity._value"),
                rawColor = objUtil.getPath(effectDescriptor, "color"),
                color;

            if (Color.isValidPhotoshopColorObj(rawColor)) {
                color = Color.fromPhotoshopColorObj(rawColor, opacity);
            } else {
                log.warn("Could not parse color overlay color because photoshop did not supply a valid RGB color");
            }
            
            var overlay = new ColorOverlay({
                type: effectType,
                enabled: effectDescriptor.enabled,
                color: color,
                blendMode: objUtil.getPath(effectDescriptor, "mode._value")
            });
            
            return overlays.push(overlay);
        }, new Immutable.List());
    };

    module.exports = ColorOverlay;
});
