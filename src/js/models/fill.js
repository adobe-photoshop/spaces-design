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

    var Color = require("./color"),
        layerLib = require("adapter/lib/layer"),
        contentLayerLib = require("adapter/lib/contentLayer"),
        objUtil = require("js/util/object"),
        log = require("js/util/log");

    /**
     * A mapping of photoshop fill types to spaces internal types
     * @private
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
     * @constructor
     * @param {object} model
     */
    var Fill = Immutable.Record({
        /**
         * True if fill is enabled
         * @type {string} 
         */
        type: null,

        /**
         * True if fill is enabled
         * @type {boolean} 
         */
        enabled: true,

        /**
         * @type {{r: number, g: number, b: number, a: number}}
         */
        color: Color.DEFAULT
    });

    /**
     * Construct a list of Fill models from a Photoshop layer descriptor.
     * 
     * @param {object} layerDescriptor
     * @return {Immutable.List.<Fill>}
     */
    Fill.fromLayerDescriptor = function (layerDescriptor) {
        var adjustment = layerDescriptor.adjustment && layerDescriptor.adjustment[0];

        // Build a Fill for vector layers with an adjustment property
        if ((layerDescriptor.layerKind === layerLib.layerKinds.VECTOR) && adjustment) {
            try {
                var model = {},
                    color = objUtil.getPath(adjustment, "color"),
                    type = adjustment._obj;

                // Enabled (uses a combo of AGM, fillEnabled and adjustment to derive the correct state)
                model.enabled = (layerDescriptor.AGMStrokeStyleInfo && layerDescriptor.fillEnabled) ||
                    (!layerDescriptor.AGMStrokeStyleInfo && !!adjustment);

                // Fill Type
                if (type && _fillTypeMap.has(type)) {
                    model.type = _fillTypeMap.get(type);
                } else {
                    throw new Error("Fill type not supplied or type unknown");
                }

                // Color - Only popluate for solidColor fills
                if (model.type === contentLayerLib.contentTypes.SOLID_COLOR && typeof color === "object") {
                    var fillOpacity = layerDescriptor.fillOpacity;
                    model.color = Color.fromPhotoshopColorObj(color, (fillOpacity / 255) * 100);
                }

                var fill = new Fill(model);
                return Immutable.List.of(fill);
            } catch (err) {
                var message = err instanceof Error ? (err.stack || err.message) : err;

                log.error("Failed to build fill for layer " + layerDescriptor.layerID, message);
            }
        }

        return Immutable.List();
    };

    /**
     * Construct a Fill model from a Photoshop "set" descriptor.
     *
     * @param {object} setDescriptor
     * @return {Fill}
     */
    Fill.fromSetDescriptor = function (setDescriptor) {
        var rawColor = objUtil.getPath(setDescriptor, "to.fillContents.color"),
            rawType = objUtil.getPath(setDescriptor, "to.fillContents._obj");

        return new Fill({
            color: Color.fromPhotoshopColorObj(rawColor),
            type: rawType
        });
    };

    /**
     * Update certain DropShadow properties.
     * 
     * @param {object} fillProperties
     * @return {Fill}
     */
    Fill.prototype.setFillProperties = function (fillProperties) {
        return this.withMutations(function (model) {
            // If color is specified it includes alpha, otherwise opacity may be set independently
            if (fillProperties.color) {
                if (fillProperties.ignoreAlpha) {
                    model.color = model.color.setOpaque(fillProperties.color);
                } else {
                    model.color = fillProperties.color;
                }

                // If setting a color, force a type change
                model.type = contentLayerLib.contentTypes.SOLID_COLOR;
            } else if (fillProperties.opacity) {
                // preserve the color values and only update the opacity
                model.color = this.color.setOpacity(fillProperties.opacity);
            }

            model.enabled = fillProperties.enabled;
        }.bind(this));
    };

    module.exports = Fill;
});
