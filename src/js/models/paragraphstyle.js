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

    /**
     * Represents a paragraph style used by a run of text in a text layer.
     * 
     * @constructor  
     */
    var ParagraphStyle = Immutable.Record({
        /*
         * @type {string} Either "left", "center", "right" or "justifyAll"
         */
        alignment: null
    });

    /**
     * Construct a ParagraphStyle model from Photoshop descriptors.
     * 
     * @param {object} documentDescriptor
     * @param {object} layerDescriptor
     * @param {object} paragraphStyleDescriptor
     * @return {ParagraphStyle}
     */
    ParagraphStyle.fromParagraphStyleDescriptor =
        function (documentDescriptor, layerDescriptor, paragraphStyleDescriptor) {
        var model = {},
            paragraphStyle = paragraphStyleDescriptor.paragraphStyle.value;

        if (paragraphStyle.hasOwnProperty("align")) {
            model.alignment = paragraphStyle.align.value;
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
     * @return {?Immutable.List.<ParagraphStyle>}
     */
    ParagraphStyle.fromTextDescriptor = function (documentDescriptor, layerDescriptor, textDescriptor) {
        var paragraphStyleRanges = textDescriptor.paragraphStyleRange;

        return Immutable.List(paragraphStyleRanges)
            .map(function (descriptor) {
                var paragraphStyleDescriptor = descriptor.value;

                return ParagraphStyle.fromParagraphStyleDescriptor(documentDescriptor, layerDescriptor,
                    paragraphStyleDescriptor);
            });
    };

    module.exports = ParagraphStyle;
});
