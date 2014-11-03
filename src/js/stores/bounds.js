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
        Bounds = require("../models/bounds"),
        log = require("js/util/log");

    var BoundsStore = Fluxxor.createStore({
        initialize: function () {
            this._layerBounds = {};
            this._documentBounds = {};
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayerBounds,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._updateDocumentLayerBounds,
                events.documents.RESET_DOCUMENTS, this._resetAllDocumentLayerBounds,
                events.documents.CLOSE_DOCUMENT, this._deleteDocumentBounds,
                events.transform.TRANSLATE_LAYERS, this._handleLayerTranslate,
                events.transform.RESIZE_LAYERS, this._handleLayerResize,
                events.transform.RESIZE_DOCUMENT, this._handleDocumentResize
            );
        },

        getState: function () {
            return {};
        },

        /** 
         * Gets the bounds of the document with the ID
         * @param {number} documentID
         * @return {Bounds}
         */
        getDocumentBounds: function (documentID) {
            return this._documentBounds[documentID];
        },

        /** 
         * Gets the bounds of specified layer in the specified document
         * @param {number} documentID
         * @param {number} layerID
         * @return {Bounds}
         */
        getLayerBounds: function (documentID, layerID) {
            return this._layerBounds[documentID][layerID];
        },

        /** 
         * Given a layer group, that has children bounds already calculated
         * Calculates the bounds of the group
         * Must be called in the right order during initialization, hence it is protected
         * @protected
         *
         * @param {number} documentID
         * @param {Layer} layer Layer Group bounds are calculated for
         * @return {Bounds}
         */
        calculateGroupBounds: function (documentID, layer) {
            var _unionBounds = function (group, child) {
                if (!group) {
                    return new Bounds(child);
                } else if (!child) {
                    throw new Error ("Layer with no boundaries defined.")
                }

                // Since we're collecting on the group's bounds, we can edit those
                group._top = Math.min(group.top, child.top);
                group._left = Math.min(group.left, child.left);
                group._bottom = Math.max(group.bottom, child.bottom);
                group._right = Math.max(group.right, child.right);
                group._height = group.bottom - group.top;
                group._width = group.right - group.left;

                return group;
            };

            var groupBounds = layer.children.reduce(function (bounds, child) {
                // Skip the group ends
                if (child.kind === child.layerKinds.GROUPEND) {
                    return bounds;
                }

                return _unionBounds(bounds, child.bounds);
            }, null);

            this._layerBounds[documentID][layer.id] = groupBounds;

            return groupBounds;
        },

        /**
         * Update the bounds bounds for all layers in the document
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         */
        _updateDocumentLayerBounds: function (payload) {
            var rawDocument = payload.document,
                documentID = rawDocument.documentID,
                layerArray = payload.layers;

            this._documentBounds[documentID] = new Bounds(rawDocument);

            this._layerBounds[documentID] = layerArray.reduce(function (boundsMap, layerObj) {
                boundsMap[layerObj.layerID] = new Bounds(layerObj);
                return boundsMap;
            }, {});

            this.emit("change");
        },

        /**
         * Completely reset all the bounds for all layers in all documents
         *
         * @private
         * @param {Array.<{document: object, layers: Array.<object>}>} payload
         */
        _resetAllDocumentLayerBounds: function (payload) {
            payload.documents.forEach(function (docObj) {
                var rawDocument = docObj.document,
                    documentID = rawDocument.documentID,
                    layerArray = docObj.layers;

                this._documentBounds[documentID] = new Bounds(rawDocument);

                this._layerBounds[documentID] = layerArray.reduce(function (boundsMap, layerObj) {
                    boundsMap[layerObj.layerID] = new Bounds(layerObj);
                    return boundsMap;
                }, {});
            }, this);

            this.emit("change");
        },

        /**
         * Update the bounds of affected layers
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, position: {x: number, y: number}}} payload
         */
        _handleLayerTranslate: function (payload) {
            payload.layerIDs.forEach(function (layerID) {
                var layerBounds = this._layerBounds[payload.documentID][layerID];
                layerBounds._setPosition(payload.position.x, payload.position.y);
            }, this);

            this.emit("change");
        },

        /**
         * Update the bounds of affected layers
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, size: {w: number, h: number}}} payload
         */
        _handleLayerResize: function (payload) {
            payload.layerIDs.forEach(function (layerID) {
                var layerBounds = this._layerBounds[payload.documentID][layerID];
                layerBounds._setSize(payload.size.w, payload.size.h);
            }, this);

            this.emit("change");
        },

        /**
         * Update the bounds of the document
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, size: {w: number, h: number}}} payload
         */
        _handleDocumentResize: function (payload) {
            var documentBounds = this._documentBounds[payload.documentID];
            
            documentBounds._setSize(payload.size.w, payload.size.h);
            this.emit("change");
        },

        /**
         * Delete the bounds of this document and its layers 
         * @private
         * @param  {{documentID: number}} payload
         */
        _deleteDocumentBounds: function (payload) {
            var documentID = payload.documentID;
            
            delete this._layerBounds[documentID];
            delete this._documentBounds[documentID];

            this.emit("change");
        }


    });
    module.exports = BoundsStore;
});
