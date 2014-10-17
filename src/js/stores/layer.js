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
        _ = require("lodash");
        
    var LayerTree = require("../models/LayerTree"),
        Layer = require("../models/Layer"),
        events = require("../events"),
        log = require("js/util/log");


    var LayerStore = Fluxxor.createStore({
        initialize: function () {
            this._layerTreeMap = {};
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayers,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._updateDocumentLayers,
                events.documents.RESET_DOCUMENTS, this._resetDocumentLayers,
                events.layers.VISIBILITY_CHANGED, this._handleVisibilityChange,
                events.layers.LOCK_CHANGED, this._handleLockChange,
                events.layers.SELECT_LAYERS_BY_ID, this._handleLayerSelectByID,
                events.layers.SELECT_LAYERS_BY_INDEX, this._handleLayerSelectByIndex,
                events.layers.DESELECT_ALL, this._handleLayerDeselect,
                events.layers.REORDER_LAYERS, this._handleLayerReorder,
                events.layers.RENAME_LAYER, this._handleLayerRename,
                events.layers.GROUP_SELECTED, this._handleGroupLayers
            );
        },

        getState: function () {
            return {};
        },

        /**
         * Construct a LayerTree model from the given document and layer descriptors.
         * 
         * @private
         * @param {{document: object, layers: Array.<object>}} docObj
         * @return {LayerTree}
         */
        _makeLayerTree: function (docObj) {
            var rawDocument = docObj.document,
                rawLayers = docObj.layers,
                layerArray = rawLayers.map(function (layerObj) { return new Layer(layerObj); }),
                layerTree = new LayerTree(rawDocument, layerArray);

            return layerTree;
        },

        /**
         * Payload contains the array of layer IDs after reordering,
         * Sends it to layertree model to rebuild the tree
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>}} payload
         *
         */
        _handleLayerReorder: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                layerTree = this._layerTreeMap[documentID];

            layerTree.updateLayerOrder(layerIDs);

            this.emit("change");

        },

        /**
         * Reset the LayerTree model for the given document and layer descriptors.
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         */
        _updateDocumentLayers: function (payload) {
            this.waitFor(["bounds"], function () {
                var documentID = payload.document.documentID,
                    boundsStore = this.flux.store("bounds"),
                    layerTree = this._makeLayerTree(payload);

                layerTree.forEach(function (layer) {
                    layer._bounds = boundsStore.getLayerBounds(documentID, layer.id);
                });
                
                this._layerTreeMap[documentID] = layerTree;

                this.emit("change");
            });
        },

        /**
         * Completely reset all the LayerTree models for the given documents and
         * layer descriptors.
         *
         * @private
         * @param {Array.<{document: object, layers: Array.<object>}>} payload
         */
        _resetDocumentLayers: function (payload) {
            this.waitFor(["bounds"], function () {
                var boundsStore = this.flux.store("bounds");

                this._layerTreeMap = payload.documents.reduce(function (layerTreeMap, docObj) {
                    var rawDocument = docObj.document,
                        documentID = rawDocument.documentID,
                        layerTree = this._makeLayerTree(docObj);

                    layerTree.forEach(function (layer) {
                        layer._bounds = boundsStore.getLayerBounds(documentID, layer.id);
                    });

                    layerTreeMap[documentID] = layerTree;
                    return layerTreeMap;
                }.bind(this), {});

                this.emit("change");
            });
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

            layerTree.layerArray.forEach(function (layer) {
                layer._selected = _.contains(selectedIndices, layer.index - 1);
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
            var currentDocument = this.flux.store("application").getCurrentDocument(),
                documentLayerSet = this._layerTreeMap[currentDocument.id].layerSet,
                updatedLayer = documentLayerSet[payload.id];

            updatedLayer._visible = payload.visible;

            this.emit("change");
        },

        /**
         * When a layer locking is changed, updates the corresponding layer object
         */
        _handleLockChange: function (payload) {
            var currentDocument = this.flux.store("application").getCurrentDocument(),
                documentLayerSet = this._layerTreeMap[currentDocument.id].layerSet,
                updatedLayer = documentLayerSet[payload.id];

            updatedLayer._locked = payload.locked;

            this.emit("change");
        },

        /**
         * Rename the given layer in the given document.
         * 
         * @private
         * @param {{documentID: number, layerID: number, newName: string}} payload
         */
        _handleLayerRename: function (payload) {
            var documentID = payload.documentID,
                layerID = payload.layerID,
                newName = payload.newName,
                layerTree = this._layerTreeMap[documentID],
                layer = layerTree.layerSet[layerID];

            layer._name = newName;

            this.emit("change");
        },

        /**
         * Create a new group layer in the given document that contains the
         * currently selected layers.
         * 
         * @private
         */
        _handleGroupLayers: function () {
            log.warn("Group layers is not implemented in models!");
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
         * Returns all currently selected layers of the currently active layer tree
         * @return {Array.<Layer>} Currently selected layers of the current document
         */
        getActiveSelectedLayers: function () {
            var currentDocument = this.flux.store("application").getCurrentDocument(),
                currentLayerArray = currentDocument ? this._layerTreeMap[currentDocument.id].layerArray : [];

            return currentLayerArray.filter(function (layer) {
                return layer.selected;
            });
        }

    });
    module.exports = LayerStore;
});
