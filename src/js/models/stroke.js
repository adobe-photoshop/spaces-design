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
        _ = require("lodash");

    var Color = require("./color"),
        unit = require("../util/unit"),
        objUtil = require("js/util/object"),
        contentLayerLib = require("adapter/lib/contentLayer"),
        log = require("js/util/log");

    /**
     * A mapping of photoshop stroke types to spaces internal types
     * 
     * @private
     * @type {Map}
     */
    var _strokeTypeMap = new Map([
        ["patternLayer", contentLayerLib.contentTypes.PATTERN],
        ["solidColorLayer", contentLayerLib.contentTypes.SOLID_COLOR],
        ["gradientLayer", contentLayerLib.contentTypes.GRADIENT]
    ]);

    /**
     * A mapping of photoshop alignment to spaces internal types
     * 
     * @private
     * @type {Map}
     */
    var _alignmentTypeMap = new Map([
        [contentLayerLib.alignmentTypes.INSIDE, "INSIDE"],
        [contentLayerLib.alignmentTypes.CENTER, "CENTER"],
        [contentLayerLib.alignmentTypes.OUTSIDE, "OUTSIDE"]
    ]);

    /**
     * Model for a Photoshop layer stroke
     *
     * @constructor
     */
    var Stroke = Immutable.Record({
        /**
         * @type {string} Stroke type: pattern, color, or gradient 
         */
        type: null,

        /**
         * @type {boolean} True if stroke is enabled
         */
        enabled: true,

        /**
         * @type {{r: number, g: number, b: number}}
         */
        color: Color.DEFAULT,

        /**
         * @type {number} width value of the stroke
         */
        width: 5,

        /**
         * @type {string=} alignment type, optionally inside, outside, or center
         */
        alignment: null
    });

    /**
     * Construct a stroke model from a Photoshop descriptor. The provided
     * descriptor is typically included as AGMStrokeStyleInfo property of a
     * layer descriptor.
     * 
     * @param {object} strokeStyleDescriptor
     * @return {Stroke}
     */
    Stroke.fromStrokeStyleDescriptor = function (strokeStyleDescriptor) {
        // parse phtoshop-style data
        var model = {},
            strokeStyleValue = strokeStyleDescriptor.value,
            colorValue = objUtil.getPath(strokeStyleValue, "strokeStyleContent.value.color.value"),
            typeValue = objUtil.getPath(strokeStyleValue, "strokeStyleContent.obj"),
            opacityPercentage = strokeStyleValue && objUtil.getPath(strokeStyleValue, "strokeStyleOpacity.value"),
            alignmentValue  = strokeStyleValue && objUtil.getPath(strokeStyleValue, "strokeStyleLineAlignment.value");

        // Enabled
        model.enabled = !strokeStyleValue || strokeStyleValue.strokeEnabled;

        // Stroke Type
        if (typeValue && _strokeTypeMap.has(typeValue)) {
            model.type = _strokeTypeMap.get(typeValue);
        } else {
            throw new Error("Stroke type not supplied or type unknown");
        }

        // Width
        if (_.has(strokeStyleValue, "strokeStyleLineWidth")) {
            model.width = unit.toPixels(
                strokeStyleValue.strokeStyleLineWidth,
                strokeStyleValue.strokeStyleResolution
            );
            if (model.width === null) {
                throw new Error("Stroke width could not be converted to pixels");
            }
        } else {
            throw new Error("Stroke width not provided");
        }

        // Color - Only populate for solidColor strokes
        if (model.type === contentLayerLib.contentTypes.SOLID_COLOR && colorValue && _.isObject(colorValue)) {
            model.color = Color.fromPhotoshopColorObj(colorValue, opacityPercentage);
        }

        // Alignment Type - seems to not populate on new strokes. 
        if (_alignmentTypeMap.has(alignmentValue)) {
            model.alignment = _alignmentTypeMap.get(alignmentValue);
        }
       
        return new Stroke(model);
    };

    /**
     * Construct a list of Stroke models from a Photoshop layer descriptor.
     *
     * @param {object} layerDescriptor
     * @return {Immutable.List.<Stroke>}
     */
    Stroke.fromLayerDescriptor = function (layerDescriptor) {
        // test first to see if there is at least some StyleInfo
        if (layerDescriptor.AGMStrokeStyleInfo) {
            try {
                var strokeStyleDescriptor = layerDescriptor.AGMStrokeStyleInfo,
                    stroke = Stroke.fromStrokeStyleDescriptor(strokeStyleDescriptor);

                return Immutable.List.of(stroke);
            } catch (err) {
                var message = err instanceof Error ? (err.stack || err.message) : err;

                log.error("Failed to build stroke for layer " + layerDescriptor.layerID, message);
            }
        }

        return Immutable.List();
    };

    /**
     * Update this model's basic properties.
     * 
     * @param {object} strokeProperties
     * @return {Stroke}
     */
    Stroke.prototype.setStrokeProperties = function (strokeProperties) {
        return this.withMutations(function (model) {
            if (strokeProperties.color) {
                if (strokeProperties.ignoreAlpha) {
                    model.color = model.color.setOpaque(strokeProperties.color);
                } else {
                    model.color = strokeProperties.color;
                }

                // If setting a color, force a type change
                model.type = contentLayerLib.contentTypes.SOLID_COLOR;
            } else if (_.isNumber(strokeProperties.opacity)) {
                // Handle the special case of setting opacity independent of color
                model.color = model.color.setOpacity(strokeProperties.opacity);
            }

            if (strokeProperties.hasOwnProperty("width")) {
                model.width = strokeProperties.width;
            }

            if (strokeProperties.hasOwnProperty("enabled")) {
                model.enabled = strokeProperties.enabled;
            }

            if (strokeProperties.hasOwnProperty("alignment")) {
                model.alignment = strokeProperties.alignment;
            }
        }.bind(this));
    };

    module.exports = Stroke;
});
