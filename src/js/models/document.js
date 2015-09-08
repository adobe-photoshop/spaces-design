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

    var object = require("js/util/object"),
        LayerStructure = require("./layerstructure"),
        Guide = require("./guide"),
        Bounds = require("./bounds");

    /**
     * Model for a Photoshop document
     * 
     * @constructor
     * @param {object} descriptor Photoshop's data on the document
     */
    var Document = Immutable.Record({
        /**
         * Document ID
         * @type {number} 
         */
        id: null,

        /**
         * Whether the document is dirty
         * @type {boolean} 
         */
        dirty: null,

        /**
         * Document name
         * @type {string} 
         */
        name: null,

        /**
         * True if there is a background layer (affects layer indexing)
         * @type {boolean} 
         */
        hasBackgroundLayer: null,

        /**
         * The layers in a tree format
         * @type {LayerTree} 
         */
        layers: null,

        /**
         * Document bounds
         * @type {Bounds} 
         */
        bounds: null,

        /**
         * Document resolution
         * @type {number} 
         */
        resolution: null,

        /**
         * Document color mode
         * @type {Bounds} 
         */
        mode: null,

        /**
         * Visibility of guides
         * @type {boolean} 
         */
        guidesVisible: null,

        /**
         * Visibility of smart guides
         * @type {boolean} 
         */
        smartGuidesVisible: null,

        /**
         * Current guides of the document
         *
         * @type {Immutable.List.<Guide>}
         */
        guides: null,

        /**
         * If file is saved, contains the file type (e.g. "Photoshop" for PSD)
         * @type {string} 
         */
        format: null
    });

    Object.defineProperties(Document.prototype, object.cachedGetSpecs({
        /**
         * Indicates whether there are features in the document
         *  that are currently unsupported.
         *  
         * @type {boolean} 
         */
        unsupported: function () {
            if (this.mode !== "RGBColor") {
                return true;
            }

            return this.layers.unsupported;
        }
    }));

    /**
     * Construct a new document model from a Photoshop document descriptor and
     * a list of layer and guide descriptors.
     * 
     * @param {object} documentDescriptor
     * @param {Immutable.Iterator.<object>} layerDescriptors
     * @param {Immutable.Iterator.<object>} guideDescriptors
     * @return {Document}
     */
    Document.fromDescriptors = function (documentDescriptor, layerDescriptors, guideDescriptors) {
        var model = {};

        model.id = documentDescriptor.documentID;
        model.dirty = documentDescriptor.isDirty;
        model.hasBackgroundLayer = documentDescriptor.hasBackgroundLayer;
        model.name = documentDescriptor.title;
        model.resolution = documentDescriptor.resolution._value;
        model.mode = documentDescriptor.mode._value;
        model.guidesVisible = documentDescriptor.guidesVisibility;
        model.smartGuidesVisible = documentDescriptor.smartGuidesVisibility;
        model.bounds = Bounds.fromDocumentDescriptor(documentDescriptor);
        model.layers = LayerStructure.fromDescriptors(documentDescriptor, layerDescriptors);
        model.guides = guideDescriptors ? Guide.fromDescriptors(documentDescriptor, guideDescriptors) :
            Immutable.List();

        if (documentDescriptor.format) {
            model.format = documentDescriptor.format;
        }

        return new Document(model);
    };

    /**
     * Resize the bounds of this document model
     *
     * @param {number} x
     * @param {number} y
     * @param {boolean=} proportional
     * @return {Document}
     */
    Document.prototype.resize = function (x, y, proportional) {
        return this.set("bounds", this.bounds.updateSize(x, y, proportional));
    };

    Object.defineProperties(Document.prototype, object.cachedGetSpecs({
        /**
         * If document has any artboards, it's the union of all top layers bounds
         * otherwise it's document bounds
         * 
         * @type {Bounds}
         */
        "visibleBounds": function () {
            if (this.layers.hasArtboard) {
                return this.layers.overallBounds;
            } else {
                return this.bounds;
            }
        },

        /**
         * Strip the file extension from the document name
         *
         * @return {string}
         */
        "nameWithoutExtension": function () {
            return this.name.replace(/\.psd$/i, "");
        }
    }));

    module.exports = Document;
});
