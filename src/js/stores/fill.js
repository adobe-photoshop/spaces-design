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
        Fill = require("../models/Fill"),
        contentLayerLib = require("adapter/lib/contentLayer"),
        log = require("js/util/log"),
        objUtil = require("js/util/object"),
        _ = require("lodash");

    var _fillModelArrayFromLayer = function (documentID, layerDescriptor) {
        var adjustment = layerDescriptor.adjustment && layerDescriptor.adjustment[0];

        // TODO this should be smarter about handling gradient and pattern fills... but maybe still ONLY those
        if (adjustment) {
            try {
                return [new Fill({
                        color: objUtil.getPath(adjustment, "value.color.value"),
                        type: adjustment.obj,
                        fillEnabled: layerDescriptor.fillEnabled,
                        fillOpacity: layerDescriptor.fillOpacity
                    })];
            } catch (e) {
                log.error("Could not build a Fill for doc %s / layer %s >> %s",
                    documentID, layerDescriptor.layerID, e.message);
                return [];
            }
        } else {
            return [];
        }
    };

    var FillStore = Fluxxor.createStore({

        /**
         * Internal Map of (Document, Layer) > Fills
         * @private
         * @type {Object.<number, Object.<number, Array<Fill>>}
         */
        _layerFills: null,

        initialize: function () {
            this._layerFills = {};
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayerFill,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._updateDocumentLayerFill,
                events.documents.RESET_DOCUMENTS, this._resetAllDocumentLayerFill,
                events.documents.CLOSE_DOCUMENT, this._deleteDocumentFill,
                events.fills.FILL_ENABLED_CHANGED, this._handleFillPropertyChange,
                events.fills.FILL_COLOR_CHANGED, this._handleFillPropertyChange,
                events.fills.FILL_OPACITY_CHANGED, this._handleFillPropertyChange,
                events.fills.FILL_ADDED, this._handleFillAdded
            );
        },

        getState: function () {
            return {};
        },

        /** 
         * Gets the Fills of a specified layer in the specified document
         * @param {number} documentID
         * @param {number} layerID
         * @return {Array.<Fill>}
         */
        getLayerFills: function (documentID, layerID) {
            if (this._layerFills[documentID] && this._layerFills[documentID][layerID]) {
                return this._layerFills[documentID][layerID];
            } else {
                return [];
            }
        },

        /**
         * Update the Fills for all provided layers
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         * @param {boolean} silent optional: If true, don't emit a change event
         */
        _updateDocumentLayerFill: function (payload, silent) {
            var documentID = payload.document.documentID,
                layerArray = payload.layers;

            this._layerFills[documentID] = layerArray.reduce(function (fillMap, layerObj) {
                fillMap[layerObj.layerID] = _fillModelArrayFromLayer(documentID, layerObj);
                return fillMap;
            }, {});

            if (!silent) {
                this.emit("change");
            }
        },

        /**
         * Completely reset all the Fill for all layers in all supplied documents
         *
         * @private
         * @param {{documents: Array.<{document: object, layers: Array.<object>}>}} payload
         */
        _resetAllDocumentLayerFill: function (payload) {
            // purge the internal map before rebuilding
            this._layerFills = {};

            // for each document, build out the fills
            payload.documents.forEach(function (docObj) {
                this._updateDocumentLayerFill(docObj, true);
            }, this);

            this.emit("change");
        },

        /**
         * Update the provided properties of all fills of given index of the given layers of the given document
         * example payload {documentID:1, layerIDs:[1,2], fillIndex: 0, fillProperties:{width:12}}
         *
         * expects payload like 
         *     {
         *         documentID: number, 
         *         layerIDs: Array.<number>,
         *         fillIndex: number, 
         *         fillProperties: object
         *     }
         *     
         * @private
         * @param {object} payload
         */
        _handleFillPropertyChange: function (payload) {
            var isDirty = false;

            _.forEach(payload.layerIDs, function (layerID) {
                var fills = this._layerFills[payload.documentID][layerID],
                    type;

                // If setting a color, force a type change
                if (payload.fillProperties.color) {
                    type = contentLayerLib.contentTypes.SOLID_COLOR;
                } else {
                    type = payload.fillProperties.type;
                }

                if (fills && fills[payload.fillIndex]) {
                    // NOTE directly mutating model
                    var newProps = {
                        _enabled: payload.fillProperties.enabled,
                        _type: type,
                        _color: payload.fillProperties.color,
                        _opacity: payload.fillProperties.opacity
                    };
                    // copy any non-undefined props into the existing model
                    _.merge(fills[payload.fillIndex], newProps);

                    // handle special case: opacity should be copied to color if possible
                    if (payload.fillProperties.opacity && fills[payload.fillIndex]._color) {
                        fills[payload.fillIndex]._color.a = payload.fillProperties.opacity;
                    }
                    if (payload.fillProperties.color && payload.fillProperties.color.a) {
                        fills[payload.fillIndex]._opacity = payload.fillProperties.color.a;
                    }

                    isDirty = true;
                }

            }, this);

            if (isDirty) {
                this.emit("change");
            }
        },

        /**
         * Adds a fill to the specified document and layers
         *
         * @private
         * @param {{!color: object, !type: string, enabled: boolean}} payload
         */
        _handleFillAdded: function (payload) {
            // get the document and its selected layers
            var document = this.flux.store("document").getDocument(payload.documentID),
                isDirty = false;
            
            // loop over the selected layers
            _.forEach(payload.layerIDs, function (layerID) {
                // create a new fill and add it to the layerFills map
                var fills = this._layerFills[document.id][layerID],
                    fill = new Fill({
                        color: objUtil.getPath(payload.playResponse, "to.value.fillContents.value.color.value"),
                        type: objUtil.getPath(payload.playResponse, "to.value.fillContents.obj"),
                        fillEnabled: true
                    });

                if (!fills) {
                    fills = [];
                }
                fills.push(fill);
                isDirty = true;
            }, this);
            
            if (isDirty) {
                this.emit("change");
            }
        },

        /**
         * Delete the Fill of this document and its layers 
         * @private
         * @param {{documentID: number}} payload
         */
        _deleteDocumentFill: function (payload) {
            delete this._layerFills[payload.documentID];
            this.emit("change");
        }

    });

    module.exports = FillStore;

});
