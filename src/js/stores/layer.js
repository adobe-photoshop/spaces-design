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

    var Fluxxor = require("fluxxor"),
        _ = require("lodash"),
        events = require("../events");

    var LayerStore = Fluxxor.createStore({
        layerKinds: Object.defineProperties({}, {
            ANY: {
                writeable: false,
                enumerable: true,
                value:  0
            },
            PIXEL: {
                writeable: false,
                enumerable: true,
                value:  1
            },
            ADJUSTMENT: {
                writeable: false,
                enumerable: true,
                value:  2
            },
            TEXT: {
                writeable: false,
                enumerable: true,
                value:  3
            },
            VECTOR: {
                writeable: false,
                enumerable: true,
                value:  4
            },
            SMARTOBJECT: {
                writeable: false,
                enumerable: true,
                value:  5
            },
            VIDEO: {
                writeable: false,
                enumerable: true,
                value:  6
            },
            GROUP: {
                writeable: false,
                enumerable: true,
                value:  7
            },
            "3D": {
                writeable: false,
                enumerable: true,
                value:  8
            },
            GRADIENT: {
                writeable: false,
                enumerable: true,
                value:  9
            },
            PATTERN: {
                writeable: false,
                enumerable: true,
                value:  10
            },
            SOLIDCOLOR: {
                writeable: false,
                enumerable: true,
                value:  11
            },
            BACKGROUND: {
                writeable: false,
                enumerable: true,
                value:  12
            },
            GROUPEND: {
                writeable: false,
                enumerable: true,
                value:  13
            }
        }),

        /**
         * Photoshop gives us layers in a flat array with hidden endGroup layers
         * This function parses that array into a tree where layer's children
         * are in a children object, and each layer also have a parent object pointing at their parent
         * 
         * @private
         *
         * @param {Array.<Object>} layerArray Array of layer objects, it should be in order of PS layer indices
         *
         * @returns {Array.<Object>} Top level layers with rest under children
         */
        _makeLayerTree: function (layerArray) {
            var root = [],
                currentParent = null,
                depth = 0,
                layerKinds = this.flux.store("layer").layerKinds;

            layerArray.reverse();

            layerArray.forEach(function (layer) {
                layer.children = [];
                layer.parent = currentParent;
                layer.depth = depth;

                if (currentParent) {
                    currentParent.children.push(layer);
                } else {
                    root.push(layer);
                }
                
                // If we're encountering a groupend layer, we go up a level
                if (layer.layerKind === layerKinds.GROUPEND) {
                    // TODO: Assert to see if currentParent is null here, it should never be
                    currentParent = currentParent.parent;
                    depth--;
                } else if (layer.layerKind === layerKinds.GROUP) {
                    currentParent = layer;
                    depth++;
                }
            });

            return root;
        },

        initialize: function () {
            this._layerTreeMap = {};
            this._layerSetMap = {};
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayers,
                events.layers.VISIBILITY_CHANGED, this._handleVisibilityChange,
                events.layers.LOCK_CHANGED, this._handleLockChange
            );
        },

        getState: function () {
            return {
            };
        },

        /**
         * Processes the updated document and it's layer array to create:
         *  - Layer tree, an array of top level layers with other layers in children objects
         *  - Layer set, mapping of layer IDs to layer objects for quick access
         *  - Each layer will have selected true/false property
         *
         * @private
         */
        _updateDocumentLayers: function (payload) {
            var layerTree = this._makeLayerTree(payload.layerArray);
            var targetLayers = _.pluck(payload.document.targetLayers, "index");
            var layerSet = payload.layerArray.reduce(function (result, layer) {
                    // Mind the 1 offset of the index
                    layer.selected = _.contains(targetLayers, layer.itemIndex - 1);
                    result[layer.layerID] = layer;
                    return result;
                }, {});
            this._layerTreeMap[payload.document.documentID] = layerTree;
            this._layerSetMap[payload.document.documentID] = layerSet;

        },
        /**
         * When a layer visibility is toggled, updates the layer object
         */
        _handleVisibilityChange: function (payload) {
            var currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
                documentLayerSet = this._layerSetMap[currentDocumentID],
                updatedLayer = documentLayerSet[payload.id];

            updatedLayer.visible = payload.visible;

            this.emit("change");
        },
        /**
         * When a layer locking is changed, updates the corresponding layer object
         */
        _handleLockChange: function (payload) {
            var currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
                documentLayerSet = this._layerSetMap[currentDocumentID],
                updatedLayer = documentLayerSet[payload.id];

            updatedLayer.layerLocking.value.protectAll = payload.locked;

            this.emit("change");
        },
        /**
         * Returns the layer tree for the given document ID
         * @private
         * @param {number} documentID
         * @returns {Array.<Object>} top level layers in the document with rest of the layer tree
         * under children objects
         */
        getLayerTree: function (documentID) {
            return this._layerTreeMap[documentID];
        },
        /**
         * Returns the layer set for the given document ID
         * @private
         * @param {number} documentID
         * @returns {Object.<{number: Object}>} Layers mapped by ID
         * under children objects
         */
        getLayerSet: function (documentID) {
            return this._layerSetMap[documentID];
        }
    });
    module.exports = new LayerStore();
});
