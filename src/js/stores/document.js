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
        Document = require("../models/document"),
        log = require("js/util/log");

    var DocumentStore = Fluxxor.createStore({
        
        initialize: function () {
            this._openDocuments = {};
            
            this.bindActions(
                events.documents.DOCUMENT_LIST_UPDATED, this._documentListUpdated,
                events.documents.DOCUMENT_UPDATED, this._documentUpdated,
                events.layers.SELECT_LAYER, this._handleLayerSelect
                
            );
        },
        
        /** Getters **/
        getState: function () {
            return {
                openDocuments: this._openDocuments
            };
        },

        /**
         * Returns the current document object
         */
        getCurrentDocument: function () {
            var selectedDocumentID = this.flux.stores.application.getCurrentDocumentID();
            return this._openDocuments[selectedDocumentID];
        },

        /**
         * Returns the document with the given ID
         */
        getDocument: function (id) {
            return this._openDocuments[id];
        },

        /** Handlers **/
        
        /**
         * Once the application store builds the document ID array, 
         * maps the IDs to document objects and stores them here
         * @private
         */
        _documentListUpdated: function (payload) {
            this.waitFor(["application"], function () {
                var documentsMap = payload.documentsArray.reduce(function (docMap, docObj) {
                    docMap[docObj.documentID] = new Document(docObj);
                    return docMap;
                }, {});
                            
                this._openDocuments = documentsMap;
 
                this.emit("change");
            }.bind(this));
        },

        /**
         * Once the layer store finishes building the layer tree of this document, 
         * attach the layer tree to the document
         * @private
         */
        _documentUpdated: function (payload) {
            this.waitFor(["layer"], function (layerStore) {
                var documentID = payload.document.documentID;

                if (!this._openDocuments.hasOwnProperty(documentID)) {
                    log.warn("Received DOCUMENT_UPDATED for unknown document ID", documentID);
                    this._openDocuments[documentID] = new Document(payload.document);
                }

                var document = this._openDocuments[documentID],
                    layerTree = layerStore.getLayerTree(documentID);

                document._layerTree = layerTree;

                this.emit("change");
            }.bind(this));
        },

        /**
         * When layer selection changes, updates the selection of the affected document
         * @private
         */
        _handleLayerSelect: function () {
            this.waitFor(["layer"], function () {
                this.emit("change");
            }.bind(this));
        }
        
    });

    module.exports = new DocumentStore();
});
