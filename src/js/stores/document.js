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
        Document = require("../models/document");

    var DocumentStore = Fluxxor.createStore({
        
        initialize: function () {
            this._openDocuments = {};
            
            this.bindActions(
                events.documents.DOCUMENT_UPDATED, this._documentUpdated,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._documentUpdated,
                events.documents.RESET_DOCUMENTS, this._resetDocuments,
                events.documents.CLOSE_DOCUMENT, this._closeDocument
            );
        },
        
        getState: function () {
            return {
                openDocuments: this._openDocuments
            };
        },

        /**
         * Returns the document with the given ID; or null if there is none
         * 
         * @param {number} id Document ID
         * @return {?Document}
         */
        getDocument: function (id) {
            return this._openDocuments[id];
        },

        /**
         * Construct a document model from a document and array of layer descriptors.
         * 
         * @private
         * @param {{document: object, layers: Array.<object>}} docObj
         * @return {Document}
         */
        _makeDocument: function (docObj) {
            var rawDocument = docObj.document,
                documentID = rawDocument.documentID,
                layerStore = this.flux.store("layer"),
                layerTree = layerStore.getLayerTree(documentID),
                doc = new Document(docObj.document);

            doc._layerTree = layerTree;
            return doc;
        },
        
        /**
         * Completely reset all the document models from the given document and
         * layer descriptors.
         *
         * @private
         * @param {{documents: Array.<{document: object, layers: Array.<object>}>}} payload
         */
        _resetDocuments: function (payload) {
            this.waitFor(["layer"], function () {
                this._openDocuments = payload.documents.reduce(function (openDocuments, docObj) {
                    var doc = this._makeDocument(docObj);
                    openDocuments[doc.id] = doc;
                    return openDocuments;
                }.bind(this), {});
 
                this.emit("change");
            });
        },

        /**
         * Reset a single document model from the given document and layer descriptors.
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         */
        _documentUpdated: function (payload) {
            this.waitFor(["layer"], function () {
                var doc = this._makeDocument(payload);
                this._openDocuments[doc.id] = doc;

                this.emit("change");
            });
        },

        /**
         * Remove a single document model for the given document ID
         *
         * @private
         * @param {{documentID: number} payload
         */
        _closeDocument: function (payload) {
            this.waitFor(["layer"], function () {
                var documentID = payload.documentID;
                delete this._openDocuments[documentID];

                this.emit("change");
            });
        }

    });

    module.exports = DocumentStore;
});
