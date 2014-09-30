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
        initialize: function () {
            this._layerTreeMap = {};
            this._layerSetMap = {};
            this._layerArrayMap = {};
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayers,
                events.layers.VISIBILITY_CHANGED, this._handleVisibilityChange,
                events.layers.LOCK_CHANGED, this._handleLockChange,
                events.layers.SELECT_LAYER, this._handleLayerSelect
            );
        },

        getState: function () {
            return {
            };
        },

        /**
         * Passes the layer array to the updated document to be processed
         *
         * @private
         */
        _updateDocumentLayers: function (payload) {
            var documentID = payload.documentID,
                document = this.flux.store("document").getDocument(documentID);
                
            document._processLayers(payload.layerArray);

            this._layerTreeMap[documentID] = document.layerTree;
            this._layerSetMap[documentID] = document.layerSet;
            this._layerArrayMap[documentID] = document.layerArray;

            this.emit("change");
        },

        /**
         * On layer selection change, updates the layer structure correctly
         *
         * @private
         */
        _handleLayerSelect: function (payload) {
            var layerArray = this._layerArrayMap[payload.documentID];

            layerArray.forEach(function (layer) {
                layer._selected = _.contains(payload.targetLayers, layer.index - 1);
            });

            this.emit("change");
        },
        /**
         * When a layer visibility is toggled, updates the layer object
         */
        _handleVisibilityChange: function (payload) {
            var currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
                documentLayerSet = this._layerSetMap[currentDocumentID],
                updatedLayer = documentLayerSet[payload.id];

            updatedLayer._visible = payload.visible;

            this.emit("change");
        },
        /**
         * When a layer locking is changed, updates the corresponding layer object
         */
        _handleLockChange: function (payload) {
            var currentDocumentID = this.flux.store("application").getCurrentDocumentID(),
                documentLayerSet = this._layerSetMap[currentDocumentID],
                updatedLayer = documentLayerSet[payload.id];

            updatedLayer._locked = payload.locked;

            this.emit("change");
        },

        // These functions are not necessary... 
        // as we store these data structures in document model

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
        },
        /**
         * Returns the layer array for the given document ID
         * @private
         * @param {number} documentID
         * @returns {Array.<Object>} Layer array of given document
         */
        getLayerArray: function (documentID) {
            return this._layerArrayMap[documentID];
        }

    });
    module.exports = new LayerStore();
});
