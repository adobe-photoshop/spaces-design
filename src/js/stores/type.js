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
        stringUtil = require("js/util/string"),
        colorUtil = require("js/util/color");

    var TextStyle = require("js/models/textstyle");

    var TypeStore = Fluxxor.createStore({
        /**
         * Object map of document IDs to an object map of layer IDs to a list of
         * TextStyle models.
         *
         * @private {}
         * @type {Object.<number, Object.<number, Array.<TextStyle>>>}
         */
        _textStyles: null,

        initialize: function () {
            this._textStyles = {};

            this.bindActions(
                events.type.FACE_CHANGED, this._handleFaceChanged,
                events.type.SIZE_CHANGED, this._handleSizeChanged,
                events.type.COLOR_CHANGED, this._handleColorChanged,
                events.documents.DOCUMENT_UPDATED, this._handleDocumentUpdated,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._handleDocumentUpdated,
                events.documents.RESET_DOCUMENTS, this._handleDocumentsReset,
                events.documents.CLOSE_DOCUMENT, this._handleDocumentClose
            );
        },

        getState: function () {
            return {};
        },

        /**
         * Get the list of text styles for a given layer ID.
         *
         * @param {number} documentID
         * @param {number} layerID
         * @return {?Array.<TextStyle>}
         */
        getTextStyles: function (documentID, layerID) {
            return this._textStyles[documentID][layerID];
        },

        /**
         * Update text styles when the typeface used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, family: string, style: string}} payload
         */
        _handleFaceChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                family = payload.family,
                style = payload.style,
                fontStore = this.flux.store("font"),
                postScriptName = fontStore.getPostScriptFromFamilyStyle(family, style);

            if (!postScriptName) {
                var message = stringUtil.format(
                    "Unable to find postscript font name for style {1} of family {0}",
                    family,
                    style
                );

                throw new Error(message);
            }

            layerIDs.forEach(function (layerID) {
                var textStyle = this._textStyles[documentID][layerID][0];

                textStyle = textStyle._setFace(postScriptName);
                this._textStyles[documentID][layerID] = [textStyle];
            }, this);

            this.emit("change");
        },

        /**
         * Update text styles when the type size used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, size: number}} payload
         */
        _handleSizeChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                size = payload.size;

            layerIDs.forEach(function (layerID) {
                var textStyle = this._textStyles[documentID][layerID][0];

                textStyle = textStyle._setSize(size);
                this._textStyles[documentID][layerID] = [textStyle];
            }, this);

            this.emit("change");
        },

        /**
         * Update text styles when the type color used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, color: Color}} payload
         */
        _handleColorChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                color = payload.color;

            var opaqueColor = colorUtil.opaque(color, 1);

            layerIDs.forEach(function (layerID) {
                var textStyle = this._textStyles[documentID][layerID][0];

                textStyle = textStyle._setColor(opaqueColor);
                this._textStyles[documentID][layerID] = [textStyle];
            }, this);

            this.emit("change");
        },

        /**
         * Reset the layers' text styles when the document is coarsely updated.
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         */
        _handleDocumentUpdated: function (payload) {
            var document = payload.document,
                documentID = document.documentID,
                layers = payload.layers;

            this._textStyles[documentID] = layers.reduce(function (textStyles, layer) {
                var layerID = layer.layerID;

                textStyles[layerID] = TextStyle.fromDescriptor(document, layer);
                return textStyles;
            }, {});

            this.emit("change");
        },

        /**
         * Reset all layers' text styles when the documents are coarsely reset.
         *
         * @private
         * @param {{documents: Array.<object>}} payload
         */
        _handleDocumentsReset: function (payload) {
            this._textStyles = {};
            payload.documents.forEach(this._handleDocumentUpdated, this);

            this.emit("change");
        },

        /**
         * Clear text styles for a given document when it is closed
         * 
         * @private
         * @param {{documentID: number}} payload
         */
        _handleDocumentClose: function (payload) {
            var documentID = payload.documentID;

            delete this._textStyles[documentID];

            this.emit("change");
        }
    });

    module.exports = TypeStore;
});
