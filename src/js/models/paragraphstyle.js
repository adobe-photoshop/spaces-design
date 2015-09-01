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

    var collection = require("js/util/collection");

    /**
     * Properties and defaults for ParagraphStyle objects.
     *
     * @private
     * @type {object}
     */
    var _paragraphStylePrototype = {
        /*
         * @type {string} Either "left", "center", "right" or "justifyAll"
         */
        alignment: "left"
    };

    /**
     * Represents a paragraph style used by a run of text in a text layer.
     * 
     * @constructor  
     */
    var ParagraphStyle = Immutable.Record(_paragraphStylePrototype);

    /**
     * Construct a ParagraphStyle model from Photoshop descriptors.
     * 
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} paragraphStyleDescriptor
     * @return {ParagraphStyle}
     */
    ParagraphStyle.fromParagraphStyleDescriptor = function (documentDescriptor,
        layerDescriptor, paragraphStyleDescriptor) {
        var model = {},
            paragraphStyle = paragraphStyleDescriptor.paragraphStyle;

        if (paragraphStyle.hasOwnProperty("align")) {
            var alignment = paragraphStyle.align._value;
            switch (alignment) {
            case "left":
            case "center":
            case "right":
            case "justifyAll":
                model.alignment = alignment;
                break;
            default:
                throw new Error("Unexpected paragraph alignment value: " + alignment);
            }
        }

        return new ParagraphStyle(model);
    };

    /**
     * Construct a list of new ParagraphStyle models from the given descriptor, or return null
     * if there are no paragraph styles, e.g., if the descriptors do not describe a paragraph layer.
     * 
     * @static
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} textDescriptor
     * @return {ParagraphStyle}
     */
    ParagraphStyle.fromTextDescriptor = function (documentDescriptor, layerDescriptor, textDescriptor) {
        var paragraphStyleRanges = textDescriptor.paragraphStyleRange;
        if (!paragraphStyleRanges || paragraphStyleRanges.length === 0) {
            return new ParagraphStyle();
        }

        var paragraphStyles = Immutable.List(paragraphStyleRanges)
            .map(function (paragraphStyleDescriptor) {
                return ParagraphStyle.fromParagraphStyleDescriptor(documentDescriptor, layerDescriptor,
                    paragraphStyleDescriptor);
            });

        var reducedModel = Object.keys(_paragraphStylePrototype)
            .reduce(function (reducedModel, property) {
                var values = collection.pluck(paragraphStyles, property);

                reducedModel[property] = collection.uniformValue(values);
                return reducedModel;
            }, {});

        return new ParagraphStyle(reducedModel);
    };

    module.exports = ParagraphStyle;
});
