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
        layerLib = require("adapter/lib/layer"),
        selectionLib = require("adapter/lib/selection"),
        PS = require("adapter/ps");

    var historyActions = require("./history"),
        layerActions = require("./layers"),
        application = require("./application"),
        preferencesActions = require("./preferences"),
        ui = require("./ui"),
        events = require("../events"),
        locks = require("js/locks"),
        pathUtil = require("js/util/path"),
        log = require("js/util/log"),
        headlights = require("js/util/headlights");

    var templatesJSON = require("text!static/templates.json"),
        templates = JSON.parse(templatesJSON);

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
        "mode",
        "isDirty"
    ];

    /**
     * @private
     * @type {Array.<string>} Properties to be included if present when requesting
     * document descriptors from Photoshop.
     */
    var _optionalDocumentProperties = [
        "targetLayers",
        "guidesVisibility",
        "smartGuidesVisibility",
        "format"
    ];

    /**
     * Open command number
     * We use this if open document fails
     *
     * @type {number}
     */
    var _OPEN_DOCUMENT = 20;

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
        var makeRefObj = function (property) {
            return {
                reference: reference,
                property: property
            };
        };

        if (properties === undefined) {
            properties = _documentProperties;
        }

        var refObjs = properties.map(makeRefObj),
            documentPropertiesPromise = descriptor.batchGetProperties(refObjs)
                .reduce(function (result, value, index) {
                    var property = properties[index];
                    result[property] = value;
                    return result;
                }, {});

        if (optionalProperties === undefined) {
            optionalProperties = _optionalDocumentProperties;
        }

        var optionalPropertiesPromise = descriptor.batchGetOptionalProperties(reference, optionalProperties);

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
        var docRef = documentLib.referenceBy.id(doc.documentID),
            startIndex = (doc.hasBackgroundLayer ? 0 : 1);

        return layerActions._getLayersForDocumentRef(docRef, startIndex)
            .then(function (layers) {
                return {
                    document: doc,
                    layers: layers.reverse()
                };
            });
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
                if (openDocumentIDs.length !== documentIDs.length) {
                    throw new Error("Incorrect open document count: " + openDocumentIDs.length +
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
     * Creates a document in default settings, or using an optionally supplied preset
     *
     * @param {{preset: string}=} payload Optional payload containing a preset
     * @return {Promise}
     */
    var createNewCommand = function (payload) {
        var preset,
            presetPromise;

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

        headlights.logEvent("file", "newFromTemplate", preset);

        var playObject = documentLib.createWithPreset(preset),
            createPromise = descriptor.playObject(playObject)
                .bind(this)
                .then(function (result) {
                    return this.transfer(allocateDocument, result.documentID);
                });

        return Promise.join(createPromise, presetPromise);
    };

    /**
     * Opens the document in the given path
     *
     * @param {string} filePath
     * @return {Promise}
     */
    var openCommand = function (filePath) {
        this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: false });

        var documentRef = {
            _path: filePath
        };

        return descriptor.playObject(documentLib.open(documentRef, {}))
            .bind(this)
            .then(function () {
                var initPromise = this.transfer(initActiveDocument),
                    uiPromise = this.transfer(ui.updateTransform),
                    recentFilesPromise = this.transfer(application.updateRecentFiles);

                return Promise.join(initPromise, uiPromise, recentFilesPromise);
            }, function () {
                // If file doesn't exist anymore, user will get an Open dialog
                // If user cancels out of open dialog, PS will throw, so catch it here
                return PS.performMenuCommand(_OPEN_DOCUMENT);
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

        this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: false });

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
                    this.dispatch(events.application.INITIALIZED, { item: "activeDocument" });
                    return;
                }

                var currentRef = documentLib.referenceBy.current;
                return _getDocumentByRef(currentRef)
                    .bind(this)
                    .then(function (currentDoc) {
                        var currentDocLayersPromise = _getLayersForDocument(currentDoc),
                            historyPromise = this.transfer(historyActions.queryCurrentHistory,
                                currentDoc.documentID, true),
                            deselectPromise = descriptor.playObject(selectionLib.deselectAll());

                        return Promise.join(currentDocLayersPromise,
                            historyPromise,
                            deselectPromise,
                            function (payload, historyPayload) {
                                payload.current = true;
                                payload.history = historyPayload;
                                this.dispatch(events.document.DOCUMENT_UPDATED, payload);
                                this.dispatch(events.application.INITIALIZED, { item: "activeDocument" });
                            }.bind(this))
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
        return _getSelectedDocumentID()
            .bind(this)
            .then(function (currentDocumentID) {
                var payload = {
                    documentID: documentID,
                    selectedDocumentID: currentDocumentID
                };

                this.dispatch(events.document.CLOSE_DOCUMENT, payload);

                var newDocument = this.flux.store("application").getCurrentDocument(),
                    resetLinkedPromise = this.transfer(layerActions.resetLinkedLayers, newDocument),
                    recentFilesPromise = this.transfer(application.updateRecentFiles),
                    updateTransformPromise = this.transfer(ui.updateTransform);

                return Promise.join(resetLinkedPromise,
                        updateTransformPromise,
                        recentFilesPromise);
            });
    };

    /**
     * Allocate a newly opened document.
     * If this is the active document, prepare it for selection and emit SELECT_DOCUMENT
     *
     * @private
     * @param {!number} documentID
     * @return {Promise}
     */
    var allocateDocumentCommand = function (documentID) {
        var updatePromise = this.transfer(updateDocument, documentID),
            selectedDocumentPromise = _getSelectedDocumentID();

        return Promise.join(
            selectedDocumentPromise,
            updatePromise,
            function (currentDocumentID) {
                if (currentDocumentID === documentID) {
                    var payload = {
                        selectedDocumentID: currentDocumentID
                    };

                    this.dispatch(events.document.SELECT_DOCUMENT, payload);

                    return Promise.join(
                        this.transfer(historyActions.queryCurrentHistory, documentID, false),
                        this.transfer(ui.updateTransform));
                }
            }.bind(this));
    };

    /**
     * Update the document and layer state for the given document ID. Emits a
     * single DOCUMENT_UPDATED event.
     *
     * @param {number=} id The ID of the document to update. If omitted, the
     *  active document is updated.
     * @return {Promise}
     */
    var updateDocumentCommand = function (id) {
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
                        Promise.resolve(null);

                return Promise.join(layersPromise, historyPromise,
                    function (payload, historyPayload) {
                        payload.current = current;
                        payload.history = historyPayload;
                        return this.dispatchAsync(events.document.DOCUMENT_UPDATED, payload);
                    }.bind(this));
            });
    };

    /**
     * Activate the given already-open document
     *
     * @param {Document} document
     * @return {Promise}
     */
    var selectDocumentCommand = function (document) {
        var documentRef = documentLib.referenceBy.id(document.id);
        return descriptor.playObject(documentLib.select(documentRef))
            .bind(this)
            .then(function () {
                var payload = {
                    selectedDocumentID: document.id
                };

                this.dispatch(events.document.SELECT_DOCUMENT, payload);
            })
            .then(function () {
                var toolStore = this.flux.store("tool");

                if (toolStore._currentTool === toolStore.getToolByID("superselectVector")) {
                    this.flux.actions.tools.select(toolStore.getToolByID("newSelect"));
                }
            })
            .then(function () {
                var resetLinkedPromise = this.transfer(layerActions.resetLinkedLayers, document),
                    historyPromise = this.transfer(historyActions.queryCurrentHistory, document.id),
                    updateTransformPromise = this.transfer(ui.updateTransform),
                    deselectPromise = descriptor.playObject(selectionLib.deselectAll());

                return Promise.join(resetLinkedPromise,
                    historyPromise,
                    updateTransformPromise,
                    deselectPromise);
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

        this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: false });

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

        this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: false });

        return Promise.delay(50).bind(this)
            .then(function () {
                this.transfer(selectDocument, previousDocument);
            });
    };

    /**
     * Queries the user for a destination and packages the open file in that location
     * collecting all linked smart objects under the package folder with updated links
     * @return {Promise}
     */
    var packageDocumentCommand = function () {
        var interactionMode = descriptor.interactionMode.DISPLAY;

        return descriptor.play("packageFile", {}, { interactionMode: interactionMode })
            .catch(function () {
                // Empty catcher for cancellation
            });
    };

    /**
     * Toggle the visibility of guides on the current document
     *
     * @return {Promise}
     */
    var toggleGuidesVisibilityCommand = function () {
        var document = this.flux.store("application").getCurrentDocument();

        if (!document) {
            return Promise.resolve();
        }

        var newVisibility = !document.guidesVisible,
            dispatchPromise = this.dispatchAsync(events.document.GUIDES_VISIBILITY_CHANGED,
                { documentID: document.id, guidesVisible: newVisibility });

        var playObject = documentLib.setGuidesVisibility(newVisibility),
            playPromise = descriptor.playObject(playObject);

        return Promise.join(dispatchPromise, playPromise);
    };

    /**
     * Toggle the visibility of smart guides on the current document
     *
     * @return {Promise}
     */
    var toggleSmartGuidesVisibilityCommand = function () {
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

    /**
     * Sets artboard auto nesting for the given document ID
     *
     * @param {number} documentID
     * @param {boolean} enabled Whether layers should be automatically nested
     * @return {Promise}
     */
    var setAutoNestingCommand = function (documentID, enabled) {
        if (enabled) {
            log.warn("In current version of Design Space, we shouldn't enable artboard auto-nesting!");
        }

        var documentRef = documentLib.referenceBy.id(documentID),
            nestingObj = documentLib.setArtboardAutoAttributes(documentRef, enabled);

        return descriptor.playObject(nestingObj);
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
     * @return {Promise.<{currentIndex: number, docCount: number}>}
     */
    var beforeStartupCommand = function () {
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
                        this.flux.actions.application.updateRecentFiles();
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

            this.flux.actions.application.updateRecentFiles();

            this.dispatch(events.document.SAVE_DOCUMENT, {
                documentID: documentID
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
        _placeEventHandler = function () {
            this.flux.actions.documents.updateDocument();
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

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onResetCommand = function () {
        descriptor.removeListener("make", _makeHandler);
        descriptor.removeListener("open", _openHandler);
        descriptor.removeListener("select", _selectHandler);
        descriptor.removeListener("save", _saveHandler);
        descriptor.removeListener("paste", _pasteHandler);
        descriptor.removeListener("placeEvent", _placeEventHandler);
        descriptor.removeListener("drag", _dragHandler);

        return Promise.resolve();
    };

    var createNew = {
        command: createNewCommand,
        reads: [locks.PS_DOC, locks.PS_APP, locks.JS_PREF],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI, locks.PS_DOC, locks.JS_PREF],
        post: [_verifyActiveDocument, _verifyOpenDocuments]
    };

    var open = {
        command: openCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI],
        lockUI: true,
        post: [_verifyActiveDocument, _verifyOpenDocuments]
    };

    var close = {
        command: closeCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI],
        lockUI: true,
        post: [_verifyActiveDocument, _verifyOpenDocuments]
    };

    var selectDocument = {
        command: selectDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.PS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP, locks.JS_UI],
        lockUI: true,
        post: [_verifyActiveDocument]
    };

    var selectNextDocument = {
        command: selectNextDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.PS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP, locks.JS_UI],
        lockUI: true
    };

    var selectPreviousDocument = {
        command: selectPreviousDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.PS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP, locks.JS_UI],
        lockUI: true
    };

    var allocateDocument = {
        command: allocateDocumentCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI],
        lockUI: true
    };

    var disposeDocument = {
        command: disposeDocumentCommand,
        reads: [locks.PS_DOC, locks.PS_APP],
        writes: [locks.JS_DOC, locks.JS_APP, locks.JS_UI],
        lockUI: true
    };

    var updateDocument = {
        command: updateDocumentCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        lockUI: true
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

    var packageDocument = {
        command: packageDocumentCommand,
        reads: [locks.PS_DOC],
        writes: []
    };

    var toggleGuidesVisibility = {
        command: toggleGuidesVisibilityCommand,
        reads: [locks.JS_DOC, locks.PS_DOC],
        writes: [locks.JS_DOC, locks.PS_DOC]
    };

    var toggleSmartGuidesVisibility = {
        command: toggleSmartGuidesVisibilityCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var setAutoNesting = {
        command: setAutoNestingCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
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

    var onReset = {
        command: onResetCommand,
        reads: [],
        writes: []
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
    exports.initActiveDocument = initActiveDocument;
    exports.initInactiveDocuments = initInactiveDocuments;
    exports.packageDocument = packageDocument;
    exports.setAutoNesting = setAutoNesting;
    exports.toggleGuidesVisibility = toggleGuidesVisibility;
    exports.toggleSmartGuidesVisibility = toggleSmartGuidesVisibility;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;

    exports._getDocumentByRef = _getDocumentByRef;
    exports._priority = -99;
});
