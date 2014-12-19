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
        DropShadow = require("../models/dropshadow"),
        objUtil = require("js/util/object"),
        log = require("js/util/log");

    var LayerEffectStore = Fluxxor.createStore({

        /**
         * Internal Map of (Document, Layer) > DropShadows
         * @private
         * @type {Object.<number, Object.<number, Array<DropShadow>>}
         */
        _layerDropShadows: null,

        initialize: function () {
            this._layerDropShadows = {};
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._updateDocumentLayerEffects,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._updateDocumentLayerEffects,
                events.documents.RESET_DOCUMENTS, this._resetAllDocumentLayerEffects,
                events.documents.CLOSE_DOCUMENT, this._deleteDocumentLayerEffects
            );
        },

        getState: function () {
            return {};
        },

        /** 
         * Gets the DropShadows of a specified layer in the specified document
         * @param {number} documentID
         * @param {number} layerID
         * @return {Array.<DropShadow>}
         */
        getLayerDropShadows: function (documentID, layerID) {
            if (this._layerDropShadows[documentID] && this._layerDropShadows[documentID][layerID]) {
                return this._layerDropShadows[documentID][layerID];
            } else {
                return [];
            }
        },

        /**
         * Update the DropShadows for all provided layers
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         * @param {boolean} silent optional: If true, don't emit a change event
         */
        _updateDocumentLayerEffects: function (payload, silent) {
            var documentID = payload.document.documentID,
                layers = payload.layers;

            var dropShadowsFromLayer = function (layer) {
                // test first to see if there is at least some layer effects
                // TODO need to understand the implication of layerFXVisible more betterer
                var layerEffects = layer.layerEffects,
                    dropShadowDescriptor = objUtil.getPath(layer, "layerEffects.value.dropShadow");

                if (layerEffects && layerEffects.obj === "layerFXVisible" && dropShadowDescriptor) {
                    try {
                        return [new DropShadow(dropShadowDescriptor)];
                    } catch (e) {
                        log.error("Could not build a DropShadow for doc %s / layer %s >> %s",
                            documentID, layer.id, e.message);
                        return [];
                    }
                } else {
                    return [];
                }
            };

            this._layerDropShadows[documentID] = layers.reduce(function (dropShadowMap, layerObj) {
                dropShadowMap[layerObj.layerID] = dropShadowsFromLayer(layerObj);
                return dropShadowMap;
            }, {});

            if (!silent) {
                this.emit("change");
            }
        },

        /**
         * Completely reset all the DropShadows for all layers in all supplied documents
         *
         * @private
         * @param {{documents: Array.<{document: object, layers: Array.<object>}>}} payload
         */
        _resetAllDocumentLayerEffects: function (payload) {
            // purge the internal map before rebuilding
            this._layerDropShadows = {};

            // for each document, build out the dropShadows
            payload.documents.forEach(function (docObj) {
                this._updateDocumentLayerEffects(docObj, true);
            }, this);

            this.emit("change");
        },

        /**
         * Delete the DropShadow of this document and its layers 
         * @private
         * @param {{documentID: number}} payload
         */
        _deleteDocumentLayerEffects: function (payload) {
            delete this._layerDropShadows[payload.documentID];
            this.emit("change");
        }

    });

    module.exports = LayerEffectStore;

});
