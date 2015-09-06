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
        Immutable = require("immutable"),
        _ = require("lodash");

    var DocumentExports = require("js/models/documentexports"),
        events = require("../events");

    /**
     * Holding cell for various state properties
     *
     * @type {Immutable.Record}
     */
    var State = Immutable.Record({
        /**
         * Export Service is available?
         * @type {boolean}
         */
        serviceAvailable: false,

        /**
         * Export Service is busy?
         * @type {boolean}
         */
        serviceBusy: false,

        /**
         * that
         * @type {boolean}
         */
        useArtboardPrefix: false
    });

    var ExportStore = Fluxxor.createStore({

        /**
         * Map of export assets, keyed by the document ID
         * @type {Immutable.Map<number, DocumentExports>}
         */
        _documentExportsMap: null,

        /**
         * state
         *
         * @type {State}
         */
        _state: new State(),

        /**
         * Loads saved preferences from local storage and binds flux actions.
         */
        initialize: function () {
            this._documentExportsMap = new Immutable.Map();
            
            // TODO listen for delete doc/layer?
            this.bindActions(
                events.RESET, this._deleteExports,
                events.export.ASSET_CHANGED, this._assetUpdated,
                events.export.history.optimistic.ASSET_CHANGED, this._assetUpdated,
                events.export.history.optimistic.ASSET_ADDED, this._assetAdded,
                events.export.history.optimistic.DELETE_ASSET, this._deleteAsset,
                events.export.SET_AS_REQUESTED, this._setAssetsRequested,
                events.export.SERVICE_STATUS_CHANGED, this._setState,
                events.export.SET_STATE_PROPERTY, this._setState,
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
         * @param {boolean=} initialize Optional, if true then create documentExports on the fly if necessary
         * @return {?DocumentExports}
         */
        getDocumentExports: function (documentID, initialize) {
            var documentExports = this._documentExportsMap.get(documentID);
            if (!documentExports && initialize) {
                return new DocumentExports();
            } else {
                return documentExports;
            }
        },

        /**
         * Update a given DocumentExports
         * This should only be called by other stores.
         *
         * @param {number} documentID
         * @param {DocumentExports} nextDocumentExports
         */
        setDocumentExports: function (documentID, nextDocumentExports) {
            var oldDocumentExports = this.getDocumentExports(documentID);

            if (Immutable.is(oldDocumentExports, nextDocumentExports)) {
                return;
            }

            this._documentExportsMap = this._documentExportsMap.set(documentID, nextDocumentExports);
            this.emit("change");
        },

        /**
         * Standard flux store state getter, primarily for the serviceAvailable flag
         *
         * @return {{serviceAvailable: boolean}}
         */
        getState: function () {
            return this._state;
        },

        /**
         * Generate a prefix for the given layer, based on the index,
         * using the internal state to determine if a prefix is warranted;
         * null otherwise
         *
         * @param {Layer} layer
         * @param {number} index
         * @return {?string}
         */
        getExportPrefix: function (layer, index) {
            if (this._state.useArtboardPrefix && layer.isArtboard) {
                return _.padLeft(index + 1, 3, "0");
            }
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
         * @param {object} payload
         * @param {!number} payload.documentID
         * @param {Immutable.Iterable.<number>=} payload.layerIDs
         * @param {Array.<object>} payload.assetPropArray
         */
        _assetUpdated: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs;

            if (!documentID) {
                throw new Error("Can not update an asset without a valid documentID (%s)", documentID);
            }

            var curDocumentExports = this.getDocumentExports(documentID) || new DocumentExports(),
                nextDocumentExports;

            if (layerIDs) {
                nextDocumentExports = curDocumentExports.mergeLayerAssets(layerIDs, payload.assetPropsArray);
            } else {
                nextDocumentExports = curDocumentExports.mergeRootAssets(payload.assetPropsArray);
            }
            
            if (!curDocumentExports.equals(nextDocumentExports)) {
                this._documentExportsMap = this._documentExportsMap.set(documentID, nextDocumentExports);
                this.emit("change");
            }
        },

        /**
         * Event handler: Insert export assets for the given document
         * Given an array of props, splice them in to the existing layer or document asset list
         * 
         * @private
         * @param {object} payload
         * @param {!number} payload.documentID
         * @param {Immutable.Iterable.<number>=} payload.layerIDs
         * @param {Array.<object>} payload.assetPropArray
         * @param {number} payload.assetIndex
         */
        _assetAdded: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                props = payload.assetPropsArray,
                assetIndex = payload.assetIndex;

            if (!documentID) {
                throw new Error("Can not update an asset without a valid documentID (%s)", documentID);
            }

            var curDocumentExports = this.getDocumentExports(documentID) || new DocumentExports(),
                nextDocumentExports;

            if (layerIDs) {
                nextDocumentExports = curDocumentExports.spliceLayerAssets(layerIDs, props, assetIndex);
            } else {
                nextDocumentExports = curDocumentExports.spliceRootAssets(props, assetIndex);
            }
            
            if (!curDocumentExports.equals(nextDocumentExports)) {
                this._documentExportsMap = this._documentExportsMap.set(documentID, nextDocumentExports);
                this.emit("change");
            }
        },

        /**
         * Event handler: Delete an asset at the given index
         * If layerIDs is provided, delete assets in layers with these IDs
         * Otherwise delete a root asset
         *
         * @private
         * @param {{documentID: number, layerIDs: Immutable.Iterable.<number>=, assetIndex: number}} payload
         */
        _deleteAsset: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                assetIndex = payload.assetIndex;

            if (!documentID || !Number.isFinite(assetIndex)) {
                throw new Error("Can not delete asset without a doc and a valid asset index: %s, %s",
                    documentID, assetIndex);
            }

            var curDocumentExports = this.getDocumentExports(documentID) || new DocumentExports(),
                nextDocumentExports;

            if (layerIDs) {
                nextDocumentExports = curDocumentExports.removeLayerAsset(layerIDs, assetIndex);
            } else {
                nextDocumentExports = curDocumentExports.removeRootAsset(assetIndex);
            }

            if (!curDocumentExports.equals(nextDocumentExports)) {
                this._documentExportsMap = this._documentExportsMap.set(documentID, nextDocumentExports);
                this.emit("change");
            }
        },

        /**
         * Helper function that updates some assets into the "requested" status
         * If layerIDs is supplied then layers' assets will be updated
         * Otherwise, the root level assets are updated
         *
         * @private
         * @param {{documentID: number, layerIDs: Immutable.Iterable.<number>=}} payload [description]
         */
        _setAssetsRequested: function (payload) {
            var documentID = payload.documentID;

            if (!documentID) {
                throw new Error("Can not set document assets as 'requested' without a documentID");
            }

            var curDocumentExports = this.getDocumentExports(documentID) || new DocumentExports(),
                nextDocumentExports;

            if (payload.hasOwnProperty("layerIDs")) {
                nextDocumentExports = curDocumentExports.setLayerExportsRequested(payload.layerIDs);
            } else {
                nextDocumentExports = curDocumentExports.setRootExportsRequested();
            }

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
        },

        /**
         * Event handler: Update internal state properties
         *
         * @param {object} payload State-like object
         */
        _setState: function (payload) {
            var newState = this._state.merge(payload);
            if (newState !== this._state) {
                this._state = newState;
                this.emit("change");
            }
        }
    });

    module.exports = ExportStore;
});
