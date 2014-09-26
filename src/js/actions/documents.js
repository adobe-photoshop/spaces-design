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

define(function (require, exports) {
    "use strict";

    var descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer"),
        _ = require("lodash");
   
    var events = require("../events"),
        locks = require("js/locks"),
        Promise = require("bluebird");
        
    /**
     * Activate the already-open document with the given ID.
     * 
     * @param {number} id Document ID
     * @return {Promise}
     */
    var selectDocumentCommand = function (id) {
        return descriptor.playObject(documentLib.select(documentLib.referenceBy.id(id)))
            .then(function () {
                var payload = {
                    selectedDocumentID: id
                };
                
                this.dispatch(events.documents.SELECT_DOCUMENT, payload);
            }.bind(this));
    };
    
    /**
     * Get the layer array of the document from Photoshop
     * 
     * @param {Object} document Action descriptor of document
     * @return {Promise}
     */
    var updateDocumentCommand = function (document) {
        var layerCount = document.numberOfLayers,
            startIndex = (document.hasBackgroundLayer ? 0 : 1),
            layerReference = null,
            layerGets = _.range(layerCount, startIndex - 1, -1).map(function (i) {
                layerReference = [
                    documentLib.referenceBy.id(document.documentID),
                    layerLib.referenceBy.index(i)
                ];
                return descriptor.get(layerReference);
            });
        
        return Promise.all(layerGets).then(function (layerArray) {
            var payload = {
                document: document,
                layerArray: layerArray
            };
            this.dispatch(events.documents.DOCUMENT_UPDATED, payload);
        }.bind(this));

    };
    
    /**
     * Fetch the set of currently open documents from Photoshop
     * 
     * @return {Promise}
     */
    var updateDocumentListCommand = function () {
        return descriptor.getProperty("application", "numberOfDocuments")
            .then(function (docCount) {
                if (docCount === 0) {
                    return;
                }

                var documentGets = _.range(1, docCount + 1).map(function (i) {
                    return descriptor.get(documentLib.referenceBy.index(i));
                });

                
                var allDocumentsPromise = Promise.all(documentGets),
                    currentDocIDPromise = descriptor.getProperty(documentLib.referenceBy.current, "documentID");
                
                return Promise.join(allDocumentsPromise, currentDocIDPromise,
                    function (documents, currentID) {
                        // Photoshop gives us an array, map that to ID->Document
                        var payload = {
                            selectedDocumentID: currentID,
                            documentsArray: documents
                        };
                        this.dispatch(events.documents.DOCUMENT_LIST_UPDATED, payload);

                        // Start getting all documents, starting with the current one
                        documents.forEach(function (document) {
                            this.flux.actions.documents.updateDocument(document);
                        }.bind(this));
                    }.bind(this));
            }.bind(this));
    };

    var selectDocument = {
        command: selectDocumentCommand,
        writes: locks.ALL_LOCKS
    };

    var updateDocumentList = {
        command: updateDocumentListCommand,
        writes: locks.ALL_LOCKS
    };

    var updateDocument = {
        command: updateDocumentCommand,
        writes: locks.ALL_LOCKS
    };

    exports.selectDocument = selectDocument;
    exports.updateDocumentList = updateDocumentList;
    exports.updateDocument = updateDocument;
});
