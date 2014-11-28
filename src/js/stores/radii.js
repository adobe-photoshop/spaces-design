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
        Radii = require("../models/radii");

    var RadiiStore = Fluxxor.createStore({

        /**
         * A map from document ID to layer ID to Radii.
         *
         * @private
         * @type {Object.<number, Object.<number, Radii>}
         */
        _layerRadii: null,

        initialize: function () {
            this._layerRadii = {};

            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayerRadii,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._updateDocumentLayerRadii,
                events.documents.RESET_DOCUMENTS, this._resetAllDocumentLayerRadii,
                events.documents.CLOSE_DOCUMENT, this._deleteDocumentRadii,
                events.transform.RADII_CHANGED, this._radiiChanged
            );
        },

        getState: function () {
            return {};
        },

        /** 
         * Gets the radii of specified layer in the specified document
         *
         * @param {number} documentID
         * @param {number} layerID
         * @return {Radii}
         */
        getRadii: function (documentID, layerID) {
            return this._layerRadii[documentID][layerID];
        },

        /**
         * Set the radii for the given layers in the given document.
         * 
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, radii: object}} payload
         */
        _radiiChanged: function (payload) {
            var layerRadii = this._layerRadii[payload.documentID],
                radiiDescriptor = payload.radii;

            payload.layerIDs.forEach(function (layerID) {
                layerRadii[layerID] = new Radii(radiiDescriptor);
            });

            this.emit("change");
        },

        /**
         * Update the radii for all layers in the document
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         * @param {boolean} silent optional: If true, don't emit a change event
         */
        _updateDocumentLayerRadii: function (payload, silent) {
            var rawDocument = payload.document,
                documentID = rawDocument.documentID,
                layerArray = payload.layers;

            this._layerRadii[documentID] = layerArray.reduce(function (radiiMap, layerObj) {
                if (Radii.hasRadii(layerObj)) {
                    radiiMap[layerObj.layerID] = new Radii(layerObj);
                }
                return radiiMap;
            }, {});

            if (!silent) {
                this.emit("change");
            }
        },

        /**
         * Completely reset all the radii for all layers in all documents
         *
         * @private
         * @param {Array.<{document: object, layers: Array.<object>}>} payload
         */
        _resetAllDocumentLayerRadii: function (payload) {
            payload.documents.forEach(function (docObj) {
                this._updateDocumentLayerRadii(docObj, true);
            }, this);

            this.emit("change");
        },

        /**
         * Delete the radii of this document and its layers 
         * @private
         * @param  {{documentID: number}} payload
         */
        _deleteDocumentRadii: function (payload) {
            delete this._layerRadii[payload.documentID];

            this.emit("change");
        }
    });
    module.exports = RadiiStore;
});
