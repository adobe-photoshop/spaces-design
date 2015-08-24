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
     * @constructor
     * @param {object} model
     */
    var Guide = Immutable.Record({
        /**
         * ID of the owner document for this guide
         * 
         * @type {number}
         */
        documentID: null,

        /**
         * ID of the owner layer for this guide,
         * should always be an ID of an artboard layer, or 0 otherwise
         *
         * @type {number}
         */
        layerID: null,

        /**
         * Position of the guide in pixels
         * 
         * @type {number}
         */
        position: null,

        /**
         * Orientation of the guide ("horizontal" or "vertical")
         * 
         * @type {string}
         */
        orientation: null

    });

    /**
     * Construct a Guide model from a Photoshop document and a guide descriptor.
     *
     * @param {object|Immutable.Record} document Document descriptor or Document model
     * @param {object} guideDescriptor
     * @return {Guide}
     */
    Guide.fromDescriptor = function (document, guideDescriptor) {
        var documentID;

        // handle either style of document param
        if (document instanceof Immutable.Record) {
            documentID = document.id;
        } else {
            documentID = document.documentID;
        }

        var model = {
            documentID: documentID,
            layerID: guideDescriptor.layerID,
            // id: guideDescriptor.ID, // commented out because guide IDs change when you move them.
            orientation: guideDescriptor.orientation._value,
            position: guideDescriptor.position._value
        };

        return new Guide(model);
    };

    /**
     * Constructs the guide descriptors of a document into a list of Guide objects
     *
     * @param {object|Immutable.Record} documentDescriptor
     * @param {Array.<object>} guideDescriptors
     * @return {Immutable.List.<number, Guide>}
     */
    Guide.fromDescriptors = function (documentDescriptor, guideDescriptors) {
        return Immutable.List(guideDescriptors.map(function (descriptor) {
            return Guide.fromDescriptor(documentDescriptor, descriptor);
        }));
    };

    module.exports = Guide;
});
