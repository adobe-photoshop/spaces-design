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

    var Layer = require("./layer");

    /**
     * Given a raw array of layers, will construct the layer tree
     * and create the Layer objects
     * 
     * @constructor
     * @param {object} rawDocument
     * @param {Array.<object>} rawLayers
     */
    var LayerTree = function (rawDocument, rawLayers) {
        this._layerArray = [];
        this._layerSet = {};
        this._processLayers(rawDocument, rawLayers);
        this._hasBackgroundLayer = rawDocument.hasBackgroundLayer;
        this._numberOfLayers = rawDocument.numberOfLayers;
    };

    Object.defineProperties(LayerTree.prototype, {
        "topLayers": {
            get: function () { return this._topLayers; }
        },
        "layerSet": {
            get: function () { return this._layerSet; }
        },
        "layerArray": {
            get: function () {return this._layerArray; }
        },
        "hasBackgroundLayer": {
            get: function () {return this._hasBackgroundLayer; }
        },
        "numberOfLayers": {
            get: function () {return this._numberOfLayers; }
        }
    });

    /**
     * @private
     * @type {Array.<Layer>}
     */
    LayerTree.prototype._topLayers = null;

    /**
     * @private
     * @type {Array.<Layer>}
     */
    LayerTree.prototype._layerArray = null;

    /**
     * @private
     * @type {Object.<number>} ID look up table for layers in the tree
     */
    LayerTree.prototype._layerSet = null;

    /**
     * @private
     * @type {number} Number of layers in the tree
     */
    LayerTree.prototype._numberOfLayers = null;

    /**
     * @private
     * @type {boolean} Whether or not there is a background layer in the layer tree
     */
    LayerTree.prototype._hasBackgroundLayer = null;

    /**
     * Photoshop gives us layers in a flat array with hidden endGroup layers
     * This function parses that array into a tree where layer's children
     * are in a children object, and each layer also have a parent object pointing at their parent
     * 
     * It also saves the layers into a map of id lookup table, and the flat array
     * @private
     *
     * @param {object} rawDocument Document descriptor
     * @param {Array.<object>} rawLayers Array of layer descriptors in order of PS layer indices
     *
     */
    LayerTree.prototype._processLayers = function (rawDocument, rawLayers) {
        var root = [],
            currentParent = null,
            depth = 0,
            layer = null;

        rawLayers.forEach(function (layerObj) {
            layer = new Layer(layerObj);

            // Add it to other data structures
            this._layerArray.push(layer);
            this._layerSet[layer.id] = layer;
            
            layer._children = [];
            layer._parent = currentParent;
            layer._depth = depth;
            
            if (currentParent) {
                currentParent._children.push(layer);
            } else {
                root.push(layer);
            }
            
            // If we're encountering a groupend layer, we go up a level
            if (layer.kind === layer.layerKinds.GROUPEND) {
                // TODO: Assert to see if currentParent is null here, it should never be
                currentParent = currentParent.parent;
                depth--;
            } else if (layer.kind === layer.layerKinds.GROUP) {
                currentParent = layer;
                depth++;
            }
        }.bind(this));

        this._topLayers = root;

        // puts the layers in index order
        this._layerArray.reverse();

        // Since PS starts indices by 1 for layers, we're adding an undefined layer at the start
        // Only time a layer index is 0 is when we're referencing TO the background layer in an image
        // Document.targetLayers will always be 0 indexed, and are layer agnostic
        this._layerArray.unshift(null);
        delete this._layerArray[0];

        // update the selection property of selected layers
        var selectedIndices = rawDocument.targetLayers || [];
        selectedIndices.forEach(function (obj) {
            this._layerArray[obj.index + 1]._selected = true;
        }, this);
    };

    module.exports = LayerTree;
});
