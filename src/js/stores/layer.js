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
        events = require("../events"),
        LayerTree = require("../models/LayerTree"),
        _ = require("lodash");

    var LayerStore = Fluxxor.createStore({
        initialize: function () {
            this._layerTreeMap = {};
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayers,
                events.layers.VISIBILITY_CHANGED, this._handleVisibilityChange,
                events.layers.LOCK_CHANGED, this._handleLockChange,
                events.layers.SELECT_LAYERS_BY_ID, this._handleLayerSelectByID,
                events.layers.SELECT_LAYERS_BY_INDEX, this._handleLayerSelectByIndex,
                events.layers.DESELECT_ALL, this._handleLayerDeselect
            );
        },

        getState: function () {
            return {};
        },

        /**
         * Passes the layer array to the updated document to be processed
         *
         * @private
         */
        _updateDocumentLayers: function (payload) {
            var rawDocument = payload.document,
                rawLayers = payload.layerArray,
                layerTree = new LayerTree(rawDocument, rawLayers);
            
            this._layerTreeMap[rawDocument.documentID] = layerTree;
        },

        /**
         * Update selection state of layer models, referenced by id.
         *
         * @private
         * @param {{documentID: number, selectedIDs: Array.<number>}} payload
         */
        _handleLayerSelectByID: function (payload) {
            var layerTree = this._layerTreeMap[payload.documentID],
                selectedIDs = payload.selectedIDs,
                selectedIDSet = selectedIDs.reduce(function (set, id) {
                    set[id] = true;
                    return set;
                }, {});

            layerTree.layerArray.forEach(function (layer) {
                layer._selected = _.has(selectedIDSet, layer.id);
            });

            this.emit("change");
        },

        /**
         * Update selection state of layer models, referenced by index.
         *
         * @private
         * @param {{documentID: number, selectedIndices: Array.<number>}} payload
         */
        _handleLayerSelectByIndex: function (payload) {
            var layerTree = this._layerTreeMap[payload.documentID],
                selectedIndices = payload.selectedIndices;

            layerTree.layerArray.forEach(function (layer, index) {
                layer._selected = _.has(selectedIndices, index);
            });

            this.emit("change");
        },

        /**
         * Unset selection state of all layer models.
         *
         * @private
         * @param {{documentID: number}} payload
         */
        _handleLayerDeselect: function (payload) {
            var layerTree = this._layerTreeMap[payload.documentID];

            layerTree.layerArray.forEach(function (layer) {
                layer._selected = false;
            });

            this.emit("change");
        },
        /**
         * When a layer visibility is toggled, updates the layer object
         */
        _handleVisibilityChange: function (payload) {
            var currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
                documentLayerSet = this._layerTreeMap[currentDocumentID].layerSet,
                updatedLayer = documentLayerSet[payload.id];

            updatedLayer._visible = payload.visible;

            this.emit("change");
        },
        /**
         * When a layer locking is changed, updates the corresponding layer object
         */
        _handleLockChange: function (payload) {
            var currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
                documentLayerSet = this._layerTreeMap[currentDocumentID].layerSet,
                updatedLayer = documentLayerSet[payload.id];

            updatedLayer._locked = payload.locked;

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
        }
    });
    module.exports = new LayerStore();
});
