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

    var _ = require("lodash");
    /**
     * Model for a Photoshop document
     * 
     * @constructor
     * @param {object} descriptor Photoshop's data on the document
     */
    var Document = function (descriptor) {
        // TODO: Handled proeprties for sub classes?!
        var property;

        for (property in descriptor) {
            if (descriptor.hasOwnProperty(property)) {
                switch (property) {
                    case "documentID":
                        this._id = descriptor.documentID;
                        break;
                    case "hasBackgroundLayer":
                        this._hasBackgroundLayer = descriptor.hasBackgroundLayer;
                        break;
                    case "numberOfLayers":
                        this._numberOfLayers = descriptor.numberOfLayers;
                        break;
                    case "targetLayers":
                        this._selection = _.pluck(descriptor.targetLayers, "index");
                        break;
                    case "title":
                        this._name = descriptor.title;
                        break;
                }
            }
        }
    };

    Object.defineProperties(Document.prototype, {
        "id": {
            get: function () { return this._id; }
        },
        "name": {
            get: function () { return this._name; }
        },
        "numberOfLayers": {
            get: function () { return this._numberOfLayers; }
        },
        "selection": {
            get: function () { return this._selection; }
        },
        "hasBackgroundLayer": {
            get: function () { return this._hasBackgroundLayer; }
        },
        "layerTree": {
            get: function () { return this._layerTree; }
        }
    });

    /**
     * @type {number} Document ID
     */
    Document.prototype._id = null;

    /**
     * @type {string} Document name
     */
    Document.prototype._name = null;

    /**
     * @type {boolean} Number of layers in document
     */
    Document.prototype._numberOfLayers = null;

    /**
     * @type {boolean} True if there is a background layer (affects layer indexing)
     */
    Document.prototype._hasBackgroundLayer = null;

    /**
     * @type {Array.<number>} Array of layer indices currently selected in the document
     */
    Document.prototype._selection = null;

    /**
     * @type {LayerTree} The layers in a tree format
     */
    Document.prototype._layerTree = null;




    module.exports = Document;
});
