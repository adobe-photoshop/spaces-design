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

    var photoshopEvent = require("adapter").lib.photoshopEvent,
        descriptor = require("adapter").ps.descriptor,
        documentLib = require("adapter").lib.document,
        selectionLib = require("adapter").lib.selection,
        appLib = require("adapter").lib.application;

    var guideActions = require("./guides"),
        exportActions = require("./export"),
        historyActions = require("./history"),
        layerActions = require("./layers"),
        toolActions = require("./tools"),
        searchActions = require("./search/documents"),
        libraryActions = require("./libraries"),
        application = require("./application"),
        preferencesActions = require("./preferences"),
        menu = require("./menu"),
        ui = require("./ui"),
        events = require("../events"),
        locks = require("js/locks"),
        pathUtil = require("js/util/path"),
        log = require("js/util/log"),
        headlights = require("js/util/headlights"),
        objUtil = require("js/util/object"),
        global = require("js/util/global");

    var templatesJSON = require("text!static/templates.json"),
        templates = JSON.parse(templatesJSON);

    /**
     * Properties to be included when requesting document
     * descriptors from Photoshop.
     * 
     * @private
     * @type {Array.<string>} 
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
        "mode",
        "isDirty"
    ];

    /**
     * Properties to be included if present when requesting
     * document descriptors from Photoshop.
     * 
     * @private
     * @type {Array.<string>} 
     */
    var _optionalDocumentProperties = [
        "targetLayers",
        "guidesVisibility",
        "smartGuidesVisibility",
        "format",
        "numberOfGuides"
    ];

    /**
     * Open command number
     * We use this if open document fails
     *
     * @const
     * @private
     * @type {number}
     */
    var _OPEN_DOCUMENT = 20;

    /**
     * Menu command ID to show the extended new document dialog
     *
     * @const
     * @private
     * @type {number}
     */
    var _NEW_DOCUMENT_EXTENDED = 10;

    /**
     * Preferences key for the last-used preset
     *
     * @const
     * @type {string}
     */
    var PRESET_PREFERENCE = "com.adobe.photoshop.spaces.design.preset";

    /**
     * Get a document descriptor for the given document reference. Only the
     * properties listed in _documentProperties will be included for performance
     * reasons.
     *
     * @private
     * @param {object} reference
     * @param {Array.<string>=} properties The properties to fetch. Defaults to
     *  _document properties.
     * @param {Array.<string>=} optionalProperties The optional properties to fetch.
     *  Defaults to _optionalDocumentProperties.
     * @return {Promise.<object>}
     */
    var _getDocumentByRef = function (reference, properties, optionalProperties) {
        if (properties === undefined) {
            properties = _documentProperties;
        }

        if (optionalProperties === undefined) {
            optionalProperties = _optionalDocumentProperties;
        }

        var documentPropertiesPromise = descriptor.multiGetProperties(reference, properties),
            optionalPropertiesPromise = descriptor.multiGetOptionalProperties(reference, optionalProperties);

        // fetch exports metadata via document extension data
        var nameSpace = global.EXTENSION_DATA_NAMESPACE,
            extensionPlayObject = documentLib.getExtensionData(reference, nameSpace),
            extensionPromise = descriptor.playObject(extensionPlayObject)
                .then(function (extensionData) {
                    var extensionDataRoot = extensionData[nameSpace];
                    return (extensionDataRoot && extensionDataRoot.exportsMetadata) || {};
                });

        return Promise.join(documentPropertiesPromise, optionalPropertiesPromise, extensionPromise,
            function (properties, optionalProperties, extensionProperties) {
                return _.merge(properties, optionalProperties, extensionProperties);
            });
    };

    /**
     * Get just a document descriptor for the given document reference. This is a light
     * version of _getDocumentByRef, which skips properties and other information that are
     * unnecessary for inactive documents.
     *
     * @private
     * @param {object} reference
     * @return {Promise.<object>}
     */
    var _getInactiveDocumentByRef = function (reference) {
        return descriptor.multiGetProperties(reference, _documentProperties);
    };

    /**
     * Get an array of layer descriptors for the given document descriptor.
     *
     * @private
     * @param {object} doc Document descriptor
     * @return {Promise.<{document: object, layers: Array.<object>}>}
     */
    var _getLayersForDocument = function (doc) {
        return layerActions._getLayersForDocument(doc)
            .then(function (layers) {
                return {
                    document: doc,
                    layers: layers
                };
            });
    };

    /**
     * Get an array of guide descriptors for the given document descriptor.
     *
     * @private
     * @param {object|number} docSpec Document descriptor or document ID
     * @return {Promise.<Array.<object>>}
     */
    var _getGuidesForDocument = function (docSpec) {
        var documentID;
        if (typeof docSpec === "object") {
            if (docSpec.numberOfGuides === 0) {
                return Promise.resolve();
            }

            documentID = docSpec.documentID;
        } else {
            documentID = docSpec;
        }

        var docRef = documentLib.referenceBy.id(documentID);

        return guideActions._getGuidesForDocumentRef(docRef);
    };

    /**
     * Verify the correctness of the list of open document IDs.
     *
     * @private
     * @return {Promise} Rejects if the number or order of open document IDs in
     *  differs from Photoshop.
     */
    var _verifyOpenDocuments = function () {
        var applicationStore = this.flux.store("application"),
            openDocumentIDs = applicationStore.getOpenDocumentIDs();

        return descriptor.getProperty("application", "numberOfDocuments")
            .bind(this)
            .then(function (docCount) {
                var docPromises = _.range(1, docCount + 1)
                    .map(function (index) {
                        var indexRef = documentLib.referenceBy.index(index);
                        return _getDocumentByRef(indexRef, ["documentID"], []);
                    });

                return Promise.all(docPromises);
            })
            .then(function (documentIDs) {
                if (openDocumentIDs.size !== documentIDs.length) {
                    throw new Error("Incorrect open document count: " + openDocumentIDs.size +
                        " instead of " + documentIDs.length);
                } else {
                    openDocumentIDs.forEach(function (openDocumentID, index) {
                        var documentID = documentIDs[index].documentID;
                        if (openDocumentID !== documentID) {
                            throw new Error("Incorrect document ID at index " + index + ": " + openDocumentID +
                                " instead of " + documentID);
                        }
                    });
                }
            });
    };

    /**
     * Verify the correctness of the currently active document ID.
     *
     * @private
     * @return {Promise} Rejects if active document ID differs from Photoshop.
     */
    var _verifyActiveDocument = function () {
        var currentRef = documentLib.referenceBy.current,
            applicationStore = this.flux.store("application"),
            currentDocumentID = applicationStore.getCurrentDocumentID();

        return _getDocumentByRef(currentRef, ["documentID"], [])
            .bind(this)
            .get("documentID")
            .then(function (documentID) {
                if (currentDocumentID !== documentID) {
                    throw new Error("Incorrect active document: " + currentDocumentID +
                        " instead of " + documentID);
                }
            }, function () {
                if (typeof currentDocumentID === "number") {
                    throw new Error("Spurious active document: " + currentDocumentID);
                }
            });
    };

    /**
     * Initialize document and layer state, emitting DOCUMENT_UPDATED events, for
     * all the inactive documents.
     *
     * @param {number} activeDocumentID
     * @param {Array.<number>} openDocumentIDs
     * @return {Promise}
     */
    var initInactiveDocuments = function (activeDocumentID, openDocumentIDs) {
        var otherDocPromises = openDocumentIDs
            .filter(function (documentID) {
                return documentID !== activeDocumentID;
            })
            .map(function (documentID) {
                var docRef = documentLib.referenceBy.id(documentID);

                // Only load essential properties for inactive documents
                return _getInactiveDocumentByRef(docRef)
                    .bind(this)
                    .then(function (document) {
                        this.dispatch(events.document.DOCUMENT_UPDATED, {
                            document: document
                        });
                    });
            }, this);

        return Promise.all(otherDocPromises)
            .bind(this)
            .then(function () {
                this.dispatch(events.application.INITIALIZED, { item: "inactiveDocuments" });
            });
    };
    initInactiveDocuments.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        private: true
    };

    /**
     * Initialize document and layer state, emitting DOCUMENT_UPDATED.
     *
     * @return {Promise.<{activeDocumentID: number, openDocumentIDs: Array.<number>}=>}
     */
    var initActiveDocument = function () {
        var appRef = appLib.referenceBy.current,
            rangeOpts = {
                range: "document",
                index: 1
            };

        return descriptor.getPropertyRange(appRef, rangeOpts, "documentID")
            .bind(this)
            .then(function (documentIDs) {
                if (documentIDs.length === 0) {
                    this.dispatch(events.application.INITIALIZED, { item: "activeDocument" });
                    return this.transfer("application.updateRecentFiles")
                        .bind(this)
                        .then(function () {
                            // Updates menu items in cases of no document
                            this.dispatch(events.menus.UPDATE_MENUS);
                        });
                }

                var currentRef = documentLib.referenceBy.current,
                    documentPromise = _getDocumentByRef(currentRef),
                    deselectPromise = descriptor.playObject(selectionLib.deselectAll());

                return documentPromise
                    .bind(this)
                    .then(function (currentDoc) {
                        var currentDocLayersPromise = _getLayersForDocument(currentDoc),
                            historyPromise = this.transfer(historyActions.queryCurrentHistory,
                                currentDoc.documentID, true),
                            // Load guides lazily if they're not currently visible
                            guidesVisible = currentDoc.guidesVisibility,
                            guidesPromise = guidesVisible ? _getGuidesForDocument(currentDoc) : Promise.resolve(),
                            flux = this.flux;

                        return Promise.join(currentDocLayersPromise,
                            historyPromise,
                            guidesPromise,
                            deselectPromise,
                            function (payload, historyPayload, guidesPayload) {
                                payload.current = true;
                                payload.history = historyPayload;
                                payload.guides = guidesPayload || (guidesVisible && []);
                                this.dispatch(events.document.DOCUMENT_UPDATED, payload);
                                this.dispatch(events.application.INITIALIZED, { item: "activeDocument" });
                            }.bind(this))
                            .bind(this)
                            .then(function () {
                                var currentDoc = flux.stores.application.getCurrentDocument();
                                
                                if (currentDoc.unsupported) {
                                    return this.transfer(layerActions.deselectAll, currentDoc);
                                }
                            })
                            .then(function () {
                                return {
                                    activeDocumentID: currentDoc.documentID,
                                    openDocumentIDs: documentIDs
                                };
                            })
                            .tap(function () {
                                var document = flux.stores.document.getDocument(currentDoc.documentID);
                                this.whenIdle("layers.initializeLayersBackground", document);
                            });
                    });
            });
    };
    initActiveDocument.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC, locks.JS_APP],
        transfers: [historyActions.queryCurrentHistory, "layers.deselectAll", "application.updateRecentFiles"]
    };

    /**
     * Update the document and layer state for the given document ID. Emits a
     * single DOCUMENT_UPDATED event.
     *
     * @param {number=} id The ID of the document to update. If omitted, the
     *  active document is updated.
     * @return {Promise}
     */
    var updateDocument = function (id) {
        var ref,
            current;

        if (typeof id === "number") {
            ref = documentLib.referenceBy.id(id);
            current = false;
        } else {
            ref = documentLib.referenceBy.current;
            current = true;
        }

        return _getDocumentByRef(ref)
            .bind(this)
            .then(function (doc) {
                var layersPromise = _getLayersForDocument(doc),
                    historyPromise = current ?
                        this.transfer(historyActions.queryCurrentHistory, doc.documentID, true) :
                        Promise.resolve(null),
                    // Load guides lazily if they're not currently visible
                    guidesVisible = current && doc.guidesVisibility,
                    guidesPromise = guidesVisible ? _getGuidesForDocument(doc) : Promise.resolve();

                return Promise.join(layersPromise, historyPromise, guidesPromise,
                    function (payload, historyPayload, guidesPayload) {
                        payload.current = current;
                        payload.history = historyPayload;
                        payload.guides = guidesPayload || (guidesVisible && []);
                        
                        this.dispatch(events.document.DOCUMENT_UPDATED, payload);
                    }.bind(this));
            })
            .tap(function () {
                if (current) {
                    var document = this.flux.stores.application.getCurrentDocument();
                    this.whenIdle("layers.initializeLayersBackground", document);
                }
            });
    };
    updateDocument.action = {
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC],
        transfers: [historyActions.queryCurrentHistory],
        lockUI: true
    };

    /**
     * Initialize any inactive and uninitialized documents with updateDocument.
     * If all documents are initialized, this is a fast no-op.
     *
     * @return {Promise}
     */
    var initializeDocuments = function () {
        var appStore = this.flux.store("application"),
            documentPromises = appStore.getUninitializedDocuments()
                .map(function (document) {
                    return this.transfer(updateDocument, document.id);
                }, this)
                .toArray();

        return Promise.all(documentPromises);
    };
    initializeDocuments.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: [updateDocument]
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
     * @param {boolean} isDocumentSaved - true if the user chooses save in the close-document modal dialog.
     * @return {Promise}
     */
    var disposeDocument = function (documentID, isDocumentSaved) {
        return _getSelectedDocumentID()
            .bind(this)
            .tap(function (nextDocumentID) {
                if (nextDocumentID) {
                    var nextDocument = this.flux.store("document").getDocument(nextDocumentID);
                    if (nextDocument && !nextDocument.layers) {
                        // The next document which will be active upon close of the current document
                        // needs to be initialized first
                        return this.transfer(updateDocument, nextDocumentID);
                    }
                }
            })
            .then(function (nextDocumentID) {
                var payload = {
                    documentID: documentID,
                    selectedDocumentID: nextDocumentID
                };

                this.dispatch(events.document.CLOSE_DOCUMENT, payload);

                return this.flux.store("application").getCurrentDocument();
            })
            .tap(function (newDocument) {
                return newDocument ?
                    this.transfer(historyActions.queryCurrentHistory, newDocument.id) : Promise.resolve();
            })
            .then(function (newDocument) {
                var resetLinkedPromise = this.transfer(layerActions.resetLinkedLayers, newDocument),
                    recentFilesPromise = this.transfer(application.updateRecentFiles),
                    updateTransformPromise = this.transfer(ui.updateTransform),
                    deleteTempFilesPromise = this.transfer(libraryActions.deleteGraphicTempFiles,
                        documentID, isDocumentSaved);

                return Promise.join(resetLinkedPromise,
                    updateTransformPromise,
                    recentFilesPromise,
                    deleteTempFilesPromise);
            });
    };
    disposeDocument.action = {
        reads: [],
        writes: [locks.JS_DOC, locks.JS_APP],
        transfers: [updateDocument, "layers.resetLinkedLayers", "history.queryCurrentHistory",
            "ui.updateTransform", "application.updateRecentFiles", "libraries.deleteGraphicTempFiles"],
        lockUI: true
    };

    /**
     * Allocate a newly opened document.
     * If this is the active document, prepare it for selection and emit SELECT_DOCUMENT
     *
     * @private
     * @param {!number} documentID
     * @return {Promise}
     */
    var allocateDocument = function (documentID) {
        return _getSelectedDocumentID()
            .bind(this)
            .tap(function (currentDocumentID) {
                // if this document is current, call updateDocument with an undefined documentID argument
                // so that it will interpreted as an update of the current document
                var updateDocId = currentDocumentID === documentID ? undefined : documentID;

                return this.transfer(updateDocument, updateDocId);
            })
            .then(function (currentDocumentID) {
                if (currentDocumentID === documentID) {
                    var payload = {
                        selectedDocumentID: currentDocumentID
                    };

                    this.dispatch(events.document.SELECT_DOCUMENT, payload);

                    return Promise.join(
                        this.transfer(historyActions.queryCurrentHistory, documentID, false),
                        this.transfer(ui.updateTransform));
                }
            });
    };
    allocateDocument.action = {
        reads: [locks.PS_APP],
        writes: [locks.JS_APP],
        transfers: [updateDocument, historyActions.queryCurrentHistory, ui.updateTransform],
        lockUI: true
    };

    /**
     * Show the native PS new document dialog to create a new document.
     *
     * @return {Promise}
     */
    var createNewExtended = function () {
        return this.transfer(ui.setOverlayOffsetsForFirstDocument)
            .bind(this)
            .then(function () {
                return this.transfer(menu.native, {
                    commandID: _NEW_DOCUMENT_EXTENDED,
                    waitForCompletion: true
                });
            });
    };
    createNewExtended.action = {
        reads: [],
        writes: [locks.PS_DOC, locks.PS_APP],
        transfers: [menu.native, ui.setOverlayOffsetsForFirstDocument],
        lockUI: true
    };

    /**
     * Creates a document in default settings, or using an optionally supplied preset
     *
     * @param {{preset: string}=} payload Optional payload containing a preset
     * @return {Promise}
     */
    var createNew = function (payload) {
        var preset,
            presetPromise,
            documentID;

        if (payload && payload.hasOwnProperty("preset")) {
            // If a preset is explicitly supplied, save it in the preferences as the last-used preset
            preset = payload.preset;
            presetPromise = this.transfer(preferencesActions.setPreference, PRESET_PREFERENCE, preset);
        } else {
            var preferencesStore = this.flux.store("preferences"),
                preferences = preferencesStore.getState();

            // Otherwise, if no preference is explicitly supplied, check the preferences for a preset
            preset = preferences.get(PRESET_PREFERENCE);
            if (!preset) {
                // If there is none, just use the first preset in the templates-definition file
                preset = templates[0].preset;
            }

            // And don't update the preferences if no preset was explicitly supplied
            presetPromise = Promise.resolve();
        }

        headlights.logEvent("file", "new-from-template", preset);

        return this.transfer(ui.setOverlayOffsetsForFirstDocument)
            .bind(this)
            .then(function () {
                var playObject = documentLib.createWithPreset(preset),
                    createPromise = descriptor.playObject(playObject)
                        .bind(this)
                        .then(function (result) {
                            documentID = result.documentID;
                            return this.transfer(allocateDocument, result.documentID);
                        });

                return Promise.join(createPromise, presetPromise);
            })
            .then(function () {
                return this.transfer(exportActions.addDefaultAsset, documentID);
            })
            .then(function () {
                return this.transfer(toolActions.changeVectorMaskMode, false);
            });
    };
    createNew.action = {
        reads: [locks.JS_PREF],
        writes: [locks.PS_DOC, locks.PS_APP],
        transfers: [preferencesActions.setPreference, allocateDocument,
            ui.setOverlayOffsetsForFirstDocument, exportActions.addDefaultAsset, toolActions.changeVectorMaskMode],
        post: [_verifyActiveDocument, _verifyOpenDocuments],
        locksUI: true
    };

    /**
     * Opens the document in the given path or, if none is given, prompts the
     * user for a path first.
     *
     * @param {string=} filePath If not provided, the user is promped for the file.     
     * @param {object=} settings - params accepted by the Adapter function documents#openDocument
     * @return {Promise}
     */
    var open = function (filePath, settings) {
        settings = settings || {};
        
        return this.transfer(ui.setOverlayOffsetsForFirstDocument)
            .bind(this)
            .then(function () {
                this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: false });

                if (!filePath) {
                    // An "open" event will be triggered
                    return this.transfer(menu.native, { commandID: _OPEN_DOCUMENT, waitForCompletion: true })
                        .bind(this)
                        .then(function () {
                            return this.transfer(toolActions.changeVectorMaskMode, false);
                        });
                }

                var documentRef = {
                    _path: filePath
                };

                return descriptor.playObject(documentLib.open(documentRef, settings))
                    .bind(this)
                    .then(function () {
                        var initPromise = this.transfer(initActiveDocument),
                            uiPromise = this.transfer(ui.updateTransform),
                            recentFilesPromise = this.transfer(application.updateRecentFiles);

                        return Promise.join(initPromise, uiPromise, recentFilesPromise);
                    }, function () {
                        // If file doesn't exist anymore, user will get an Open dialog
                        // If user cancels out of open dialog, PS will throw, so catch it here
                        this.transfer(menu.native, { commandID: _OPEN_DOCUMENT, waitForCompletion: true });
                    })
                    .then(function () {
                        return this.transfer(toolActions.changeVectorMaskMode, false);
                    });
            });
    };
    open.action = {
        reads: [],
        writes: [locks.PS_APP, locks.JS_UI],
        transfers: [initActiveDocument, ui.updateTransform, application.updateRecentFiles,
            ui.setOverlayOffsetsForFirstDocument, menu.native, toolActions.changeVectorMaskMode],
        lockUI: true,
        post: [_verifyActiveDocument, _verifyOpenDocuments]
    };

    /**
     * Close the given document or, if no document is provided, the active document.
     * If the document is dirty, show the Classic modal dialog that asks the user
     * whether or not they want to save.
     *
     * @param {Document=} document
     * @return {Promise}
     */
    var close = function (document) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: false });

        var closeObj = documentLib.close(document.id),
            playOptions = {
                interactionMode: descriptor.interactionMode.DISPLAY
            };

        return this.transfer(ui.cloak)
            .bind(this)
            .then(function () {
                return descriptor.playObject(closeObj, playOptions);
            })
            .then(function (result) {
                var isDocumentSaved = result.saving && result.saving._value === "yes";
                
                return this.transfer(disposeDocument, document.id, isDocumentSaved);
            }, function () {
                // the play command fails if the user cancels the close dialog
            });
    };
    close.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.JS_UI, locks.PS_APP, locks.PS_DOC],
        transfers: [ui.cloak, disposeDocument],
        lockUI: true,
        post: [_verifyActiveDocument, _verifyOpenDocuments]
    };

    /**
     * Activate the given already-open document
     *
     * @param {Document|number} documentSpec
     * @return {Promise}
     */
    var selectDocument = function (documentSpec) {
        var flux = this.flux,
            documentID = typeof documentSpec === "number" ? documentSpec : documentSpec.id,
            document = flux.stores.document.getDocument(documentID),
            documentRef = documentLib.referenceBy.id(documentID);

        this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: false });

        return this.transfer(ui.cloak)
            .bind(this)
            .then(function () {
                return descriptor.playObject(documentLib.select(documentRef));
            })
            .then(function () {
                if (!document.layers) {
                    // The now-active document has yet to be fully initialized.
                    return this.transfer(updateDocument);
                } else {
                    this.dispatch(events.document.SELECT_DOCUMENT, {
                        selectedDocumentID: documentID
                    });
                }
            })
            .then(function () {
                return this.transfer(toolActions.changeVectorMaskMode, false);
            })
            .then(function () {
                var toolStore = flux.store("tool");

                if (toolStore.getCurrentTool() === toolStore.getToolByID("superselectVector")) {
                    return this.transfer(toolActions.select, toolStore.getToolByID("newSelect"));
                }
            })
            .then(function () {
                return this.transfer(historyActions.queryCurrentHistory, documentID);
            })
            .then(function () {
                var currentDocument = this.flux.store("document").getDocument(documentID),
                    resetLinkedPromise = this.transfer(layerActions.resetLinkedLayers, currentDocument),
                    guidesPromise = this.transfer(guideActions.queryCurrentGuides, currentDocument),
                    updateTransformPromise = this.transfer(ui.updateTransform),
                    deselectPromise = descriptor.playObject(selectionLib.deselectAll());

                return Promise.join(resetLinkedPromise,
                    guidesPromise,
                    updateTransformPromise,
                    deselectPromise);
            });
    };
    selectDocument.action = {
        reads: [locks.JS_TOOL],
        writes: [locks.JS_APP],
        transfers: ["layers.resetLinkedLayers", historyActions.queryCurrentHistory,
            ui.updateTransform, toolActions.select, ui.cloak, guideActions.queryCurrentGuides,
            toolActions.changeVectorMaskMode, updateDocument],
        lockUI: true,
        post: [_verifyActiveDocument]
    };

    /**
     * Activate the next open document in the document index
     *
     * @return {Promise}
     */
    var selectNextDocument = function () {
        var applicationStore = this.flux.store("application"),
            nextDocument = applicationStore.getNextDocument();

        if (!nextDocument) {
            return Promise.resolve();
        }

        return this.transfer(selectDocument, nextDocument);
    };
    selectNextDocument.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.JS_UI],
        transfers: [selectDocument],
        lockUI: true
    };

    /**
     * Activate the previous open document in the document index
     *
     * @return {Promise}
     */
    var selectPreviousDocument = function () {
        var applicationStore = this.flux.store("application"),
            previousDocument = applicationStore.getPreviousDocument();

        if (!previousDocument) {
            return Promise.resolve();
        }

        return this.transfer(selectDocument, previousDocument);
    };
    selectPreviousDocument.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.JS_UI],
        transfers: [selectDocument],
        lockUI: true
    };

    /**
     * Queries the user for a destination and packages the open file in that location
     * collecting all linked smart objects under the package folder with updated links
     *
     * @return {Promise}
     */
    var packageDocument = function () {
        var interactionMode = descriptor.interactionMode.DISPLAY;

        return descriptor.play("packageFile", {}, { interactionMode: interactionMode })
            .catch(function () {
                // Empty catcher for cancellation
            });
    };
    packageDocument.action = {
        reads: [],
        writes: [locks.PS_DOC]
    };

    /**
     * Toggle the visibility of guides on the current document
     *
     * @return {Promise}
     */
    var toggleGuidesVisibility = function () {
        var document = this.flux.store("application").getCurrentDocument();

        if (!document) {
            return Promise.resolve();
        }

        var newVisibility = !document.guidesVisible,
            guideInitPromise;

        if (newVisibility && !document.guides) {
            guideInitPromise = _getGuidesForDocument(document.id);
        } else {
            guideInitPromise = Promise.resolve();
        }

        var dispatchPromise = guideInitPromise
            .bind(this)
            .then(function (guides) {
                this.dispatch(events.document.GUIDES_VISIBILITY_CHANGED, {
                    documentID: document.id,
                    guidesVisible: newVisibility,
                    guides: guides
                });
            });

        var playObject = documentLib.setGuidesVisibility(newVisibility),
            playPromise = descriptor.playObject(playObject);

        return Promise.join(dispatchPromise, playPromise)
            .bind(this)
            .then(function () {
                return this.transfer(guideActions.resetGuidePolicies);
            });
    };
    toggleGuidesVisibility.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [locks.JS_DOC, locks.PS_DOC],
        transfers: [guideActions.resetGuidePolicies]
    };

    /**
     * Toggle the visibility of smart guides on the current document
     *
     * @return {Promise}
     */
    var toggleSmartGuidesVisibility = function () {
        var document = this.flux.store("application").getCurrentDocument();

        if (!document) {
            return Promise.resolve();
        }

        var newVisibility = !document.smartGuidesVisible,
            dispatchPromise = this.dispatchAsync(events.document.GUIDES_VISIBILITY_CHANGED,
                { documentID: document.id, smartGuidesVisible: newVisibility });

        var playObject = documentLib.setSmartGuidesVisibility(newVisibility),
            playPromise = descriptor.playObject(playObject);

        return Promise.join(dispatchPromise, playPromise);
    };
    toggleSmartGuidesVisibility.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [locks.JS_DOC, locks.PS_DOC]
    };

    /**
     * Handler for the placeEvent notification. If the event contains
     * the layer ID of a layer not in the model, calls addLayers on
     * that layerID.
     *
     * When placing a file with an empty layer selected, the expected behaviors are:
     *
     * 1. place file via menu item (place linked or embedded): empty layer will be replaced.
     * 2. drag-n-drop local file: empty layer will be replaced.
     * 3. drag-n-drop CC libraries graphic: empty layer will not be replaced.
     *
     * @param {{ID: number}} event
     * @return {Promise}
     */
    var handlePlaceEvent = function (event) {
        var applicationStore = this.flux.store("application"),
            document = applicationStore.getCurrentDocument();

        if (!document) {
            var error = new Error("Place event received without a current document");
            return Promise.reject(error);
        }
        
        var newLayerID = event.ID,
            replacedLayerID = objUtil.getPath(event, "replaceLayer.from._id");
        
        if (!newLayerID) {
            return this.transfer(updateDocument);
        }

        var layer = document.layers.byID(newLayerID);
        
        // If the new layer is already existed (by expanding a libraries graphic that is an embedded SO),
        // we reset the layer to update its smart object type and position.
        if (layer) {
            return this.transfer(historyActions.newHistoryStateRogueSafe, document.id)
                .bind(this)
                .then(function () {
                    return this.transfer(layerActions.resetLayers, document, layer);
                })
                .then(function () {
                    return this.transfer(layerActions.resetIndex, document);
                });
        }

        return this.transfer(layerActions.addLayers, document, newLayerID, true, replacedLayerID || false);
    };
    handlePlaceEvent.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [updateDocument, "layers.addLayers", "layers.resetLayers", "layers.resetIndex",
        "history.newHistoryStateRogueSafe"],
        modal: true
    };

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _makeHandler,
        _openHandler,
        _selectHandler,
        _saveHandler,
        _pasteHandler,
        _placeEventHandler,
        _dragHandler;

    /**
     * Register event listeners for active and open document change events, and
     * initialize the active document list.
     *
     * @return {Promise.<{activeDocumentID: number=, openDocumentIDs: Array.<number>}>}
     */
    var beforeStartup = function () {
        var applicationStore = this.flux.store("application"),
            documentStore = this.flux.store("document");

        _makeHandler = function (event) {
            var target = photoshopEvent.targetOf(event);

            switch (target) {
            case "document":
                // A new document was created
                if (typeof event.documentID === "number") {
                    this.flux.actions.documents.allocateDocument(event.documentID);
                } else {
                    throw new Error("Document created with no ID");
                }

                break;
            }
        }.bind(this);
        descriptor.addListener("make", _makeHandler);

        _openHandler = function (event) {
            // A new document was opened
            if (typeof event.documentID === "number") {
                this.flux.actions.documents.allocateDocument(event.documentID)
                    .bind(this)
                    .then(function () {
                        this.flux.actions.application.updateRecentFilesThrottled();
                    });
            } else {
                throw new Error("Document opened with no ID");
            }
        }.bind(this);
        descriptor.addListener("open", _openHandler);

        _selectHandler = function (event) {
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
        }.bind(this);
        descriptor.addListener("select", _selectHandler);

        _saveHandler = function (event) {
            var saveAs = event.as,
                saveSucceeded = event.saveStage &&
                event.saveStage._value === "saveSucceeded";

            if (!saveSucceeded) {
                return;
            }

            var documentID = event.documentID,
                document = documentStore.getDocument(documentID);

            if (!document) {
                log.warn("Save event for unknown document ID", documentID);
                return;
            }

            this.flux.actions.application.updateRecentFilesThrottled();
            this.flux.actions.libraries.updateGraphicContent(documentID);

            this.dispatch(events.document.SAVE_DOCUMENT, {
                documentID: documentID,
                path: event.in._path
            });

            if (!saveAs) {
                return;
            }

            var path = event.in && event.in._path,
                format = event.as._obj,
                name = pathUtil.basename(path);

            // PSD files have couple different versions, so we cast them all under same format here
            // just like Photoshop does for UDocElement:format property.
            if (_.startsWith(format, "photoshop")) {
                format = "Photoshop";
            }

            this.dispatch(events.document.DOCUMENT_RENAMED, {
                documentID: documentID,
                format: format,
                name: name
            });
        }.bind(this);
        descriptor.addListener("save", _saveHandler);

        // Overkill, but pasting a layer just gets us a simple paste event with no descriptor
        _pasteHandler = function () {
            this.flux.actions.documents.updateDocument();
        }.bind(this);
        descriptor.addListener("paste", _pasteHandler);

        // This event is triggered when a new smart object layer is placed,
        // e.g., by dragging an image into an open document.
        _placeEventHandler = function (event) {
            this.flux.actions.documents.handlePlaceEvent(event);
        }.bind(this);
        descriptor.addListener("placeEvent", _placeEventHandler);

        // Refresh current document upon drag event from photoshop
        _dragHandler = function (event) {
            var currentDocument = applicationStore.getCurrentDocument();
            if (!currentDocument) {
                log.warn("Received layer drag event without a current document", event);
                return;
            }

            this.flux.actions.layers.addLayers(currentDocument, event.layerID);
        }.bind(this);
        descriptor.addListener("drag", _dragHandler);

        return this.transfer(initActiveDocument);
    };
    beforeStartup.action = {
        reads: [],
        writes: [],
        transfers: [initActiveDocument]
    };

    /**
     * Send info to search store about searching for documents and
     * initialize the inactive documents. (The active document is initialized beforeStartup.)
     *
     * @param {{activeDocumentID: number, openDocumentIDs: Array.<number>}=} payload
     * @return {Promise}
     */
    var afterStartup = function (payload) {
        searchActions.registerCurrentDocumentSearch.call(this);
        searchActions.registerRecentDocumentSearch.call(this);

        var activeDocumentID = payload && payload.activeDocumentID,
            openDocumentIDs = payload ? payload.openDocumentIDs : [];

        return this.transfer(initInactiveDocuments, activeDocumentID, openDocumentIDs);
    };
    afterStartup.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC, locks.JS_SEARCH],
        transfers: [initInactiveDocuments]
    };

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("make", _makeHandler);
        descriptor.removeListener("open", _openHandler);
        descriptor.removeListener("select", _selectHandler);
        descriptor.removeListener("save", _saveHandler);
        descriptor.removeListener("paste", _pasteHandler);
        descriptor.removeListener("placeEvent", _placeEventHandler);
        descriptor.removeListener("drag", _dragHandler);

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: []
    };

    exports.createNew = createNew;
    exports.createNewExtended = createNewExtended;
    exports.open = open;
    exports.close = close;
    exports.selectDocument = selectDocument;
    exports.selectNextDocument = selectNextDocument;
    exports.selectPreviousDocument = selectPreviousDocument;
    exports.allocateDocument = allocateDocument;
    exports.disposeDocument = disposeDocument;
    exports.updateDocument = updateDocument;
    exports.initActiveDocument = initActiveDocument;
    exports.initInactiveDocuments = initInactiveDocuments;
    exports.initializeDocuments = initializeDocuments;
    exports.packageDocument = packageDocument;
    exports.toggleGuidesVisibility = toggleGuidesVisibility;
    exports.toggleSmartGuidesVisibility = toggleSmartGuidesVisibility;
    exports.handlePlaceEvent = handlePlaceEvent;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;

    exports._getDocumentByRef = _getDocumentByRef;
    
    // This module needs to have a higher priority than tools
    // Otherwise, if rectangle tool is selected, we set shape defaults
    // which causes PS to set the fill color, and if there is an active document
    // with a shape layer selected, this will reset the color of that shape
    // But if document is initialized, we do a selection dance, avoiding this situation
    exports._priority = 1;
});
