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
     * Given a raw array of layers, will construct the layer tree
     * and create the Layer objects
     * 
     * @constructor
     * @param {object} rawDocument
     * @param {Array.<Layer>} layerArray Array of the layers in document
     */
    var LayerTree = function (rawDocument, layerArray) {
        this._layerArray = layerArray;

        this._layerSet = layerArray.reduce(function (layerMap, layer) {
            layerMap[layer.id] = layer;
            return layerMap;
        }, {});

        // puts the layers in index order
        this._layerArray.reverse();

        // Since PS starts indices by 1 for layers, we're adding an undefined layer at the start
        // Only time a layer index is 0 is when we're referencing TO the background layer in an image
        // Document.targetLayers will always be 0 indexed, and are layer agnostic
        this._layerArray.unshift(null);
        delete this._layerArray[0];
        
        this._buildTree();
        this._updateSelection(rawDocument.targetLayers);
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
     * This function parses the layer array into a tree where layer's children
     * are in a children object, and each layer also have a parent object pointing at their parent
     * 
     * @private
     */
    LayerTree.prototype._buildTree = function () {
        var root = [],
            currentParent = null,
            depth = 0;

        _.forEachRight(this._layerArray, function (layer) {
            if (!layer) {
                return;
            }
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

        
    };

    /**
     * Given the targetLayers property of a document
     * Will mark the selected layers in the tree
     *
     * @private
     * @param {Array.<object>} targetLayers
     */
    LayerTree.prototype._updateSelection = function (targetLayers) {
        // update the selection property of selected layers
        var selectedIndices = targetLayers || [];
        selectedIndices.forEach(function (obj) {
            this._layerArray[obj.index + 1]._selected = true;
        }, this);
    };

    /**
     * Given the new layer ID array after a reorder
     * sorts the layer array, and rebuilds the layer tree
     * This function does not check to see if layer IDs are valid
     * buildTree might fail if a group end layer is encountered unexpectedly
     *
     * @param {Array.<number>} layerIDs Layer IDs in the document order
     */
    LayerTree.prototype.updateLayerOrder = function (layerIDs) {
        this._layerArray = layerIDs.map(function (id, index) {
            var layer = this._layerSet[id];
            layer._index = layerIDs.length - index;
            return layer;
        }, this);

        // puts the layers in index order
        this._layerArray.reverse();

        // Since PS starts indices by 1 for layers, we're adding an undefined layer at the start
        // Only time a layer index is 0 is when we're referencing TO the background layer in an image
        // Document.targetLayers will always be 0 indexed, and are layer agnostic
        this._layerArray.unshift(null);
        delete this._layerArray[0];

        this._buildTree();
    };

    /**
     * Wrapper for Array.prototype.forEach on layerArray, 
     * Later on we can replace this with a traversal function
     *
     * @param {Function} callback Function to execute for each element
     * @param {Object} thisArg Value to use as this when executing callback
     */
    LayerTree.prototype.forEach = function (callback, thisArg) {
        return this._layerArray.forEach(callback, thisArg);
    };

    /**
     * Wrapper for Array.prototype.map on layerArray, 
     * Later on we can replace this with a traversal function
     *
     * @param {Function} callback Function to execute for each element
     * @param {Object} thisArg Value to use as this when executing callback
     */
    LayerTree.prototype.map = function (callback, thisArg) {
        return this._layerArray.map(callback, thisArg);
    };

    /**
     * Returns the layer with the given ID from the tree
     */
    LayerTree.prototype.getLayerByID = function (id) {
        return this._layerSet[id];
    };

    module.exports = LayerTree;
});
