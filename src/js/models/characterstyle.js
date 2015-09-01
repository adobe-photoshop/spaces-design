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
        unitUtil = require("js/util/unit"),
        log = require("js/util/log"),
        collection = require("js/util/collection");

    /**
     * Properties and defaults for CharacterStyle objects.
     *
     * @private
     * @type {object}
     */
    var _characterStylePrototype = {
        /**
         * PostScript font name
         * @type {string} 
         */
        postScriptName: "MyriadPro-Regular",

        /**
         * Size in pixels
         * @type {number} 
         */
        textSize: 16,

        /**
         * Opaque color
         * @type {Color} 
         */
        color: Color.DEFAULT,

        /**
         * Tracking (letter spacing) value
         * @type {number} 
         */
        tracking: 0,

        /**
         * Leading (letter spacing) in pixels, or -1 if "auto-leading" is used.
         * @type {number} 
         */
        leading: -1
    };

    /**
     * Represents the character style used by a run of text in a text layer.
     * 
     * @constructor  
     */
    var CharacterStyle = Immutable.Record(_characterStylePrototype);

    /**
     * Construct a CharacterStyle model from Photoshop descriptors.
     * 
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} characterStyleDescriptor
     * @param {object} baseParentStyle
     * @return {CharacterStyle}
     */
    CharacterStyle.fromCharacterStyleDescriptor = function (documentDescriptor,
        layerDescriptor, characterStyleDescriptor, baseParentStyle) {
        var model = {},
            resolution = typeof documentDescriptor === "number" ?
                documentDescriptor :
                documentDescriptor.resolution._value,
            opacity = (layerDescriptor.opacity / 255) * 100,
            textStyle = characterStyleDescriptor.textStyle;

        var rawColor = textStyle.hasOwnProperty("color") ?
            textStyle.color : baseParentStyle.color;

        var color;
        if (Color.isValidPhotoshopColorObj(rawColor)) {
            color = Color.fromPhotoshopColorObj(rawColor, opacity);
        } else {
            color = Color.DEFAULT;
            log.warn("Could not parse charstyle color because photoshop did not supply a valid RGB color");
        }

        model.color = color;

        // Use impliedFontSize instead of size to account for the layer transform.
        var rawSize = textStyle.hasOwnProperty("impliedFontSize") ?
                textStyle.impliedFontSize : baseParentStyle.impliedFontSize,
            textSize = unitUtil.toPixels(rawSize, resolution);

        model.textSize = textSize;

        var postScriptName = textStyle.hasOwnProperty("fontPostScriptName") ?
                textStyle.fontPostScriptName : baseParentStyle.fontPostScriptName;

        model.postScriptName = postScriptName;

        var tracking = textStyle.hasOwnProperty("tracking") ?
            textStyle.tracking : baseParentStyle.tracking;

        if (typeof tracking !== "number") {
            throw new Error("Tracking is not a number:" + tracking);
        }

        model.tracking = tracking;

        var autoLeading = textStyle.hasOwnProperty("autoLeading") ?
                textStyle.autoLeading : baseParentStyle.autoLeading;

        if (typeof autoLeading !== "boolean") {
            throw new Error("Auto-leading is not a boolean:" + autoLeading);
        }

        if (autoLeading) {
            model.leading = -1;
        } else {
            var rawLeading = textStyle.hasOwnProperty("leading") ?
                    textStyle.leading : baseParentStyle.leading,
                leading = unitUtil.toPixels(rawLeading, resolution);

            if (typeof leading !== "number") {
                throw new Error("Leading is not a number:" + leading);
            }

            model.leading = leading;
        }

        return new CharacterStyle(model);
    };

    /**
     * Construct a reduce CharacterStyle model from the given descriptor, or return null
     * if there are no character styles, e.g., if the descriptors do not describe a text layer.
     * The CharacterStyle model will have undefined properties in case the models of the
     * individual textStyleRange descriptors are inconsistent.
     * 
     * @static
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} textDescriptor
     * @return {CharacterStyle}
     */
    CharacterStyle.fromTextDescriptor = function (documentDescriptor, layerDescriptor, textDescriptor) {
        var textStyleRanges = textDescriptor.textStyleRange;

        if (!textStyleRanges || textStyleRanges.length === 0) {
            return new CharacterStyle();
        }

        // Only the first style range contains the baseParentStyle
        var firstTextStyleRange = textStyleRanges[0],
            firstBaseParentStyle = objUtil.getPath(firstTextStyleRange, "textStyle.baseParentStyle");

        var characterStyles = Immutable.List(textStyleRanges)
            .map(function (characterStyleDescriptor) {
                var baseParentStyle = objUtil.getPath(characterStyleDescriptor,
                        "textStyle.baseParentStyle");

                baseParentStyle = baseParentStyle || firstBaseParentStyle;

                return CharacterStyle.fromCharacterStyleDescriptor(documentDescriptor,
                    layerDescriptor, characterStyleDescriptor, baseParentStyle);
            });

        var reducedModel = Object.keys(_characterStylePrototype)
            .reduce(function (reducedModel, property) {
                var values = collection.pluck(characterStyles, property);

                reducedModel[property] = collection.uniformValue(values);
                return reducedModel;
            }, {});

        return new CharacterStyle(reducedModel);
    };

    module.exports = CharacterStyle;
});
