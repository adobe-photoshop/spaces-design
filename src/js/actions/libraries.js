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
        _ = require("lodash"),
        $S = require("scriptjs");

    var descriptor = require("adapter").ps.descriptor,
        docAdapter = require("adapter").lib.document,
        colorAdapter = require("adapter").lib.color,
        layerEffectAdapter = require("adapter").lib.layerEffect,
        textLayerAdapter = require("adapter").lib.textLayer,
        libraryAdapter = require("adapter").lib.libraries,
        documentLib = require("adapter").lib.document,
        os = require("adapter").os;

    var events = require("js/events"),
        locks = require("js/locks"),
        nls = require("js/util/nls"),
        pathUtil = require("js/util/path"),
        log = require("js/util/log"),
        layerActionsUtil = require("js/util/layeractions"),
        collection = require("js/util/collection"),
        librariesUtil = require("js/util/libraries"),
        headlights = require("js/util/headlights"),
        layerActions = require("./layers"),
        exportActions = require("./export"),
        documentActions = require("./documents"),
        shapeActions = require("./shapes"),
        typeActions = require("./type"),
        historyActions = require("./history"),
        preferencesActions = require("./preferences"),
        LibrarySyncStatus = require("js/models/library_sync_status");

    /**
     * The external CC Libraries API is loaded here asynchronously, used in beforeStartup
     *
     * @type {Promise}
     */
    var apiLoadPromise = Promise.promisify($S)("file://shared/libs/cc-libraries-api.min.js");
        
    /**
     * For image elements, their extensions signify their representation type
     *
     * @type {Object}
     */
    var EXTENSION_TO_REPRESENTATION_MAP = {
        "psd": "image/vnd.adobe.photoshop",
        "psb": "application/photoshop.large",
        "ai": "application/illustrator",
        "idms": "application/vnd.adobe.indesign-idms",
        "pdf": "application/pdf",
        "png": "image/png",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "gif": "image/gif",
        "svg": "image/svg+xml",
        "bmp": "image/bmp",
        "shape": "image/vnd.adobe.shape+svg",
        "zip": "application/vnd.adobe.charts+zip"
    };
   
    /**
     * List of element types in CC Libraries.
     * 
     * @type {string}
     */
    var ELEMENT_CHARACTERSTYLE_TYPE = "application/vnd.adobe.element.characterstyle+dcx",
        ELEMENT_GRAPHIC_TYPE = "application/vnd.adobe.element.image+dcx",
        ELEMENT_LAYERSTYLE_TYPE = "application/vnd.adobe.element.layerstyle+dcx",
        ELEMENT_COLOR_TYPE = "application/vnd.adobe.element.color+dcx",
        ELEMENT_BRUSH_TYPE = "application/vnd.adobe.element.brush+dcx",
        ELEMENT_COLORTHEME_TYPE = "application/vnd.adobe.element.colortheme+dcx";
        
    /**
     * List of element representation types.
     *
     * @type {string}
     */
    var REP_CHARACTERSTYLE_TYPE = "application/vnd.adobe.characterstyle+json",
        REP_LAYERSTYLE_TYPE = "application/vnd.adobe.layerstyle",
        REP_COLOR_TYPE = "application/vnd.adobe.color+json",
        REP_PNG_TYPE = "image/png",
        REP_PHOTOSHOP_TYPE = "image/vnd.adobe.photoshop",
        // Large Document Format
        REP_PSB_TYPE = "application/photoshop.large";

    /**
     * List of acceptable image representations that PS can place as
     *
     * @private
     * @type {Set}
     */
    var _PLACEABLE_GRAPHIC_REPRESENTATION_TYPES = new Set([
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/bmp",
        "image/svg+xml",
        "image/vnd.adobe.photoshop",
        "application/photoshop",
        "application/photoshop.large",
        "application/illustrator",
        "application/pdf"
    ]);
    
    /**
     * List of graphic representations types that are editable in DS.
     * Due to the limitation in DS, we only support editing psd file.
     * 
     * TODO we should support editing images (png, jpg, etc.) by running the 
     * flatten command.
     *
     * @type {Set}
     */
    var EDITABLE_GRAPHIC_REPRESENTATION_TYPES = new Set([
        REP_PHOTOSHOP_TYPE,
        REP_PSB_TYPE
    ]);
    
    /**
     * Dimention of asset's preview image. Content is guaranteed to fit into a square of `size` x `size` pixels.
     * This should be use in AdobeLibraryElement#getRenditionPath and AdobeLibraryElement#setRenditionCache across DS. 
     *
     * For graphic asset, we have to follow the size used in CEP; it guarantees that we will get the latest rendition 
     * from AdobeLibraryElement#getRenditionPath when an element is edited outside of DS. 
     */
    var RENDITION_DEFAULT_SIZE = 80,
        RENDITION_GRAPHIC_SIZE = 202;
        
    /**
     * List of preference names used by the library store.
     *
     * @private
     * @type {string}
     */
    var _EDIT_STATUS_PREF = "graphicEditStatus",
        _LAST_SELECTED_LIBRARY_ID_PREF = "lastSelectedLibraryID";
        
    /**
     * For listening library sync events.
     *
     * @private 
     * @type {LibrarySyncStatus}
     */
    var _librarySyncStatus;

    /**
     * Finds a usable representation for the image element that PS will accept
     *
     * @private
     * @param {AdobeLibraryElement} element
     * @return {AdobeLibraryRepresentation}
     */
    var _findPlacableGraphicRepresentation = function (element) {
        var representations = element.representations;

        for (var i = 0; i < representations.length; i++) {
            if (_PLACEABLE_GRAPHIC_REPRESENTATION_TYPES.has(representations[i].type)) {
                return representations[i];
            }
        }

        throw new Error("Can't find a usable representation for image element: " + element.name);
    };
    
    /**
     * Helper function to get various types of unique temporary path. 
     *
     * @private
     * @return {Promise} promise
     */
    var _getTempPaths = function () {
        var tempName = (new Date().getTime()).toString();
            
        return os.getTempFilename(tempName).then(function (tempFilePath) {
            var tempBasePath = pathUtil.dirname(tempFilePath.path),
                // Add an extra 'p' to the end of the preview filename incase the temp file is also a PNG.
                tempPreviewPath = [tempBasePath, pathUtil.sep, tempName, "p.png"].join("");
            
            /*
                tempName: 1440197513414
                tempBasePath: /var/folders/qg/zxx...52g6/T/TemporaryItems
                tempFilePath: /var/folders/qg/zxx...52g6/T/TemporaryItems/1440197513414
                tempPreviewPath: /var/folders/qg/zxx...52g6/T/TemporaryItems/1440197513414p.png
             */
            return {
                tempName: tempName,
                tempBasePath: tempBasePath,
                tempFilePath: tempFilePath.path,
                tempPreviewPath: tempPreviewPath
            };
        });
    };

    /**
     * Uploads the selected layer(s) to the current library
     *
     * Achieves this by:
     *  - Creates a new element in the library
     *  - Calls PS to export the layer to a temporary location
     *  - Passes the temporary path to libraries API to update layer's content
     *  - Tells Photoshop the location of the content
     *  - Updates the document
     *
     * TODO Eventually, we'll need this to accept layer(s), library, and be more flexible
     * TODO Also, we definitely need to get rid of the update document call, but this is 0.1
     *
     * @return {Promise}
     */
    var createGraphicFromSelectedLayer = function () {
        var appStore = this.flux.store("application"),
            libState = this.flux.store("library").getState(),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libState.currentLibrary,
            currentLayers = currentDocument.layers.selected;

        if (!currentLibrary) {
            return Promise.resolve();
        }

        var firstLayer = currentLayers.last(), // currentLayers are in reversed order
            representationType = REP_PHOTOSHOP_TYPE;
        
        // However, if the layer is a smart object, and is owned by some other app, we need to change representation
        // we do this by matching extensions
        if (currentLayers.size === 1 && firstLayer.isSmartObject) {
            var layerFileName = firstLayer.smartObject.fileReference;

            // layerFileName will be undefined if CC Libraries is uploading the same layer.
            if (!layerFileName) {
                return Promise.resolve();
            }
            
            var fileExtension = pathUtil.extension(layerFileName);
            
            representationType = EXTENSION_TO_REPRESENTATION_MAP[fileExtension];

            if (!representationType) {
                throw new Error("Cannot find representation type of extension: " + fileExtension);
            }
        }

        var newElement;

        return _getTempPaths()
            .bind(this)
            .then(function (paths) {
                // Export the selected layers

                var previewSize = { w: RENDITION_GRAPHIC_SIZE, h: RENDITION_GRAPHIC_SIZE },
                    exportObj = libraryAdapter.exportLayer(paths.tempBasePath, paths.tempPreviewPath,
                        paths.tempName, previewSize);

                return descriptor.playObject(exportObj)
                    .then(function (saveData) {
                        paths.exportedLayerPath = saveData.in._path;
                        return paths;
                    });
            })
            .then(function (paths) {
                // Create new graphic asset of the exported layer(s) using the CC Libraries api. 

                currentLibrary.beginOperation();
                newElement = currentLibrary.createElement(firstLayer.name, ELEMENT_GRAPHIC_TYPE);

                return Promise.fromCallback(function (done) {
                    var representation = newElement.createRepresentation(representationType, "primary");

                    representation.updateContentFromPath(paths.exportedLayerPath, false, done);
                }).then(function () {
                    newElement.setRenditionCache(RENDITION_GRAPHIC_SIZE, paths.tempPreviewPath);
                }).finally(function () {
                    currentLibrary.endOperation();
                }).then(function () {
                    return Promise.fromCallback(function (done) {
                        newElement.getPrimaryRepresentation().getContentPath(done);
                    });
                });
            })
            .then(function (newElementContentPath) {
                var createObj = libraryAdapter.createElement(currentDocument.id,
                        collection.pluck(currentLayers, "id"), newElement, newElementContentPath);
                    
                return descriptor.playObject(createObj);
            })
            // Wait for 1 second before Photoshop changes layer's smart object type from linked SO to 
            // cloud-linked SO
            // 
            // FIXME: Instead of waiting, Photoshop should emit an event to tell DS that a layer's smart object 
            // type has changed. Watson https://watsonexp.corp.adobe.com/#bug=4073805
            .delay(1000)
            .then(function () {
                return this.transfer(layerActions.resetLayers, currentDocument, currentDocument.layers.selected);
            })
            .then(function () {
                return this.dispatchAsync(events.libraries.ASSET_CREATED, { element: newElement });
            });
    };
    createGraphicFromSelectedLayer.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [locks.JS_LIBRARIES, locks.CC_LIBRARIES],
        transfers: ["layers.resetLayers"]
    };

    /**
     * Uploads the selected single layer's character style to the current library
     *
     * Achieves this by:
     *  - Creates a new element in the library, and creates two representations
     *      - Primary one represents the character style
     *      - Secondary one is the rendered thumbnail
     *  - Calls PS to export the rendered thumbnail of style
     *  - Using fontStore.getTypeObjectFromLayer, creates a Design Library acceptable font object
     *  - Updates the rendition representation with the exported thumbnail
     *
     * TODO Make sure the typeObject is correctly created for everything we're supplying
     *
     * @return {Promise}
     */
    var createCharacterStyleFromSelectedLayer = function () {
        var appStore = this.flux.store("application"),
            libState = this.flux.store("library").getState(),
            fontStore = this.flux.store("font"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libState.currentLibrary,
            currentLayers = currentDocument.layers.selected,
            currentLayer = currentLayers.first();

        if (!currentLibrary ||
            currentLayers.size !== 1 ||
            !currentLayer || !currentLayer.isText) {
            return Promise.resolve();
        }

        var typeData = fontStore.getTypeObjectFromLayer(currentLayer),
            tempPreviewPath;
        
        if (!typeData.adbeFont) {
            log.warn("[CC Lib] can't create character style from mixed type layers!");
            return Promise.resolve();
        }
        
        var newElement;

        return _getTempPaths()
            .bind(this)
            .then(function (paths) {
                // Create Character Style preview 
                
                tempPreviewPath = paths.tempPreviewPath;
                
                var exportObj = libraryAdapter.createTextThumbnail(
                    tempPreviewPath,
                    typeData.adbeFont.postScriptName,
                    "Aa",
                    RENDITION_DEFAULT_SIZE,
                    colorAdapter.colorObject([0, 0, 0])
                );
                
                return descriptor.playObject(exportObj);
            })
            .then(function () {
                // Create new character style using the CC Libraries api. 
                
                currentLibrary.beginOperation();
                
                newElement = currentLibrary.createElement("", ELEMENT_CHARACTERSTYLE_TYPE);
                
                var representation = newElement.createRepresentation(REP_CHARACTERSTYLE_TYPE, "primary"),
                    imageRepresentation = newElement.createRepresentation(REP_PNG_TYPE, "rendition");
                    
                // Where magic happens
                representation.setValue("characterstyle", "data", typeData);
                    
                return Promise
                    .fromCallback(function (done) {
                        imageRepresentation.updateContentFromPath(tempPreviewPath, false, done);
                    })
                    .then(function () {
                        newElement.setRenditionCache(RENDITION_DEFAULT_SIZE, tempPreviewPath);
                    })
                    .finally(function () {
                        currentLibrary.endOperation();
                    });
            })
            .then(function () {
                return this.dispatchAsync(events.libraries.ASSET_CREATED, { element: newElement });
            });
    };
    createCharacterStyleFromSelectedLayer.action = {
        reads: [locks.JS_DOC, locks.JS_APP, locks.JS_TYPE],
        writes: [locks.JS_LIBRARIES, locks.CC_LIBRARIES]
    };

    /**
     * Uploads the selected single layer's effects as a single asset to the current library
     *
     * Achieves this by:
     *  - Using saveLayerStyle event of a layer, saves the .asl and the .png rendition of layer style
     *  - Assigns them as primary and rendition representations to the asset
     *
     * @return {Promise}
     */
    var createLayerStyleFromSelectedLayer = function () {
        var appStore = this.flux.store("application"),
            libState = this.flux.store("library").getState(),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libState.currentLibrary,
            currentLayers = currentDocument.layers.selected;

        if (!currentLibrary || currentLayers.size !== 1) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.first(),
            stylePath,
            tempPreviewPath,
            newElement;
            
        return _getTempPaths()
            .bind(this)
            .then(function (paths) {
                // Export style file of the selected layer.
                
                stylePath = paths.tempFilePath;
                tempPreviewPath = paths.tempPreviewPath;
                
                var layerRef = layerEffectAdapter.referenceBy.id(currentLayer.id),
                    saveLayerStyleObj = layerEffectAdapter.saveLayerStyleFile(layerRef, stylePath, tempPreviewPath);
                
                return descriptor.playObject(saveLayerStyleObj);
            })
            .then(function () {
                // Create new layer style asset using the CC Libraries api. 
                
                currentLibrary.beginOperation();

                newElement = currentLibrary.createElement(currentLayer.name, ELEMENT_LAYERSTYLE_TYPE);

                return Promise.fromCallback(function (done) {
                        var representation = newElement.createRepresentation(REP_LAYERSTYLE_TYPE, "primary");
                        representation.updateContentFromPath(stylePath, false, done);
                    })
                    .then(function () {
                        return Promise.fromCallback(function (done) {
                            var rendition = newElement.createRepresentation(REP_PNG_TYPE, "rendition");
                            rendition.updateContentFromPath(tempPreviewPath, false, done);
                        });
                    })
                    .then(function () {
                        newElement.setRenditionCache(RENDITION_DEFAULT_SIZE, tempPreviewPath);
                    })
                    .finally(function () {
                        currentLibrary.endOperation();
                    });
            })
            .then(function () {
                return this.dispatchAsync(events.libraries.ASSET_CREATED, { element: newElement });
            });
    };
    createLayerStyleFromSelectedLayer.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [locks.JS_LIBRARIES, locks.CC_LIBRARIES]
    };

    /**
     * Uploads the given color as a color asset
     *
     * @param {{r: number, g: number, b: number}} color Color to be added as an asset
     * @return {Promise}
     */
    var createColorAsset = function (color) {
        var libState = this.flux.store("library").getState(),
            currentLibrary = libState.currentLibrary;

        if (!currentLibrary) {
            return Promise.resolve();
        }

        currentLibrary.beginOperation();

        // Create the color asset
        var newElement = currentLibrary.createElement("", ELEMENT_COLOR_TYPE),
            representation = newElement.createRepresentation(REP_COLOR_TYPE, "primary");

        var colorData = {
            "mode": "RGB",
            "value": {
                "r": color.r,
                "g": color.g,
                "b": color.b
            },
            "type": "process"
        };

        // Assign the data to the representation
        representation.setValue("color", "data", colorData);

        currentLibrary.endOperation();

        // This is actually synchronous, but actions *must* return promises
        return this.dispatchAsync(events.libraries.ASSET_CREATED, { element: newElement });
    };
    createColorAsset.action = {
        reads: [],
        writes: [locks.JS_LIBRARIES, locks.CC_LIBRARIES]
    };

    /**
     * Updates asset's display name
     *
     * @param {AdobeLibraryElement} element
     * @param {string} name
     * @return {Promise}
     */
    var renameAsset = function (element, name) {
        if (element.name === name) {
            return Promise.resolve();
        }

        // Call element's setter function to update its name
        element.name = name;

        return this.dispatchAsync(events.libraries.ASSET_RENAMED);
    };
    renameAsset.action = {
        reads: [],
        writes: [locks.CC_LIBRARIES, locks.JS_LIBRARIES]
    };
    
    /**
     * Open the specified graphic asset for edit by creating a temp copy of the asset's document and open
     * in Photoshop. The library store will listen to the document save and close event. 
     * 
     * @param {AdobeLibraryElement} element
     * @return {Promise}
     */
    var openGraphicForEdit = function (element) {
        if (!element) {
            // FIXME: we should store the element in its edit status and re-create the element if it is deleted,
            //        so that users won't lose their change.
            log.debug("[CC Lib] openGraphicForEdit: element is missing. maybe it is already deleted.");
            return Promise.resolve();
        }
        
        var representation = element.getPrimaryRepresentation();
        
        if (representation && !EDITABLE_GRAPHIC_REPRESENTATION_TYPES.has(representation.type)) {
            log.debug("[CC Lib] openGraphicForEdit: unsupported graphic type: " + representation.type);
            return Promise.resolve();
        }
        
        var tempFilePath,
            tempPreviewPath;
        
        return Promise.bind(this)
            .then(function () {
                // Create a temp file of the element by copying its primary representation.
                
                var graphicEditStatus = this.flux.stores.library.getEditStatusByElement(element);
                
                // If the element already have a temp file, update the temp file path.
                if (graphicEditStatus) {
                    tempFilePath = graphicEditStatus.documentPath;
                    tempPreviewPath = graphicEditStatus.previewPath;
                    return;
                }
                
                // Otherwise, create a temp copy of the element for edit.
                return _getTempPaths()
                    .bind(this)
                    .then(function (paths) {
                        // Get temp file path and element's content path
                        
                        var tempFilename = this.flux.stores.library.generateTempFilename(element);
                        
                        tempFilePath = paths.tempBasePath + pathUtil.sep + tempFilename;
                        tempPreviewPath = tempFilePath.replace(".psd", "p.png");

                        return Promise.fromCallback(function (done) {
                            element.getPrimaryRepresentation().getContentPath(done);
                        });
                    })
                    .then(function (contentPath) {
                        // Copy the element's content to the temp path
                        
                        if (!contentPath) {
                            return Promise.reject("Failed to fetch content of element: " + element.name);
                        }
                        
                        return this.transfer(exportActions.copyFile, contentPath, tempFilePath);
                    });
            })
            .then(function () {
                // Open the graphic asset's temp file and tell PS to generate an updated 
                // preview whenever the file is saved
                
                var previewSetting = {
                        path: tempPreviewPath,
                        width: RENDITION_GRAPHIC_SIZE,
                        height: RENDITION_GRAPHIC_SIZE
                    },
                    openSettings = {
                        externalPreview: previewSetting,
                        forceMRU: false
                    };
                
                return this.transfer(documentActions.open, tempFilePath, openSettings);
            })
            .then(function () {
                var documentID = this.flux.stores.application.getCurrentDocumentID(),
                    payload = {
                        documentID: documentID,
                        documentPath: tempFilePath,
                        previewPath: tempPreviewPath,
                        element: element
                    };

                return this.dispatchAsync(events.libraries.OPEN_GRAPHIC_FOR_EDIT, payload);
            })
            .then(function () {
                return this.transfer(preferencesActions.setPreference,
                    _EDIT_STATUS_PREF, this.flux.stores.library.getState().editStatus);
            })
            .catch(function (e) {
                log.warn("[CC Lib] openGraphicForEdit:" + e);
            });
    };
    openGraphicForEdit.action = {
        reads: [],
        writes: [locks.CC_LIBRARIES, locks.JS_LIBRARIES],
        transfers: [exportActions.copyFile, "documents.open", preferencesActions.setPreference]
    };
    
    /**
     * Update the graphic asset's content by creating a new primary representation with the 
     * updated document and preview file.
     *
     * @param {number} documentID
     * @return {Promise}
     */
    var updateGraphicContent = function (documentID) {
        var libraryStore = this.flux.stores.library,
            libraryState = libraryStore.getState(),
            editStatus = libraryState.editStatus.get(documentID);
            
        if (!editStatus) {
            return Promise.resolve();
        }
        
        var element = libraryStore.getElementByReference(editStatus.elementReference);
        
        // Skip if the document's associated element is deleted, but keep the edit status so that
        // the temp files will be deleted when the document is closed.
        if (!element) {
            log.debug("[CC Lib] updateGraphicContent: element is missing. maybe it is already deleted.");
            return Promise.resolve();
        }
        
        var library = element.library;
            
        // Check if the library exists - if it was deleted, switch to the current library
        if (!library || library.deletedLocally) {
            library = libraryState.currentLibrary;

            if (!library) {
                // There's no current library, so don't do anything
                return Promise.resolve();
            }
        }

        var document = this.flux.stores.document.getDocument(documentID),
            updateGraphicPromise = Promise.resolve();

        if (!document.unsupported) {
            this.dispatch(events.libraries.UPDATING_GRAPHIC_CONTENT, { documentID: documentID, element: element });

            updateGraphicPromise = Promise
                .fromCallback(function (done) {
                    library.beginOperation();

                    // If the element we're editing was deleted, we recreate it as a new element, so the changes
                    // aren't lost. Otherwise, we just remove the existing representations so we can add the new ones
                    if (element.deletedLocally) {
                        element = library.createElement(element.name, element.type);
                    } else {
                        // TODO should keep representation's Adobe Stock info. However, Adobe Stocks are in photo,
                        // illustrator, and video formats currently, and none of them is editable in DS, so we can
                        // safely skip this step for now.
                        element.removeAllRepresentations();
                    }

                    var newRepresentation = element.createRepresentation(REP_PHOTOSHOP_TYPE, "primary");

                    // TODO should check and limit file size to 1024MB
                    newRepresentation.updateContentFromPath(editStatus.documentPath, done);
                })
                .bind(this)
                .then(function () {
                    element.setRenditionCache(RENDITION_GRAPHIC_SIZE, editStatus.previewPath);
                })
                .finally(function () {
                    library.endOperation();
                })
                .then(function () {
                    this.dispatch(events.libraries.UPDATED_GRAPHIC_CONTENT, { documentID: documentID });
                });
        }

        return updateGraphicPromise
            .bind(this)
            .then(function () {
                if (editStatus.isDocumentClosed) {
                    return this.transfer(deleteGraphicTempFiles, documentID);
                }
            });
    };
    updateGraphicContent.action = {
        reads: [],
        writes: [locks.JS_LIBRARIES, locks.CC_LIBRARIES],
        transfers: ["libraries.deleteGraphicTempFiles"]
    };
    
    /**
     * Delete graphic asset's temp document and preview files.
     *
     * @param {number} documentID
     * @param {boolean} isDocumentSaved - true if the user choose to save the document before close.
     */
    var deleteGraphicTempFiles = function (documentID, isDocumentSaved) {
        var libraryStore = this.flux.stores.library,
            libraryState = libraryStore.getState(),
            editStatus = libraryState.editStatus.get(documentID);
            
        if (!editStatus || editStatus.isUpdatingContent) {
            return Promise.resolve();
        }

        if (isDocumentSaved) {
            return this.transfer(updateGraphicContent, documentID);
        }
        
        var tempFiles = [editStatus.documentPath, editStatus.previewPath];
                    
        return this.transfer(exportActions.deleteFiles, tempFiles)
            .bind(this)
            .then(function () {
                this.dispatch(events.libraries.DELETED_GRAPHIC_TEMP_FILES, { documentID: documentID });
                
                return this.transfer(preferencesActions.setPreference,
                    _EDIT_STATUS_PREF, this.flux.stores.library.getState().editStatus);
            });
    };
    deleteGraphicTempFiles.action = {
        reads: [],
        writes: [locks.JS_LIBRARIES, locks.CC_LIBRARIES],
        transfers: [exportActions.deleteFiles, preferencesActions.setPreference, updateGraphicContent]
    };

    /**
     * Removes asset from the library it belongs to.
     *
     * @param {AdobeLibraryElement} element
     *
     * @return {Promise}
     */
    var removeAsset = function (element) {
        element.library.removeElement(element);
        return this.dispatchAsync(events.libraries.ASSET_REMOVED);
    };
    removeAsset.action = {
        reads: [],
        writes: [locks.JS_LIBRARIES, locks.CC_LIBRARIES]
    };

    /**
     * Places the selected asset in the document as a cloud linked smart object
     *  - Gets the path to the content from libraries
     *  - Sends the path to Photoshop with a place command
     *  - Add the new layer to the document store to update the UI.
     *
     * Right now, this only works with image assets, for other types of assets we'll need
     * different actions and handlers.
     *
     * @param {AdobeLibraryElement} element
     * @param {object} location of canvas
     *
     * @return {Promise}
     */
    var createLayerFromElement = function (element, location) {
        var flux = this.flux,
            appStore = flux.store("application"),
            libState = flux.store("library").getState(),
            uiStore = flux.store("ui"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libState.currentLibrary,
            pixelRatio = window.devicePixelRatio;

        if (!currentDocument || !currentLibrary) {
            return Promise.resolve();
        }

        location.x = uiStore.zoomWindowToCanvas(location.x) / pixelRatio;
        location.y = uiStore.zoomWindowToCanvas(location.y) / pixelRatio;

        return Promise
            .fromCallback(function (done) {
                var representation = _findPlacableGraphicRepresentation(element);

                representation.getContentPath(done);
            })
            .bind(this)
            .then(function (path) {
                if (!path) {
                    log.warn("[CC Lib] createLayerFromElement: unable to fetch \"" + element.displayName +
                        "\" content path");
                    return Promise.resolve();
                }
                
                var hasAlt = this.flux.stores.modifier.getState().alt;
                
                return Promise.bind(this)
                    .then(function () {
                        var docRef = docAdapter.referenceBy.id(currentDocument.id),
                            placeObj = libraryAdapter.placeElement(docRef, element, path, location);

                        // This command is played "asynchronously", which means that Photoshop will
                        // allow CEF to run while the command is being played (i.e., while in the
                        // smart-object placement tracker). As a consequence of playing the command
                        // in this mode, we do not expect the usual response and instead expect to
                        // receive a placeEvent notification immediately after the call resolves.
                        // So, although the command does not resolve until the placement has finished,
                        // it does resolve before the layer model has been updated because the event
                        // has not yet been received. For more details see issue #2177.
                        return descriptor.playObject(placeObj, { synchronous: false });
                    })
                    .then(function () {
                        if (!hasAlt) {
                            this.dispatch(events.libraries.PLACE_GRAPHIC_UPDATED, { isPlacing: true });
                        }
                    })
                    .then(function () {
                        // Dropping graphic asset with ALT/OPT modifier will expand the asset (instead of adding 
                        // CLSO layer) and result in creating multiple layers in Photoshop. Unlike regualr drop 
                        // event (without modifier), this will not trigger the "placeEvent" handler, so we need 
                        // to get the new layer IDs through the difference between the previous layer IDs and the
                        // next layer IDs.
                        //
                        // FIXME: we should instead get IDs back from Photoshop when layers are placed with modifier, 
                        //        so we don't have to get all the layer IDs.
                        //        https://watsonexp.corp.adobe.com/#bug=4080071
                        if (hasAlt) {
                            return this.transfer(layerActions.getLayerIDsForDocumentID, currentDocument.id)
                                .bind(this)
                                .then(function (nextDocumentIDS) {
                                    var nextLayerIDs = nextDocumentIDS.layerIDs,
                                        existingLayerIDs = currentDocument.layers.index.toArray(),
                                        newLayerIDs = _.difference(nextLayerIDs, existingLayerIDs).reverse();

                                    return this.transfer(layerActions.addLayers, currentDocument,
                                        newLayerIDs, true, false);
                                });
                        }
                    })
                    .catch(function () {
                        if (!hasAlt) {
                            return this.transfer(handleCompletePlacingGraphic);
                        }
                    });
            });
    };
    createLayerFromElement.action = {
        reads: [locks.CC_LIBRARIES, locks.JS_DOC, locks.JS_UI, locks.JS_APP],
        writes: [locks.JS_LIBRARIES, locks.PS_DOC],
        transfers: [layerActions.getLayerIDsForDocumentID, layerActions.addLayers,
            "libraries.handleCompletePlacingGraphic"]
    };
        
    /**
     * This event will be triggered when the user confirm or cancel the new layer 
     * created from createLayerFromElement
     * 
     * @return {Promise}
     */
    var handleCompletePlacingGraphic = function () {
        return this.dispatchAsync(events.libraries.PLACE_GRAPHIC_UPDATED, { isPlacing: false });
    };
    handleCompletePlacingGraphic.action = {
        reads: [locks.JS_APP],
        writes: [locks.JS_LIBRARIES]
    };

    /**
     * Applies the given layer style element to the active layers
     *  - Gets the path from primary representation of the asset
     *  - Passes it to PS call ApplyLayerStyle
     *
     * @param {AdobeLibraryElement} element [description]
     *
     * @return {Promise}
     */
    var applyLayerStyle = function (element) {
        var appStore = this.flux.store("application"),
            currentDocument = appStore.getCurrentDocument(),
            selectedLayers = currentDocument ? currentDocument.layers.selected : Immutable.List(),
            selectedUnlockedLayers = selectedLayers.filter(function (l) { return !l.locked; }),
            representation = element.getPrimaryRepresentation();

        if (selectedUnlockedLayers.isEmpty() || !representation) {
            return Promise.resolve();
        }

        return Promise.fromCallback(function (done) {
                representation.getContentPath(done);
            })
            .bind(this)
            .tap(function () {
                return this.transfer(historyActions.newHistoryState, currentDocument.id,
                    nls.localize("strings.ACTIONS.APPLY_LAYER_STYLE"));
            })
            .then(function (path) {
                var layerIDs = collection.pluck(selectedUnlockedLayers, "id"),
                    layerRef = layerIDs.map(layerEffectAdapter.referenceBy.id).toArray(),
                    placeObj = layerEffectAdapter.applyLayerStyleFile(layerRef, path),
                    options = {
                        historyStateInfo: {
                            name: nls.localize("strings.ACTIONS.APPLY_LAYER_STYLE"),
                            target: documentLib.referenceBy.id(currentDocument.id)
                        }
                    };

                return layerActionsUtil.playSimpleLayerActions(currentDocument, selectedUnlockedLayers,
                    placeObj, false, options);
            })
            .then(function () {
                // FIXME: This can be more optimistic
                return this.transfer(layerActions.resetLayers, currentDocument, currentDocument.layers.selected);
            });
    };
    applyLayerStyle.action = {
        reads: [locks.JS_APP, locks.CC_LIBRARIES],
        writes: [locks.JS_DOC, locks.PS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetLayers]
    };

    /**
     * Applies the given character style element to the selected text layers
     *  - Gets the path from primary representation of the asset
     *  - Uses textLayer adapter call to apply the style data
     *
     * @param {AdobeLibraryElement} element
     *
     * @return {Promise}
     */
    var applyCharacterStyle = function (element) {
        // TODO is this fundamentally action different than actions/type.applyTextStyle?
        var appStore = this.flux.store("application"),
            currentDocument = appStore.getCurrentDocument(),
            selectedLayers = currentDocument ? currentDocument.layers.selected : Immutable.List(),
            textLayers = selectedLayers.filter(function (l) { return l.isText && !l.locked; });

        if (textLayers.isEmpty()) {
            return Promise.resolve();
        }
        
        var styleData = librariesUtil.getCharStyleData(element);
        
        if (!styleData || !styleData.adbeFont) {
            return Promise.resolve();
        }

        var textLayerIDs = collection.pluck(textLayers, "id"),
            layerRef = textLayerIDs.map(textLayerAdapter.referenceBy.id).toArray(),
            applyObj = textLayerAdapter.applyTextStyle(layerRef, styleData),
            options = {
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.APPLY_TEXT_STYLE"),
                    target: documentLib.referenceBy.id(currentDocument.id)
                }
            };

        var playPromise = layerActionsUtil.playSimpleLayerActions(currentDocument, textLayers, applyObj,
                false, options),
            historyPromise = this.transfer(historyActions.newHistoryState, currentDocument.id,
                nls.localize("strings.ACTIONS.APPLY_TEXT_STYLE"));

        return Promise.join(playPromise, historyPromise)
            .bind(this)
            .then(function () {
                return this.transfer(layerActions.resetLayers, currentDocument, textLayers);
            });
    };
    applyCharacterStyle.action = {
        reads: [locks.JS_APP, locks.CC_LIBRARIES],
        writes: [locks.JS_DOC, locks.PS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetLayers]
    };

    /**
     * Applies the color the selected layers. It currently supports two types of layers:
     *  - Text layer: will set layer's font color
     *  - Vector layer: will set layer's fill color
     *
     * @param {Color} color
     *
     * @return {Promise}
     */
    var applyColor = function (color) {
        var currentDocument = this.flux.store("application").getCurrentDocument(),
            selectedLayers = currentDocument ? currentDocument.layers.allSelected : Immutable.List();

        if (!currentDocument || selectedLayers.isEmpty()) {
            return Promise.resolve();
        }

        var textLayers = selectedLayers.filter(function (l) { return l.isText; }),
            vectorLayers = selectedLayers.filter(function (l) { return l.isVector; }),
            transactionOpts = {
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.APPLY_LIBRARY_COLOR"),
                    target: docAdapter.referenceBy.id(currentDocument.id)
                }
            };

        var transaction = descriptor.beginTransaction(transactionOpts),
            actionOpts = {
                transaction: transaction,
                coalesce: false,
                enabled: true,
                ignoreAlpha: false
            },
            setTextColorPromise = textLayers.isEmpty() ? Promise.resolve() :
                this.transfer(typeActions.setColor, currentDocument, textLayers, color, actionOpts),
            setShapeFillColorPromise = vectorLayers.isEmpty() ? Promise.resolve() :
                this.transfer(shapeActions.setFillColor, currentDocument, vectorLayers, color, actionOpts);

        return Promise.join(setTextColorPromise, setShapeFillColorPromise)
            .then(function () {
                return descriptor.endTransaction(transaction);
            });
    };
    applyColor.action = {
        reads: [locks.JS_APP, locks.CC_LIBRARIES],
        writes: [locks.JS_DOC, locks.PS_DOC],
        transfers: [typeActions.setColor, shapeActions.setFillColor]
    };

    /**
     * Marks the given library ID as the active one
     *
     * @param {string} id
     *
     * @return {Promise}
     */
    var selectLibrary = function (id) {
        this.dispatch(events.libraries.LIBRARY_SELECTED, { id: id });
        
        var libraryState = this.flux.stores.library.getState();

        return this.transfer(preferencesActions.setPreference,
            _LAST_SELECTED_LIBRARY_ID_PREF, libraryState.currentLibraryID);
    };
    selectLibrary.action = {
        reads: [],
        writes: [locks.JS_LIBRARIES],
        transfers: [preferencesActions.setPreference]
    };

    /**
     * Creates a new library with the given name
     *
     * @param {string} name
     * @return {Promise.<Library>} Resolves to the created library
     */
    var createLibrary = function (name) {
        var libraryState = this.flux.store("library").getState(),
            libraryCollection = libraryState.libraryCollection,
            newLibrary = libraryCollection.createLibrary(name);
            
        this.dispatch(events.libraries.LIBRARY_CREATED, { library: newLibrary });

        return this.transfer(preferencesActions.setPreference,
            _LAST_SELECTED_LIBRARY_ID_PREF, libraryState.currentLibraryID);
    };
    createLibrary.action = {
        reads: [],
        writes: [locks.CC_LIBRARIES, locks.JS_LIBRARIES],
        transfers: [preferencesActions.setPreference]
    };

    /**
     * Removes a library from the collection
     *
     * @param {string} id
     * @return {Promise}
     */
    var removeLibrary = function (id) {
        var libraryStore = this.flux.store("library"),
            libraryState = libraryStore.getState(),
            libraryCollection = libraryState.libraryCollection,
            library = libraryStore.getLibraryByID(id);

        if (!libraryCollection || !library) {
            return Promise.resolve();
        }

        var payload = {
            id: library.id
        };

        return Promise.fromCallback(function (done) {
                libraryCollection.removeLibrary(library, done);
            })
            .bind(this)
            .then(function () {
                this.dispatch(events.libraries.LIBRARY_REMOVED, payload);
                
                return this.transfer(preferencesActions.setPreference,
                    _LAST_SELECTED_LIBRARY_ID_PREF, libraryState.currentLibraryID);
            });
    };
    removeLibrary.action = {
        reads: [],
        writes: [locks.CC_LIBRARIES, locks.JS_LIBRARIES],
        transfers: [preferencesActions.setPreference]
    };
    
    /**
     * Sync all libraries.
     *
     * @return {Promise}
     */
    var syncLibraries = function () {
        return this.dispatchAsync(events.libraries.SYNC_LIBRARIES);
    };
    syncLibraries.action = {
        reads: [],
        writes: [locks.CC_LIBRARIES, locks.JS_LIBRARIES]
    };

    /**
     * Updates library's display name
     *
     * @param {string} id
     * @param {string} name
     * @return {Promise}
     */
    var renameLibrary = function (id, name) {
        var library = this.flux.store("library").getLibraryByID(id);

        if (!library || library.name === name) {
            return Promise.resolve();
        }

        // Call library's setter function to update its name
        library.name = name;

        return this.dispatchAsync(events.libraries.LIBRARY_RENAMED, { id: id });
    };
    renameLibrary.action = {
        reads: [],
        writes: [locks.CC_LIBRARIES, locks.JS_LIBRARIES]
    };
    
    /**
     * Handle libraries load event. 
     *
     * @private
     * @return {Promise}
     */
    var handleLibrariesLoaded = function () {
        var ccLibraries = this.flux.store("library").getLibrariesAPI(),
            libraryCollection = (ccLibraries.getLoadedCollections() || [])[0],
            searchPromise,
            dispatchPromise;

        if (!libraryCollection) {
            searchPromise = this.transfer("search.libraries.registerLibrarySearch", []);
            dispatchPromise = this.dispatchAsync(events.libraries.LIBRARIES_UNLOADED);
        } else {
            searchPromise = this.transfer("search.libraries.registerLibrarySearch", libraryCollection.libraries);
            
            // List to library collection's sync event.
            _librarySyncStatus = new LibrarySyncStatus(libraryCollection);
            _librarySyncStatus.addSyncListener(handleSyncingLibraries.bind(this));
            
            var preferenceState = this.flux.stores.preferences.getState(),
                graphicEditStatusPref = preferenceState.get(_EDIT_STATUS_PREF) || {},
                lastSelectedLibraryID = preferenceState.get(_LAST_SELECTED_LIBRARY_ID_PREF);
                
            dispatchPromise = this.dispatchAsync(events.libraries.LIBRARIES_LOADED, {
                collection: libraryCollection,
                editStatus: graphicEditStatusPref,
                lastSelectedLibraryID: lastSelectedLibraryID
            });
        }

        return Promise.join(searchPromise, dispatchPromise);
    };
    handleLibrariesLoaded.action = {
        reads: [locks.CC_LIBRARIES],
        writes: [locks.JS_LIBRARIES],
        transfers: ["search.libraries.registerLibrarySearch"]
    };
    
    /**
     * Callback for LibrarySyncStatus. Check LibrarySyncStatus#addSyncListener for details.
     *
     * @private
     * @param {object} status
     * @param {boolean} status.isSyncing
     * @param {boolean} status.isDownloading
     * @param {number} status.libraryNumber
     * @param {boolean} status.libraryNumberChanged
     */
    var handleSyncingLibraries = function (status) {
        var libraryState = this.flux.stores.library.getState();
        
        this.dispatch(events.libraries.SYNCING_LIBRARIES, status);
        
        this.flux.actions.preferences.setPreference(_LAST_SELECTED_LIBRARY_ID_PREF, libraryState.currentLibraryID);
    };
    
    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _toolModalStateChangedHandler;

    var beforeStartup = function () {
        _toolModalStateChangedHandler = function (event) {
            var isPlacingGraphic = this.flux.store("library").getState().isPlacingGraphic,
                modalStateEnded = event.state && event.state._value === "exit";

            if (isPlacingGraphic && modalStateEnded) {
                this.flux.actions.libraries.handleCompletePlacingGraphic();
            }
        }.bind(this);
        descriptor.addListener("toolModalStateChanged", _toolModalStateChangedHandler);

        return apiLoadPromise
            .timeout(3000, "CC Libraries API load timeout, please don't restart and notify the chatroom!")
            .bind(this)
            .then(function () {
                /* global ccLibraries */
                // There is now a ccLibraries object in this scope
                // So we emit that to the store
                this.dispatch(events.libraries.LIBRARIES_API_LOADED, ccLibraries);

                var dependencies = {
                    // Photoshop on startup will grab the port of the CC Library process and expose it to us
                    vulcanCall: function (requestType, requestPayload, responseType, callback) {
                        descriptor.getProperty("application", "designSpaceLibrariesInfo")
                            .then(function (imsInfo) {
                                var port = imsInfo.port;

                                callback(JSON.stringify({ port: port }));
                            });
                    },
                    // Enable and log CC Libraries analytic events
                    // jscs:disable
                    // https://git.corp.adobe.com/pages/ProjectCentral/cc-libraries-api-js/tutorial-analytics_example.html
                    // jscs:enable
                    analytics: {
                        reportEvent: function (event, properties) {
                            // elementType: color, characterstyle, layerstyle, graphic
                            // ("image" type is replaced with "graphic" to keep naming consistency)
                            var elementType = properties.elementType === "image" ? "graphic" : properties.elementType;
                            
                            switch (event) {
                                case "createLibrary":
                                    headlights.logEvent("libraries", "library", "create");
                                    break;
                                case "deleteLibrary":
                                    headlights.logEvent("libraries", "library", "delete");
                                    break;
                                case "createElement":
                                    headlights.logEvent("libraries", "element", ["create", elementType].join("-"));
                                    break;
                                case "deleteElement":
                                    headlights.logEvent("libraries", "element", ["delete", elementType].join("-"));
                                    break;
                                case "updateElement":
                                    // updateType: info (rename), representation (update content)
                                    headlights.logEvent("libraries", "element",
                                        ["update", elementType, properties.updateType].join("-"));
                                    break;
                            }
                        }
                    }
                };

                // SHARED_LOCAL_STORAGE flag forces websocket use
                ccLibraries.configure(dependencies, {
                    SHARED_LOCAL_STORAGE: true,
                    ELEMENT_TYPE_FILTERS: [
                        ELEMENT_COLOR_TYPE,
                        ELEMENT_GRAPHIC_TYPE,
                        ELEMENT_CHARACTERSTYLE_TYPE,
                        ELEMENT_LAYERSTYLE_TYPE,
                        ELEMENT_BRUSH_TYPE,
                        ELEMENT_COLORTHEME_TYPE
                    ]
                });
            });
    };
    beforeStartup.action = {
        reads: [locks.JS_PREF],
        writes: [locks.JS_LIBRARIES, locks.CC_LIBRARIES]
    };

    /**
     * Libraries loadedCollections event handlers.
     *
     * @private
     * @type {function}
     */
    var _handleLibrariesLoadedHelper;

    /**
     * After startup, load the libraries
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        var ccLibraries = this.flux.store("library").getLibrariesAPI();

        if (_handleLibrariesLoadedHelper) {
            ccLibraries.removeLoadedCollectionsListener(_handleLibrariesLoadedHelper);
        }

        // Listen to the load event of CC Libraries. The event has two scenarios:
        //     loaded: Libraries data is ready for use. Fired after user sign in creative cloud.
        //     unloaded: Libraries data is cleared. Fired after user sign out creative cloud.
        _handleLibrariesLoadedHelper = function () {
            return this.flux.actions.libraries.handleLibrariesLoaded();
        }.bind(this);
        ccLibraries.addLoadedCollectionsListener(_handleLibrariesLoadedHelper);
        
        // Trigger the load event callback manually for initial start up.
        return this.transfer(handleLibrariesLoaded);
    };
    afterStartup.action = {
        reads: [locks.JS_LIBRARIES, locks.CC_LIBRARIES],
        writes: [],
        transfers: [handleLibrariesLoaded]
    };
    
    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: []
    };

    exports.RENDITION_DEFAULT_SIZE = RENDITION_DEFAULT_SIZE;
    exports.RENDITION_GRAPHIC_SIZE = RENDITION_GRAPHIC_SIZE;
    exports.ELEMENT_CHARACTERSTYLE_TYPE = ELEMENT_CHARACTERSTYLE_TYPE;
    exports.ELEMENT_GRAPHIC_TYPE = ELEMENT_GRAPHIC_TYPE;
    exports.ELEMENT_LAYERSTYLE_TYPE = ELEMENT_LAYERSTYLE_TYPE;
    exports.ELEMENT_COLOR_TYPE = ELEMENT_COLOR_TYPE;
    exports.ELEMENT_BRUSH_TYPE = ELEMENT_BRUSH_TYPE;
    exports.ELEMENT_COLORTHEME_TYPE = ELEMENT_COLORTHEME_TYPE;
    exports.EXTENSION_TO_REPRESENTATION_MAP = EXTENSION_TO_REPRESENTATION_MAP;
    exports.EDITABLE_GRAPHIC_REPRESENTATION_TYPES = EDITABLE_GRAPHIC_REPRESENTATION_TYPES;
    exports.REP_CHARACTERSTYLE_TYPE = REP_CHARACTERSTYLE_TYPE;
    exports.REP_LAYERSTYLE_TYPE = REP_LAYERSTYLE_TYPE;
    exports.REP_COLOR_TYPE = REP_COLOR_TYPE;
    exports.REP_PNG_TYPE = REP_PNG_TYPE;
    exports.REP_PHOTOSHOP_TYPE = REP_PHOTOSHOP_TYPE;

    exports.selectLibrary = selectLibrary;
    exports.createLibrary = createLibrary;
    exports.renameLibrary = renameLibrary;
    exports.removeLibrary = removeLibrary;
    exports.syncLibraries = syncLibraries;

    exports.createGraphicFromSelectedLayer = createGraphicFromSelectedLayer;
    exports.openGraphicForEdit = openGraphicForEdit;
    exports.updateGraphicContent = updateGraphicContent;
    exports.deleteGraphicTempFiles = deleteGraphicTempFiles;
    exports.createCharacterStyleFromSelectedLayer = createCharacterStyleFromSelectedLayer;
    exports.createLayerStyleFromSelectedLayer = createLayerStyleFromSelectedLayer;
    exports.createColorAsset = createColorAsset;
    exports.renameAsset = renameAsset;
    exports.removeAsset = removeAsset;

    exports.createLayerFromElement = createLayerFromElement;
    exports.handleCompletePlacingGraphic = handleCompletePlacingGraphic;
    exports.applyLayerStyle = applyLayerStyle;
    exports.applyCharacterStyle = applyCharacterStyle;
    exports.applyColor = applyColor;

    exports.handleLibrariesLoaded = handleLibrariesLoaded;
    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;
});
