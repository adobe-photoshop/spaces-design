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
        log = require("js/util/log");

    /**
     * Represents the character style used by a run of text in a text layer.
     * 
     * @constructor  
     */
    var CharacterStyle = Immutable.Record({
        /**
         * PostScript font name
         * @type {string} 
         */
        postScriptName: null,

        /**
         * Size in pixels
         * @type {number} 
         */
        textSize: null,

        /**
         * Opaque color
         * @type {Color} 
         */
        color: null,

        /**
         * Tracking (letter spacing) value
         * @type {number} 
         */
        tracking: null,

        /**
         * Leading (letter spacing) in pixels, or null if "auto-leading" is used.
         * @type {?number} 
         */
        leading: null
    });

    /**
     * Construct a CharacterStyle model from Photoshop descriptors.
     * 
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} characterStyleDescriptor
     * @return {CharacterStyle}
     */
    CharacterStyle.fromCharacterStyleDescriptor =
        function (documentDescriptor, layerDescriptor, characterStyleDescriptor, baseParentStyle) {
        var model = {},
            resolution = typeof documentDescriptor === "number" ?
                documentDescriptor :
                documentDescriptor.resolution._value,
            opacity = (layerDescriptor.opacity / 255) * 100,
            textStyle = characterStyleDescriptor.textStyle;

        var rawColor = textStyle.hasOwnProperty("color") ?
            textStyle.color :
            baseParentStyle.color;

        if (Color.isValidPhotoshopColorObj(rawColor)) {
            model.color = Color.fromPhotoshopColorObj(rawColor, opacity);
        } else {
            model.color = Color.DEFAULT;
            log.warn("Could not parse charstyle color because photoshop did not supply a valid RGB color");
        }

        var rawSize = textStyle.hasOwnProperty("size") ?
            textStyle.size :
            baseParentStyle.size;

        model.textSize = unitUtil.toPixels(rawSize, resolution);

        model.postScriptName = textStyle.hasOwnProperty("fontPostScriptName") ?
            textStyle.fontPostScriptName :
            baseParentStyle.fontPostScriptName;

        var tracking = textStyle.hasOwnProperty("tracking") ?
            textStyle.tracking :
            baseParentStyle.tracking;

        if (typeof tracking !== "number") {
            throw new Error("Tracking is not a number:" + tracking);
        }

        model.tracking = tracking;

        var autoLeading = textStyle.hasOwnProperty("autoLeading") ?
            textStyle.autoLeading :
            baseParentStyle.autoLeading;

        if (typeof autoLeading !== "boolean") {
            throw new Error("Auto-leading is not a boolean:" + autoLeading);
        }

        if (!autoLeading) {
            var rawLeading = textStyle.hasOwnProperty("leading") ?
                textStyle.leading :
                baseParentStyle.leading;

            var leading = unitUtil.toPixels(rawLeading, resolution);
            if (typeof leading !== "number") {
                throw new Error("Leading is not a number:" + leading);
            }

            model.leading = leading;
        }

        return new CharacterStyle(model);
    };

    /**
     * Construct a list of new CharacterStyle models from the given descriptor, or return null
     * if there are no character styles, e.g., if the descriptors do not describe a text layer.
     * 
     * @static
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} textDescriptor
     * @return {?Immutable.List.<CharacterStyle>}
     */
    CharacterStyle.fromTextDescriptor = function (documentDescriptor, layerDescriptor, textDescriptor) {
        var textStyleRanges = textDescriptor.textStyleRange;

        // Only the first style range contains the baseParentStyle
        var firstBaseParentStyle;
        if (textStyleRanges.length > 0) {
            firstBaseParentStyle = objUtil.getPath(textStyleRanges[0],
                "textStyle.baseParentStyle");
        }

        return Immutable.List(textStyleRanges)
            .map(function (characterStyleDescriptor) {
                var baseParentStyle = objUtil.getPath(characterStyleDescriptor,
                        "textStyle.baseParentStyle");

                baseParentStyle = baseParentStyle || firstBaseParentStyle;

                return CharacterStyle.fromCharacterStyleDescriptor(documentDescriptor, layerDescriptor,
                    characterStyleDescriptor, baseParentStyle);
            });
    };

    module.exports = CharacterStyle;
});
