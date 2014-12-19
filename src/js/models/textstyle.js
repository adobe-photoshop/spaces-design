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

    var objUtil = require("js/util/object"),
        colorUtil = require("js/util/color"),
        unitUtil = require("js/util/unit");

    /**
     * Represents a text style used by a run of text in a text layer.
     * 
     * @constructor
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} textStyleDescriptor     
     */
    var TextStyle = function (documentDescriptor, layerDescriptor, textStyleDescriptor) {
        var resolution = documentDescriptor.resolution.value,
            opacity = (layerDescriptor.opacity / 255) * 100,
            baseParentStyle = objUtil.getPath(textStyleDescriptor, "baseParentStyle.value");

        var rawColor = textStyleDescriptor.hasOwnProperty("color") ?
            textStyleDescriptor.color.value :
            baseParentStyle.color.value;

        this._color = colorUtil.fromPhotoshopColorObj(rawColor, opacity);

        var rawSize = textStyleDescriptor.hasOwnProperty("size") ?
            textStyleDescriptor.size :
            baseParentStyle.size;

        this._size = unitUtil.toPixels(rawSize, resolution);

        this._postScriptName = textStyleDescriptor.hasOwnProperty("fontPostScriptName") ?
            textStyleDescriptor.fontPostScriptName :
            baseParentStyle.fontPostScriptName;
    };

    Object.defineProperties(TextStyle.prototype, {
        "postScriptName": {
            get: function () { return this._postScriptName; }
        },
        "size": {
            get: function () { return this._size; }
        },
        "color": {
            get: function () { return this._color; }
        }
    });

    /**
     * @type {string} The postscript name of font used in this text style
     */
    TextStyle.prototype._postScriptName = null;

    /**
     * @type {number} The size in pixels of the text used this text style
     */
    TextStyle.prototype._size = null;

    /**
     * @type {string} The (opaque) color of the text used in this text style
     */
    TextStyle.prototype._color = null;

    /**
     * Construct a list of new TextStyle models from the given descriptor, or return null
     * if there are no text styles, e.g., if the descriptors do not describe a text layer.
     * 
     * @static
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @return {?Array.<TextStyle>}
     */
    TextStyle.fromDescriptor = function (documentDescriptor, layerDescriptor) {
        if (!layerDescriptor.hasOwnProperty("textKey")) {
            return null;
        }

        var textKey = layerDescriptor.textKey.value,
            textStyleRanges = textKey.textStyleRange;

        return textStyleRanges.map(function (descriptor) {
            return new TextStyle(documentDescriptor, layerDescriptor, descriptor.value.textStyle.value);
        });
    };


    /**
     * Update the font postScriptName.
     *
     * @protected
     * @param {string} postScriptName
     * @return {TextStyle}
     */
    TextStyle.prototype._setFace = function (postScriptName) {
        this._postScriptName = postScriptName;
        return this;
    };

    /**
     * Update the font color.
     *
     * @protected
     * @param {Color} color An opaque color model.
     * @return {TextStyle}
     */
    TextStyle.prototype._setColor = function (color) {
        this._color = color;
        return this;
    };

    /**
     * Update the font size
     *
     * @protected
     * @param {number} size The font size in pixels.
     * @return {TextStyle}
     */
    TextStyle.prototype._setSize = function (size) {
        this._size = size;
        return this;
    };
    
    module.exports = TextStyle;
});
