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
        objUtil = require("js/util/object"),
        unitUtil = require("js/util/unit");

    /**
     * Represents a text style used by a run of text in a text layer.
     * 
     * @constructor  
     */
    var TextStyle = Immutable.Record({
        /**
         * @type {string} The postscript name of font used in this text style
         */
        postScriptName: null,

        /**
         * @type {number} The size in pixels of the text used this text style
         */
        size: null,

        /**
         * @type {string} The (opaque) color of the text used in this text style
         */
        color: null
    });

    /**
     * Construct a TextStyle model from Photoshop descriptors.
     * 
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} textStyleDescriptor
     * @return {TextStyle}
     */
    TextStyle.fromTextStyleDescriptor = function (documentDescriptor, layerDescriptor, textStyleDescriptor) {
        var model = {},
            resolution = typeof documentDescriptor === "number" ?
                documentDescriptor :
                documentDescriptor.resolution.value,
            opacity = (layerDescriptor.opacity / 255) * 100,
            baseParentStyle = objUtil.getPath(textStyleDescriptor, "baseParentStyle.value");

        var rawColor = textStyleDescriptor.hasOwnProperty("color") ?
            textStyleDescriptor.color.value :
            baseParentStyle.color.value;

        model.color = Color.fromPhotoshopColorObj(rawColor, opacity);

        var rawSize = textStyleDescriptor.hasOwnProperty("size") ?
            textStyleDescriptor.size :
            baseParentStyle.size;

        model.size = unitUtil.toPixels(rawSize, resolution);

        model.postScriptName = textStyleDescriptor.hasOwnProperty("fontPostScriptName") ?
            textStyleDescriptor.fontPostScriptName :
            baseParentStyle.fontPostScriptName;

        return new TextStyle(model);
    };

    /**
     * Construct a list of new TextStyle models from the given descriptor, or return null
     * if there are no text styles, e.g., if the descriptors do not describe a text layer.
     * 
     * @static
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @return {?Immutable.List.<TextStyle>}
     */
    TextStyle.fromLayerDescriptor = function (documentDescriptor, layerDescriptor) {
        if (!layerDescriptor.hasOwnProperty("textKey")) {
            return null;
        }

        var textKey = layerDescriptor.textKey.value,
            textStyleRanges = textKey.textStyleRange;

        return Immutable.List(textStyleRanges)
                .slice(0, 1) // only one supported text style for now
                .map(function (descriptor) {
                var textStyleDescriptor = descriptor.value.textStyle.value;

                return TextStyle.fromTextStyleDescriptor(documentDescriptor, layerDescriptor, textStyleDescriptor);
            });
    };

    module.exports = TextStyle;
});
