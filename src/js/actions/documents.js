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
        Immutable = require("immutable"),
        _ = require("lodash");

    var photoshopEvent = require("adapter/lib/photoshopEvent"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer");

    var layerActions = require("./layers"),
        ui = require("./ui"),
        application = require("./application"),
        menu = require("./menu"),
        events = require("../events"),
        locks = require("js/locks"),
        pathUtil = require("js/util/path");

    /**
     * @private
     * @type {Array.<string>} Properties to be included when requesting document
     * descriptors from Photoshop.
     */
    var _documentProperties = [
        "documentID",
        "title",
        "itemIndex",
        "hasBackgroundLayer",
        "numberOfLayers",
        "resolution",
        "width",
        "height",
        "mode"
    ];

    /**
     * @private
     * @type {Array.<string>} Properties to be included if present when requesting
     * document descriptors from Photoshop.
     */
    var _optionalDocumentProperties = [
        "targetLayers"
    ];

    /**
     * Get a document descriptor for the given document reference. Only the
     * properties listed in _documentProperties will be included for performance
     * reasons.
     * 
     * @private
     * @param {object} reference
     * @return {Promise.<object>}
     */
    var _getDocumentByRef = function (reference) {
        var makeRefObj = function (property) {
            return {
                reference: reference,
                property: property
            };
        };

        var refObjs = _documentProperties.map(makeRefObj),
            documentPropertiesPromise = descriptor.batchGetProperties(refObjs)
                .reduce(function (result, value, index) {
                    var property = _documentProperties[index];
                    result[property] = value;
                    return result;
                }, {});

        var optionalPropertiesPromise = descriptor.batchGetOptionalProperties(reference, _optionalDocumentProperties);

        return Promise.join(documentPropertiesPromise, optionalPropertiesPromise,
            function (properties, optionalProperties) {
                return _.merge(properties, optionalProperties);
            });
    };

    /**
     * Get an array of layer descriptors for the given document descriptor.
     *
     * @private
     * @param {object} doc Document descriptor
     * @return {Promise.<{document: object, layers: Array.<object>}>}
     */
    var _getLayersForDocument = function (doc) {
        var layerCount = doc.numberOfLayers,
            startIndex = (doc.hasBackgroundLayer ? 0 : 1),
            layerRefs = Immutable.Range(layerCount, startIndex - 1, -1).map(function (i) {
                return [
                    documentLib.referenceBy.id(doc.documentID),
                    layerLib.referenceBy.index(i)
                ];
            });
        
        return layerActions._getLayersByRef(layerRefs)
            .then(function (layers) {
                return {
                    document: doc,
                    layers: layers
                };
            });
    };

    // 480 distance units at 300 resolution is 2000px at 72 resolution
    var NEW_DOC_SETTINGS = {
        width: 2000,
        height: 2000,
        resolution: 72,
        fill: "transparent",
        depth: 8,
        colorMode: "RGBColorMode",
        profile: "none",
        pixelAspectRation: 1,
        artboard: false
    };

    /**
     * Creates a document in default settings
     * 
     * @return {Promise}
     */
    var createNewCommand = function () {
        return descriptor.playObject(documentLib.create(NEW_DOC_SETTINGS))
            .bind(this)
            .then(function (result) {
                return this.transfer(allocateDocument, result.documentID);
            });
    };

    /**
     * Opens the document in the given path
     *
     * @param {string} filePath
     * @return {Promise}
     */
    var openCommand = function (filePath) {
        this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: false});
        
        var documentRef = {
            path: filePath
        };
        
        return descriptor.playObject(documentLib.open(documentRef, {}))
            .bind(this)
            .then(function () {
                var initPromise = this.transfer(initActiveDocument),
                    uiPromise = this.transfer(ui.updateTransform),
                    recentFilePromise = this.transfer(application.updateRecentFiles);

                return Promise.join(initPromise, uiPromise, recentFilePromise);
            });
    };

    /**
     * Close the given document or, if no document is provided, the active document.
     * If the document is dirty, show the Classic modal dialog that asks the user
     * whether or not they want to save.
     *
     * @param {Document=} document
     * @return {Promise}
     */
    var closeCommand = function (document) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        if (!document) {
            return Promise.resolve();
        }

        this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: false});

        var closeObj = documentLib.close(document.id),
            playOptions = {
                interactionMode: descriptor.interactionMode.DISPLAY
            };

        return Promise.delay(50).bind(this)
            .then(function () {
                return descriptor.playObject(closeObj, playOptions);
            })
            .then(function () {
                return this.transfer(disposeDocument, document.id);
            }, function () {
                // the play command fails if the user cancels the close dialog
            });
    };

    /**
     * Completely reset all document and layer state. This is a heavy operation
     * that should only be called in an emergency!
     * 
     * @private
     * @return {Promise}
     */
    var onResetCommand = function () {
        return descriptor.getProperty("application", "numberOfDocuments")
            .bind(this)
            .then(function (docCount) {
                var payload = {};
                if (docCount === 0) {
                    payload.selectedDocumentID = null;
                    payload.documents = [];
                    this.dispatch(events.document.RESET_DOCUMENTS, payload);
                    return;
                }

                var openDocumentPromises = _.range(1, docCount + 1)
                    .map(function (index) {
                        var indexRef = documentLib.referenceBy.index(index);

                        return _getDocumentByRef(indexRef)
                            .then(_getLayersForDocument);
                    }),
                    openDocumentsPromise = Promise.all(openDocumentPromises);
                
                var currentRef = documentLib.referenceBy.current,
                    currentDocumentIDPromise = descriptor.getProperty(currentRef, "documentID");
                
                return Promise.join(currentDocumentIDPromise, openDocumentsPromise,
                    function (currentDocumentID, openDocuments) {
                        payload.selectedDocumentID = currentDocumentID;
                        payload.documents = openDocuments;
                        this.dispatch(events.document.RESET_DOCUMENTS, payload);
                    }.bind(this));
            });
    };

    /**
     * Initialize document and layer state, emitting DOCUMENT_UPDATED events, for
     * all the inactive documents.
     * 
     * @param {number} currentIndex
     * @param {number} docCount
     * @return {Promise}
     */
    var initInactiveDocumentsCommand = function (currentIndex, docCount) {
        var otherDocPromises = _.range(1, docCount + 1)
            .filter(function (index) {
                return index !== currentIndex;
            })
            .map(function (index) {
                var indexRef = documentLib.referenceBy.index(index);
                return _getDocumentByRef(indexRef)
                    .bind(this)
                    .then(_getLayersForDocument)
                    .then(function (payload) {
                        this.dispatch(events.document.DOCUMENT_UPDATED, payload);
                    });
            }, this);

        return Promise.all(otherDocPromises);
    };

    /**
     * Initialize document and layer state, emitting DOCUMENT_UPDATED. 
     * 
     * @return {Promise.<{currentIndex: number, docCount: number}>}
     */
    var initActiveDocumentCommand = function () {
        return descriptor.getProperty("application", "numberOfDocuments")
            .bind(this)
            .then(function (docCount) {
                if (docCount === 0) {
                    // Updates menu items in cases of no document
                    this.dispatch(events.menus.UPDATE_MENUS);
                    return;
                }

                var currentRef = documentLib.referenceBy.current;
                return _getDocumentByRef(currentRef)
                    .bind(this)
                    .then(function (currentDoc) {
                        var currentDocLayersPromise = _getLayersForDocument(currentDoc)
                            .bind(this)
                            .then(function (payload) {
                                payload.current = true;
                                this.dispatch(events.document.DOCUMENT_UPDATED, payload);
                            });

                        return currentDocLayersPromise
                            .then(function () {
                                return {
                                    currentIndex: currentDoc.itemIndex,
                                    docCount: docCount
                                };
                            });
                    });
            });
    };

    /**
     * Fetch the ID of the currently selected document, or null if there is none.
     * 
     * @private
     * @return {Promise.<?number>}
     */
    var _getSelectedDocumentID = function () {
        var currentRef = documentLib.referenceBy.current;
        return descriptor.getProperty(currentRef, "documentID")
            .catch(function () {
                return null;
            });
    };

    /**
     * Dispose of a previously opened document.
     * 
     * @private
     * @param {!number} documentID
     * @return {Promise}
     */
    var disposeDocumentCommand = function (documentID) {
        var disposePromise = _getSelectedDocumentID()
            .bind(this)
            .then(function (currentDocumentID) {
                var payload = {
                    documentID: documentID,
                    selectedDocumentID: currentDocumentID
                };

                this.dispatch(events.document.CLOSE_DOCUMENT, payload);
            });

        var transformPromise = this.transfer(ui.updateTransform);

        return Promise.join(disposePromise, transformPromise);
    };

    /**
     * Allocate a newly opened document. Emits DOCUMENT_UPDATED and a SELECT_DOCUMENT
     * events.
     * 
     * @private
     * @param {!number} documentID
     * @return {Promise}
     */
    var allocateDocumentCommand = function (documentID) {
        var updatePromise = this.transfer(updateDocument, documentID),
            selectedDocumentPromise = _getSelectedDocumentID(),
            transformPromise = this.transfer(ui.updateTransform),
            allocatePromise = Promise.join(selectedDocumentPromise, updatePromise,
                function (currentDocumentID) {
                    var payload = {
                        selectedDocumentID: currentDocumentID
                    };

                    this.dispatch(events.document.SELECT_DOCUMENT, payload);
                }.bind(this));

        return Promise.join(allocatePromise, transformPromise);
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
        return _getDocumentByRef(docRef)
            .bind(this)
            .then(_getLayersForDocument)
            .then(function (payload) {
                this.dispatch(events.document.DOCUMENT_UPDATED, payload);
            });
    };

    /**
     * Update the document and layer state for the currently active document ID.
     * Emits DOCUMENT_UPDATED and TOGGLE_OVERLAYS events.
     * 
     * @return {Promise}
     */
    var updateCurrentDocumentCommand = function () {
        var currentRef = documentLib.referenceBy.current;
        return _getDocumentByRef(currentRef)
            .bind(this)
            .then(_getLayersForDocument)
            .then(function (payload) {
                payload.current = true;
                this.dispatch(events.document.DOCUMENT_UPDATED, payload);
                this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: true});
            });
    };

    /**
     * Revert the current document by calling the native revert command
     * No internal state is changed now, rather it is handled by a listener on the 'revert' event from photoshop
     * Clears overlays before calling revert
     *
     * @param {number} nativeMenuCommand command identifier
     * @return {Promise}
     */
    var revertCurrentDocumentCommand = function (nativeMenuCommand) {
        this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: false});
        return this.transfer(menu.native, nativeMenuCommand);
    };

    /**
     * Activate the given already-open document
     * 
     * @param {Document} document
     * @return {Promise}
     */
    var selectDocumentCommand = function (document) {
        return descriptor.playObject(documentLib.select(documentLib.referenceBy.id(document.id)))
            .bind(this)
            .then(function () {
                var payload = {
                    selectedDocumentID: document.id
                };
                
                this.dispatch(events.document.SELECT_DOCUMENT, payload);
                return Promise.resolve();
            })
            .then(function () {
                return this.transfer(ui.updateTransform);
            });
    };

    /**
     * Activate the next open document in the document index
     * 
     * @return {Promise}
     */
    var selectNextDocumentCommand = function () {
        var applicationStore = this.flux.store("application"),
            nextDocument = applicationStore.getNextDocument();

        if (!nextDocument) {
            return Promise.resolve();
        }

        this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: false});

        return Promise.delay(50).bind(this)
            .then(function () {
                return this.transfer(selectDocument, nextDocument);
            });
    };

    /**
     * Activate the previous open document in the document index
     * 
     * @return {Promise}
     */
    var selectPreviousDocumentCommand = function () {
        var applicationStore = this.flux.store("application"),
            previousDocument = applicationStore.getPreviousDocument();

        if (!previousDocument) {
            return Promise.resolve();
        }

        this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: false});

        return Promise.delay(50).bind(this)
            .then(function () {
                this.transfer(selectDocument, previousDocument);
            });
    };

    /**
     * Register event listeners for active and open document change events, and
     * initialize the active document list.
     * 
     * @return {Promise.<{currentIndex: number, docCount: number}>}
     */
    var beforeStartupCommand = function () {
        var applicationStore = this.flux.store("application"),
            documentStore = this.flux.store("document");

        descriptor.addListener("make", function (event) {
            var target = photoshopEvent.targetOf(event),
                currentDocument;

            switch (target) {
            case "document":
                // A new document was created
                if (typeof event.documentID === "number") {
                    this.flux.actions.documents.allocateDocument(event.documentID);
                } else {
                    throw new Error("Document created with no ID");
                }
                
                break;
            case "layer":
            case "contentLayer":
            case "textLayer":
                // A layer was added
                currentDocument = applicationStore.getCurrentDocument();
                this.flux.actions.documents.updateDocument(currentDocument.id);

                break;
            }
        }.bind(this));

        descriptor.addListener("open", function (event) {
            // A new document was opened
            if (typeof event.documentID === "number") {
                this.flux.actions.documents.allocateDocument(event.documentID);
            } else {
                throw new Error("Document opened with no ID");
            }

            this.flux.actions.application.updateRecentFiles();
        }.bind(this));

        descriptor.addListener("select", function (event) {
            var nextDocument,
                currentDocument;

            if (photoshopEvent.targetOf(event) === "document") {
                if (typeof event.documentID === "number") {
                    // FIXME: This event is incorrectly triggered even when the
                    // document selection is initiated internally. Ideally it
                    // would not be, and this would be unnecessary.
                    nextDocument = this.flux.store("document").getDocument(event.documentID);

                    if (nextDocument) {
                        currentDocument = applicationStore.getCurrentDocument();

                        if (currentDocument !== nextDocument) {
                            this.flux.actions.documents.selectDocument(nextDocument);
                        }
                    } else {
                        throw new Error("Document model missing during select document");
                    }
                } else {
                    throw new Error("Selected document has no ID");
                }
            }
        }.bind(this));

        descriptor.addListener("save", function (event) {
            var saveAs = event.as,
                saveSucceeded = event.saveStage &&
                event.saveStage.value === "saveSucceeded";

            if (!saveAs || !saveSucceeded) {
                return;
            }

            var documentID = event.documentID,
                document = documentStore.getDocument(documentID);

            if (!document) {
                return;
            }

            var path = event.in && event.in.path,
                name = pathUtil.basename(path);

            this.dispatch(events.document.DOCUMENT_RENAMED, {
                documentID: documentID,
                name: name
            });
        }.bind(this));

        // Overkill, but pasting a layer just gets us a simple paste event with no descriptor
        descriptor.addListener("paste", function () {
            this.flux.actions.documents.updateCurrentDocument();
        }.bind(this));

        // Refresh current document upon revert event from photoshop
        descriptor.addListener("revert", function () {
            this.flux.actions.documents.updateCurrentDocument();
        }.bind(this));

        return this.transfer(initActiveDocument);
    };

    /**
     * Initialize the inactive documents. (The active document is initialized beforeStartup.)
     * 
     * @param {{currentIndex: number, docCount: number}=} payload
     * @return {Promise}
     */
    var afterStartupCommand = function (payload) {
        if (payload) {
            return this.transfer(initInactiveDocuments, payload.currentIndex, payload.docCount);
        } else {
            return Promise.resolve();
        }
    };

    var createNew = {
        command: createNewCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI]
    };

    var open = {
        command: openCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI]
    };

    var close = {
        command: closeCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI]
    };

    var selectDocument = {
        command: selectDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.PS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP, locks.JS_UI]
    };

    var selectNextDocument = {
        command: selectNextDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.PS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP, locks.JS_UI]
    };

    var selectPreviousDocument = {
        command: selectPreviousDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.PS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP, locks.JS_UI]
    };

    var allocateDocument = {
        command: allocateDocumentCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI]
    };

    var disposeDocument = {
        command: disposeDocumentCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI]
    };

    var updateDocument = {
        command: updateDocumentCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var updateCurrentDocument = {
        command: updateCurrentDocumentCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var initInactiveDocuments = {
        command: initInactiveDocumentsCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var initActiveDocument = {
        command: initActiveDocumentCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var onReset = {
        command: onResetCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC, locks.JS_APP]
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var afterStartup = {
        command: afterStartupCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var revertCurrentDocument = {
        command: revertCurrentDocumentCommand,
        reads: locks.ALL_PS_LOCKS,
        writes: locks.ALL_PS_LOCKS
    };

    exports.createNew = createNew;
    exports.open = open;
    exports.close = close;
    exports.selectDocument = selectDocument;
    exports.selectNextDocument = selectNextDocument;
    exports.selectPreviousDocument = selectPreviousDocument;
    exports.allocateDocument = allocateDocument;
    exports.disposeDocument = disposeDocument;
    exports.updateDocument = updateDocument;
    exports.updateCurrentDocument = updateCurrentDocument;
    exports.revertCurrentDocument = revertCurrentDocument;
    exports.initActiveDocument = initActiveDocument;
    exports.initInactiveDocuments = initInactiveDocuments;
    exports.onReset = onReset;
    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports._priority = -99;
});
