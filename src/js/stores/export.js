/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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
        Immutable = require("immutable");

    var DocumentExports = require("js/models/documentexports"),
        events = require("../events");

    var ExportStore = Fluxxor.createStore({

        /**
         * Map of export assets, keyed by the document ID
         * @type {Immutable.Map<number, DocumentExports>}
         */
        _documentExportsMap: null,

        /**
         * Export Service is available?
         * @type {boolean}
         */
        _serviceAvailable: false,

        /**
         * Loads saved preferences from local storage and binds flux actions.
         */
        initialize: function () {
            this._documentExportsMap = new Immutable.Map();
            
            // TODO listen for delete doc/layer?
            this.bindActions(
                events.RESET, this._deleteExports,
                events.export.ASSET_CHANGED, this._assetUpdated,
                events.export.DELETE_LAYER_ASSET, this._deleteLayerAsset,
                events.export.SET_AS_REQUESTED, this._setAssetsRequested,
                events.export.SERVICE_STATUS_CHANGED, this._serviceStatusChanged,
                events.document.DOCUMENT_UPDATED, this._documentUpdated
            );
        },

        /**
         * Test for the existence any exports for the given document ID
         * TODO this could be smarter.  also, still needed?
         *
         * @param {number} documentID
         * @return {boolean}
         */
        documentHasExports: function (documentID) {
            return this._documentExportsMap.has(documentID);
        },

        /**
         * Get the DocumentExports model object associated to the provided documentID
         *
         * @param {number} documentID
         * @return {?DocumentExports}
         */
        getDocumentExports: function (documentID) {
            return this._documentExportsMap.get(documentID);
        },

        /**
         * Standard flux store state getter, primarily for the serviceAvailable flag
         *
         * @return {{serviceAvailable: boolean}}
         */
        getState: function () {
            return {
                serviceAvailable: this._serviceAvailable
            };
        },

        /**
         * Event handler: Sets the serviceAvailable flag based on the provided payload
         *
         * @private
         * @param {{serviceAvailable: boolean}} payload
         */
        _serviceStatusChanged: function (payload) {
            this._serviceAvailable = !!payload.serviceAvailable;
            this.emit("change");
        },

        /**
         * Event handler: Upon a document update, populate the exports based on the photoshop metadata
         *
         * @private
         * @param {object} payload document descriptor
         */
        _documentUpdated: function (payload) {
            var documentID = payload.document.documentID,
                documentExports = DocumentExports.fromDescriptors(payload);

            this._documentExportsMap = this._documentExportsMap.set(documentID, documentExports);
        },

        /**
         * Event handler: Insert/Update export assets for the given document
         * This is a new approach to updating assets, which uses a sparse array of asset props
         * It is incumbent upon the caller to add NEW assets at the appropriate index
         * Missing props will be ignored
         * 
         * @private
         * @param {{documentID: !number, layerIDs: number|Array.<number>, assetPropArray: Array.<object>}} payload 
         */
        _assetUpdated: function (payload) {
            var documentID = payload.documentID,
                layerIDs = Array.isArray(payload.layerIDs) ? payload.layerIDs : [payload.layerIDs];

            if (!documentID) {
                throw new Error ("Can not update an asset without a valid documentID (%s)", documentID);
            }

            var curDocumentExports = this.getDocumentExports(documentID) || new DocumentExports(),
                nextDocumentExports = curDocumentExports.mergeLayerAssets(layerIDs, payload.assetPropsArray);

            if (!curDocumentExports.equals(nextDocumentExports)) {
                this._documentExportsMap = this._documentExportsMap.set(documentID, nextDocumentExports);
                this.emit("change");
            }
        },

        /**
         * Event handler: Delete the layer's asset at the given index
         *
         * @private
         * @param {{documentID: number, layerID: number, assetIndex: number}} payload
         */
        _deleteLayerAsset: function (payload) {
            var documentID = payload.documentID,
                layerID = payload.layerID,
                assetIndex = payload.assetIndex;

            if (!documentID || !layerID || !Number.isFinite(assetIndex)) {
                throw new Error("Can not delete asset without all three payload values %s, %s, %s",
                    documentID, layerID, assetIndex);
            }

            var curDocumentExports = this.getDocumentExports(documentID) || new DocumentExports(),
                nextDocumentExports = curDocumentExports.removeLayerAsset(layerID, assetIndex);

            if (!curDocumentExports.equals(nextDocumentExports)) {
                this._documentExportsMap = this._documentExportsMap.set(documentID, nextDocumentExports);
                this.emit("change");
            }
        },

        /**
         * Event handler: For the given document and set of layers, mark the associated assets as "requested"
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>}} payload [description]
         */
        _setAssetsRequested: function (payload) {
            var documentID = payload.documentID,
                layerIDs = Immutable.Set(payload.layerIDs);

            if (!documentID) {
                throw new Error("Can not set document assets as 'requested' without a documentID");
            }

            var curDocumentExports = this.getDocumentExports(documentID) || new DocumentExports(),
                nextDocumentExports = curDocumentExports.setLayerExportsRequested(layerIDs);

            if (!curDocumentExports.equals(nextDocumentExports)) {
                this._documentExportsMap = this._documentExportsMap.set(documentID, nextDocumentExports);
                this.emit("change");
            }
        },

        /**
         * Event handler: Nuke the entire data structure
         * @private
         */
        _deleteExports: function () {
            this._documentExportsMap = new Immutable.Map();
        }

    });

    module.exports = ExportStore;
});
