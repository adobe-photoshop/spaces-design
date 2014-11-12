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
        Stroke = require("../models/Stroke"),
        log = require("js/util/log"),
        _ = require("lodash");

    var StrokeStore = Fluxxor.createStore({

        /**
         * Internal Map of (Document, Layer) > Strokes
         * @private
         * @type {Object.<number, Object.<number, Array<Stroke>>}
         */
        _layerStrokes: null,

        initialize: function () {
            this._layerStrokes = {};
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayerStroke,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._updateDocumentLayerStroke,
                events.documents.RESET_DOCUMENTS, this._resetAllDocumentLayerStroke,
                events.documents.CLOSE_DOCUMENT, this._deleteDocumentStroke,
                events.strokes.STROKE_ENABLED_CHANGED, this._handleStrokeEnabledChange
            );
        },

        getState: function () {
            return {};
        },

        /** 
         * Gets the Stroke of specified layer in the specified document
         * @param {number} documentID
         * @param {number} layerID
         * @return {Array.<Stroke>}
         */
        getLayerStrokes: function (documentID, layerID) {
            if (this._layerStrokes[documentID] && this._layerStrokes[documentID][layerID]) {
                return this._layerStrokes[documentID][layerID];
            } else {
                return [];
            }
        },

        /**
         * Update the Strokes for all provided layers
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         * @param {boolean} silent optional: If true, don't emit a change event
         */
        _updateDocumentLayerStroke: function (payload, silent) {
            var documentID = payload.document.documentID,
                layerArray = payload.layers;

            var strokesFromLayer = function (layer) {
                // test first to see if there is at least some StyleInfo
                if (layer.AGMStrokeStyleInfo) {
                    try {
                        return [new Stroke(layer)];
                    } catch (e) {
                        log.debug("Could not build a Stroke for doc %s / layer %s", documentID, layer.id, e);
                        return [];
                    }

                } else {
                    return [];
                }
            };

            this._layerStrokes[documentID] = layerArray.reduce(function (strokeMap, layerObj) {
                strokeMap[layerObj.layerID] = strokesFromLayer(layerObj);
                return strokeMap;
            }, {});

            if (!silent) {
                this.emit("change");
            }
        },

        /**
         * Completely reset all the Stroke for all layers in all supplied documents
         *
         * @private
         * @param {{documents: Array.<{document: object, layers: Array.<object>}>}} payload
         */
        _resetAllDocumentLayerStroke: function (payload) {
            payload.documents.forEach(function (docObj) {
                this._updateDocumentLayerStroke(docObj, true);
            }, this);

            this.emit("change");
        },

        /**
         * When the enabled/disabled flag is toggled, update the model
         * example payload {documentID:1, layerIDs:[1,2], strokeEnabled:true}
         * 
         * @private
         * @param  {{documentID: number, layerIDs:Array.<number>, strokeEnabled: boolean}} payload
         */
        _handleStrokeEnabledChange: function (payload) {
            var isDirty = false;

            _.forEach(payload.layerIDs, function (layerID) {
                var strokes = this._layerStrokes[payload.documentID][layerID];
        
                // NOTE directly mutating model
                // ASSUMPTION we're updating only the first stroke
                if (strokes && strokes[0]) {
                    strokes[0]._enabled = payload.strokeEnabled;
                    isDirty = true;
                }

            }, this);

            if (isDirty) {
                this.emit("change");
            }
            
        },

        /**
         * Delete the Stroke of this document and its layers 
         * @private
         * @param  {{documentID: number}} payload
         */
        _deleteDocumentStroke: function (payload) {
            delete this._layerStrokes[payload.documentID];
            this.emit("change");
        }

    });
    module.exports = StrokeStore;
});
