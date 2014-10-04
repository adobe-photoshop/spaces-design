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

    var Promise = require("bluebird"),
        _ = require("lodash");

    var descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer"),
        events = require("../events"),
        locks = require("js/locks"),
        log = require("js/util/log");

    /**
     * Get an array of layer descriptors for the given document descriptor.
     *
     * @private
     * @param {object} doc Document descriptor
     * @return {Promise.<Array.<object>>} Resolves with an array of layer descriptors
     */
    var _getLayersForDocument = function (doc) {
        var layerCount = doc.numberOfLayers,
            startIndex = (doc.hasBackgroundLayer ? 0 : 1),
            layerGets = _.range(layerCount, startIndex - 1, -1).map(function (i) {
                var layerReference = [
                    documentLib.referenceBy.id(doc.documentID),
                    layerLib.referenceBy.index(i)
                ];
                return descriptor.get(layerReference);
            });
        
        return Promise.all(layerGets);
    };

    /**
     * Completely reset all document and layer state. This is a heavy operation
     * that should only be called in an emergency!
     * 
     * @private
     * @return {Promise}
     */
    var resetDocumentsCommand = function () {
        return descriptor.getProperty("application", "numberOfDocuments")
            .bind(this)
            .then(function (docCount) {
                var payload = {};
                if (docCount === 0) {
                    payload.selectedDocumentID = null;
                    payload.documents = [];
                    this.dispatch(events.documents.RESET_DOCUMENTS, payload);
                    return;
                }

                var openDocumentPromises = _.range(1, docCount + 1)
                    .map(function (index) {
                        var indexRef = documentLib.referenceBy.index(index);
                        return descriptor.get(indexRef)
                            .then(function (doc) {
                                return _getLayersForDocument(doc)
                                    .bind(this)
                                    .then(function (layers) {
                                        return {
                                            document: doc,
                                            layers: layers
                                        };
                                    });
                            });
                    }),
                    openDocumentsPromise = Promise.all(openDocumentPromises);
                
                var currentRef = documentLib.referenceBy.current,
                    currentDocumentIDPromise = descriptor.getProperty(currentRef, "documentID");
                
                return Promise.join(currentDocumentIDPromise, openDocumentsPromise,
                    function (currentDocumentID, openDocuments) {
                        payload.selectedDocumentID = currentDocumentID;
                        payload.documents = openDocuments;
                        this.dispatch(events.documents.RESET_DOCUMENTS, payload);
                    }.bind(this));
            });
    };

    /**
     * Initialize document and layer state, emitting DOCUMENT_UPDATED and
     * CURRENT_DOCUMENT_UPDATED events for the open documents. This is different
     * from resetDocumentsCommand in two ways: 1) the emitted events are interpreted
     * by the stores as being additive (i.e., each new DOCUMENT_UPDATED event is
     * treated as indication that there is another document open); 2) these events
     * are emitted individually, and in particular the event for the current document
     * is emitted first. This is a performance optimization to allow the UI to be
     * rendered for the active document before continuing to build models for the
     * other documents.
     * 
     * @return {Promise}
     */
    var initDocumentsCommand = function () {
        return descriptor.getProperty("application", "numberOfDocuments")
            .bind(this)
            .then(function (docCount) {
                if (docCount === 0) {
                    return;
                }

                var currentRef = documentLib.referenceBy.current;
                return descriptor.get(currentRef)
                    .bind(this)
                    .then(function (currentDoc) {
                        var currentDocLayersPromise = _getLayersForDocument(currentDoc)
                            .bind(this)
                            .then(function (layers) {
                                var payload = {
                                    document: currentDoc,
                                    layers: layers
                                };

                                this.dispatch(events.documents.CURRENT_DOCUMENT_UPDATED, payload);
                            });

                        var otherDocPromises = _.range(1, docCount + 1)
                            .filter(function (index) {
                                return index !== currentDoc.itemIndex;
                            })
                            .map(function (index) {
                                var indexRef = documentLib.referenceBy.index(index);
                                return descriptor.get(indexRef)
                                    .bind(this)
                                    .then(function (doc) {
                                        return _getLayersForDocument(doc)
                                            .bind(this)
                                            .then(function (layers) {
                                                var payload = {
                                                    document: doc,
                                                    layers: layers
                                                };

                                                this.dispatch(events.documents.DOCUMENT_UPDATED, payload);
                                            });
                                    });
                            }, this),
                            otherDocsPromise = Promise.all(otherDocPromises);

                        return Promise.join(currentDocLayersPromise, otherDocsPromise);
                    });
            });
    };

    /**
     * Update the document and layer state for the given document ID. Emits a
     * single DOCUMENT_UPDATED event.
     * 
     * @param {number} id Document ID
     * @return {Promise}
     */
    var updateDocumentCommand = function (id) {
        var docRef = documentLib.referenceBy.id(id);
        return descriptor.get(docRef)
            .bind(this)
            .then(function (doc) {
                return _getLayersForDocument(doc)
                    .bind(this)
                    .then(function (layerArray) {
                        var payload = {
                            document: doc,
                            layers: layerArray
                        };
                        this.dispatch(events.documents.DOCUMENT_UPDATED, payload);
                    });
            })
            .catch(function (err) {
                log.warn("Failed to update document", id, err);
                this.flux.actions.documents.resetDocuments();
            });
    };

    /**
     * Update the document and layer state for the currently active document ID.
     * Emits a single CURRENT_DOCUMENT_UPDATED event.
     * 
     * @return {Promise}
     */
    var updateCurrentDocumentCommand = function () {
        var currentRef = documentLib.referenceBy.current;
        return descriptor.get(currentRef)
            .bind(this)
            .then(function (doc) {
                return _getLayersForDocument(doc)
                    .bind(this)
                    .then(function (layers) {
                        var payload = {
                            document: doc,
                            layers: layers
                        };
                        this.dispatch(events.documents.CURRENT_DOCUMENT_UPDATED, payload);
                    });
            })
            .catch(function (err) {
                log.warn("Failed to update current document", err);
                this.flux.actions.documents.resetDocuments();
            });
    };

    /**
     * Activate the already-open document with the given ID.
     * 
     * @param {number} id Document ID
     * @return {Promise}
     */
    var selectDocumentCommand = function (id) {
        return descriptor.playObject(documentLib.select(documentLib.referenceBy.id(id)))
            .bind(this)
            .then(function () {
                var payload = {
                    selectedDocumentID: id
                };
                
                this.dispatch(events.documents.SELECT_DOCUMENT, payload);
            })
            .catch(function (err) {
                log.warn("Failed to select document", id, err);
                this.flux.actions.documents.resetDocuments();
            });
    };

    var selectDocument = {
        command: selectDocumentCommand,
        writes: locks.ALL_LOCKS
    };

    var updateDocument = {
        command: updateDocumentCommand,
        writes: locks.ALL_LOCKS
    };

    var updateCurrentDocument = {
        command: updateCurrentDocumentCommand,
        writes: locks.ALL_LOCKS
    };

    var initDocuments = {
        command: initDocumentsCommand,
        writes: locks.ALL_LOCKS
    };

    var resetDocuments = {
        command: resetDocumentsCommand,
        writes: locks.ALL_LOCKS
    };

    exports.selectDocument = selectDocument;
    exports.updateDocument = updateDocument;
    exports.updateCurrentDocument = updateCurrentDocument;
    exports.initDocuments = initDocuments;
    exports.resetDocuments = resetDocuments;
});
