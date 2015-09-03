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
        CCLibraries = require("file://shared/libs/cc-libraries-api.min.js");

    var descriptor = require("adapter/ps/descriptor"),
        docAdapter = require("adapter/lib/document"),
        colorAdapter = require("adapter/lib/color"),
        layerEffectAdapter = require("adapter/lib/layerEffect"),
        textLayerAdapter = require("adapter/lib/textLayer"),
        libraryAdapter = require("adapter/lib/libraries"),
        os = require("adapter/os");

    var events = require("js/events"),
        locks = require("js/locks"),
        strings = require("i18n!nls/strings"),
        pathUtil = require("js/util/path"),
        log = require("js/util/log"),
        layerActionsUtil = require("js/util/layeractions"),
        collection = require("js/util/collection"),
        layerActions = require("./layers"),
        exportActions = require("./export"),
        documentActions = require("./documents"),
        searchActions = require("./search/libraries"),
        shapeActions = require("./shapes"),
        typeActions = require("./type"),
        preferencesActions = require("./preferences"),
        policyActions = require("./policy"),
        LibrarySyncStatus = require("js/models/library_sync_status");

    /**
     * For image elements, their extensions signify their representation type
     *
     * @type {Object}
     */
    var _EXTENSION_TO_REPRESENTATION_MAP = {
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
     * @private
     * @type {string}
     */
    var _REP_CHARACTERSTYLE_TYPE = "application/vnd.adobe.characterstyle+json",
        _REP_LAYERSTYLE_TYPE = "application/vnd.adobe.layerstyle",
        _REP_COLOR_TYPE = "application/vnd.adobe.color+json",
        _REP_PNG_TYPE = "image/png",
        _REP_PHOTOSHOP_TYPE = "image/vnd.adobe.photoshop";

    /**
     * List of acceptable image representations that PS can place as
     *
     * @type {Array}
     */
    var _EDITABLE_IMAGE_REPRESENTATIONS = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/bmp",
        "application/photoshop",
        "image/vnd.adobe.photoshop",
        "application/photoshop.large",
        "application/illustrator",
        "application/pdf"
    ];
    
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
    var _findPlacableImageRepresentation = function (element) {
        var representations = element.representations;

        for (var i = 0; i < representations.length; i++) {
            if (_EDITABLE_IMAGE_REPRESENTATIONS.indexOf(representations[i].type) !== -1) {
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
            libStore = this.flux.store("library"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary(),
            currentLayers = currentDocument.layers.selected;

        if (!currentLibrary) {
            return Promise.resolve();
        }

        var firstLayer = currentLayers.last(), // currentLayers are in reversed order
            representationType = _REP_PHOTOSHOP_TYPE,
            newElement;

        // However, if the layer is a smart object, and is owned by some other app, we need to change representation
        // we do this by matching extensions
        if (currentLayers.size === 1 && firstLayer.isSmartObject()) {
            var layerFileName = firstLayer.smartObject.fileReference;

            // layerFileName will be undefined if CC Libraries is uploading the same layer.
            if (!layerFileName) {
                return Promise.resolve();
            }

            var fileExtension = pathUtil.extension(layerFileName);

            if (_EXTENSION_TO_REPRESENTATION_MAP.hasOwnProperty(fileExtension)) {
                representationType = _EXTENSION_TO_REPRESENTATION_MAP[fileExtension];
            }
        }

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

                return Promise.fromNode(function (done) {
                    var representation = newElement.createRepresentation(representationType, "primary");

                    representation.updateContentFromPath(paths.exportedLayerPath, false, done);
                }).then(function () {
                    newElement.setRenditionCache(RENDITION_GRAPHIC_SIZE, paths.tempPreviewPath);
                }).finally(function () {
                    currentLibrary.endOperation();
                }).then(function () {
                    return Promise.fromNode(function (done) {
                        newElement.getPrimaryRepresentation().getContentPath(done);
                    });
                });
            })
            .then(function (newElementContentPath) {
                var createObj = libraryAdapter.createElement(currentDocument.id,
                        collection.pluck(currentLayers, "id"), newElement, newElementContentPath);
                    
                return descriptor.playObject(createObj);
            })
            .then(function () {
                return this.transfer(layerActions.resetLayers, currentDocument,
                    currentDocument.layers.selected);
            })
            .then(function () {
                var payload = {
                    library: currentLibrary,
                    element: newElement,
                    document: currentDocument,
                    layers: firstLayer
                };
                // WE ONLY LINK IF THE LAYER WAS A SMART OBJECT
                return this.dispatchAsync(events.libraries.ASSET_CREATED, payload);
            });
    };
    createGraphicFromSelectedLayer.reads = [locks.JS_DOC, locks.JS_APP];
    createGraphicFromSelectedLayer.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    createGraphicFromSelectedLayer.transfers = [layerActions.resetLayers];

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
            libStore = this.flux.store("library"),
            fontStore = this.flux.store("font"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary(),
            currentLayers = currentDocument.layers.selected,
            currentLayer = currentLayers.first();

        if (!currentLibrary ||
            currentLayers.size !== 1 ||
            !currentLayer || !currentLayer.isTextLayer()) {
            return Promise.resolve();
        }

        var typeData = fontStore.getTypeObjectFromLayer(currentLayer),
            tempPreviewPath;
        
        if (!typeData.adbeFont) {
            log.warn("Can't create character style from mixed type layers!");
            return Promise.resolve();
        }

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
                
                var newElement = currentLibrary.createElement(currentLayer.name, ELEMENT_CHARACTERSTYLE_TYPE),
                    representation = newElement.createRepresentation(_REP_CHARACTERSTYLE_TYPE, "primary"),
                    imageRepresentation = newElement.createRepresentation(_REP_PNG_TYPE, "rendition");
                    
                // Where magic happens
                representation.setValue("characterstyle", "data", typeData);
                    
                return Promise
                    .fromNode(function (done) {
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
                return this.dispatchAsync(events.libraries.ASSET_CREATED, {});
            });
    };
    createCharacterStyleFromSelectedLayer.reads = [locks.JS_DOC, locks.JS_APP, locks.JS_TYPE];
    createCharacterStyleFromSelectedLayer.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];

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
            libStore = this.flux.store("library"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary(),
            currentLayers = currentDocument.layers.selected;

        if (!currentLibrary || currentLayers.size !== 1) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.first(),
            stylePath,
            tempPreviewPath;
            
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

                var newElement = currentLibrary.createElement(currentLayer.name, ELEMENT_LAYERSTYLE_TYPE);

                return Promise.fromNode(function (done) {
                        var representation = newElement.createRepresentation(_REP_LAYERSTYLE_TYPE, "primary");
                        representation.updateContentFromPath(stylePath, false, done);
                    })
                    .then(function () {
                        return Promise.fromNode(function (done) {
                            var rendition = newElement.createRepresentation(_REP_PNG_TYPE, "rendition");
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
                return this.dispatchAsync(events.libraries.ASSET_CREATED, {});
            });
    };
    createLayerStyleFromSelectedLayer.reads = [locks.JS_DOC, locks.JS_APP];
    createLayerStyleFromSelectedLayer.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];

    /**
     * Uploads the given color as a color asset
     *
     * @param {{r: number, g: number, b: number}} color Color to be added as an asset
     * @return {Promise}
     */
    var createColorAsset = function (color) {
        var libStore = this.flux.store("library"),
            currentLibrary = libStore.getCurrentLibrary();

        if (!currentLibrary) {
            return Promise.resolve();
        }

        currentLibrary.beginOperation();

        // Create the color asset
        var newElement = currentLibrary.createElement("", ELEMENT_COLOR_TYPE),
            representation = newElement.createRepresentation(_REP_COLOR_TYPE, "primary");

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
        return this.dispatchAsync(events.libraries.ASSET_CREATED, {});
    };
    createColorAsset.reads = [];
    createColorAsset.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];

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
    renameAsset.reads = [];
    renameAsset.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    
    /**
     * Open the specified graphic asset for edit by creating a temp copy of the asset's document and open
     * in Photoshop. The library store will listen to the document save and close event. 
     * 
     * @param {AdobeLibraryElement} element
     * @return {Promise}
     */
    var openGraphicForEdit = function (element) {
        var representation = element.getPrimaryRepresentation();
        
        if (representation.type !== _REP_PHOTOSHOP_TYPE) {
            // Due to the limitation in DS, we only support editing psd file.
            // TODO we should support editing images (png, jpg, etc.) by running the 
            // flatten command.
            log.debug("[CC Lib] unsupported graphic type: " + representation.type);
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

                        return Promise.fromNode(function (done) {
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
                };
                
                return this.transfer(documentActions.open, tempFilePath, { externalPreview: previewSetting });
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
                    _EDIT_STATUS_PREF, this.flux.stores.library.getEditStatus(true));
            })
            .catch(function (e) {
                log.warn("[CC Lib] openGraphicForEdit:" + e);
            });
    };
    openGraphicForEdit.reads = [];
    openGraphicForEdit.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    openGraphicForEdit.transfers = [exportActions.copyFile, documentActions.open,
        preferencesActions.setPreference];
    
    /**
     * Update the graphic asset's content by creating a new primary representation with the 
     * updated document and preview file.
     *
     * @param {number} documentID
     * @return {Promise}
     */
    var updateGraphicContent = function (documentID) {
        var libraryStore = this.flux.stores.library,
            editStatus = libraryStore.getEditStatus().get(documentID);
            
        if (!editStatus) {
            return Promise.resolve();
        }
        
        var element = libraryStore.getElementByReference(editStatus.elementReference);
        
        // Skip if the document's associated element is deleted, but keep the edit status so that
        // the temp files will be deleted when the document is closed.
        if (!element) {
            return Promise.resolve();
        }
        
        var library = element.library;
            
        // Check if the library exists - if it was deleted, switch to the current library
        if (!library || library.deletedLocally) {
            library = libraryStore.getCurrentLibrary();

            if (!library) {
                // There's no current library, so don't do anything
                return Promise.resolve();
            }
        }
        
        this.dispatch(events.libraries.UPDATING_GRAPHIC_CONTENT, { documentID: documentID });

        library.beginOperation();
        
        // If the element we're editing was deleted, we recreate it as a new element, so the changes aren't lost.
        // Otherwise, we just remove the existing representations so we can add the new ones
        if (element.deletedLocally) {
            element = library.createElement(element.name, element.type);
        } else {
            // TODO should keep representation's stock data
            element.removeAllRepresentations();
        }
        
        return Promise.fromNode(function (done) {
                var newRepresentation = element.createRepresentation(_REP_PHOTOSHOP_TYPE, "primary");
                    
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
            })
            .then(function () {
                if (editStatus.isDocumentClosed) {
                    return this.tansfer(deleteGraphicTempFiles, documentID);
                }
            });
    };
    updateGraphicContent.reads = [];
    updateGraphicContent.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    
    /**
     * Delete graphic asset's temp document and preview files.
     *
     * @param {number} documentID
     */
    var deleteGraphicTempFiles = function (documentID) {
        var libraryStore = this.flux.stores.library,
            editStatus = libraryStore.getEditStatus().get(documentID);
            
        if (!editStatus) {
            return Promise.resolve();
        }
        
        var tempFiles = [editStatus.documentPath, editStatus.previewPath];
                    
        return this.transfer(exportActions.deleteFiles, tempFiles)
            .bind(this)
            .then(function () {
                this.dispatch(events.libraries.DELETED_GRAPHIC_TEMP_FILES, { documentID: documentID });
                
                return this.transfer(preferencesActions.setPreference,
                    _EDIT_STATUS_PREF, this.flux.stores.library.getEditStatus(true));
            });
    };
    deleteGraphicTempFiles.reads = [];
    deleteGraphicTempFiles.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    deleteGraphicTempFiles.transfers = [exportActions.deleteFiles, preferencesActions.setPreference];

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
    removeAsset.reads = [];
    removeAsset.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];

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
        var appStore = this.flux.store("application"),
            libStore = this.flux.store("library"),
            uiStore = this.flux.store("ui"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary(),
            pixelRatio = window.devicePixelRatio;

        if (!currentDocument || !currentLibrary) {
            return Promise.resolve();
        }

        location.x = uiStore.zoomWindowToCanvas(location.x) / pixelRatio;
        location.y = uiStore.zoomWindowToCanvas(location.y) / pixelRatio;

        return Promise
            .fromNode(function (done) {
                var representation = _findPlacableImageRepresentation(element);

                representation.getContentPath(done);
            })
            .bind(this)
            .then(function (path) {
                return this.transfer(policyActions.addKeydownPolicy, true, os.eventKeyCode.ENTER, null)
                    .bind(this)
                    .then(function (policyID) {
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
                        return descriptor.playObject(placeObj, { synchronous: false })
                            .bind(this)
                            .finally(function () {
                                return this.transfer(policyActions.removeKeyboardPolicies, policyID, true);
                            });
                    });
            })
            .then(function () {
                return this.transfer(layerActions._getLayerIDsForDocumentID, currentDocument.id);
            })
            .then(function (nextDocumentIDS) {
                // Expanded graphic asset (by holding OPT/ALT) will result in creating multiple new layer IDs.
                // We can get these new IDs by calculating the difference between the next and existing layer IDs.
                //
                // FIXME: we should instead get IDs back from Photoshop when layers are placed so we don't have
                //        to get all the layer IDs.

                var nextLayerIDs = nextDocumentIDS.layerIDs,
                    existingLayerIDs = currentDocument.layers.index.toArray(),
                    newLayerIDs = _.difference(nextLayerIDs, existingLayerIDs).reverse();

                return this.transfer(layerActions.addLayers, currentDocument, newLayerIDs, true);
            });
    };
    createLayerFromElement.reads = [locks.CC_LIBRARIES, locks.JS_DOC, locks.JS_UI, locks.JS_APP];
    createLayerFromElement.writes = [locks.PS_DOC];
    createLayerFromElement.transfers = [layerActions._getLayerIDsForDocumentID, layerActions.addLayers,
        policyActions.addKeydownPolicy, policyActions.removeKeyboardPolicies];

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
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument || currentDocument.layers.selected.isEmpty()) {
            return Promise.resolve();
        }

        var representation = element.getPrimaryRepresentation();

        return Promise.fromNode(function (done) {
                representation.getContentPath(done);
            })
            .bind(this)
            .then(function (path) {
                var layerRef = layerEffectAdapter.referenceBy.current,
                    placeObj = layerEffectAdapter.applyLayerStyleFile(layerRef, path);

                return descriptor.playObject(placeObj);
            })
            .then(function () {
                // FIXME: This can be more optimistic
                return this.transfer(layerActions.resetLayers, currentDocument, currentDocument.layers.selected);
            });
    };
    applyLayerStyle.reads = [locks.JS_APP, locks.CC_LIBRARIES];
    applyLayerStyle.writes = [locks.JS_DOC, locks.PS_DOC];
    applyLayerStyle.transfers = [layerActions.resetLayers];

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
        var appStore = this.flux.store("application"),
            currentDocument = appStore.getCurrentDocument(),
            selectedLayers = currentDocument ? currentDocument.layers.selected : Immutable.List(),
            textLayers = selectedLayers.filter(function (l) { return l.isTextLayer(); });

        if (!currentDocument || textLayers.isEmpty()) {
            return Promise.resolve();
        }
        
        var representation = element.getPrimaryRepresentation(),
            styleData = representation.getValue("characterstyle", "data");
        
        if (!styleData.adbeFont) {
            return Promise.resolve();
        }
        
        // To make textLayerAdapter.applyTextStyle apply text color correctly, styleData.color must be an array.
        if (styleData.color && !(styleData.color instanceof Array)) {
            styleData.color = [styleData.color];
        }

        var textLayerIDs = collection.pluck(textLayers, "id"),
            layerRef = textLayerIDs.map(textLayerAdapter.referenceBy.id).toArray(),
            applyObj = textLayerAdapter.applyTextStyle(layerRef, styleData);

        return layerActionsUtil.playSimpleLayerActions(currentDocument, textLayers, applyObj, true)
            .bind(this)
            .then(function () {
                return this.transfer(layerActions.resetLayers, currentDocument, textLayers);
            });
    };
    applyCharacterStyle.reads = [locks.JS_APP, locks.CC_LIBRARIES];
    applyCharacterStyle.writes = [locks.JS_DOC, locks.PS_DOC];
    applyCharacterStyle.transfers = [layerActions.resetLayers];

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

        var textLayers = selectedLayers.filter(function (l) { return l.isTextLayer(); }),
            vectorLayers = selectedLayers.filter(function (l) { return l.isVector(); }),
            transactionOpts = {
                historyStateInfo: {
                    name: strings.ACTIONS.APPLY_LIBRARY_COLOR,
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
    applyColor.reads = [locks.JS_APP, locks.CC_LIBRARIES];
    applyColor.writes = [locks.JS_DOC, locks.PS_DOC];
    applyColor.transfers = [typeActions.setColor, shapeActions.setFillColor, layerActions.resetLayers];

    /**
     * Marks the given library ID as the active one
     *
     * @param {string} id
     *
     * @return {Promise}
     */
    var selectLibrary = function (id) {
        this.dispatch(events.libraries.LIBRARY_SELECTED, { id: id });
        
        return this.transfer(preferencesActions.setPreference,
            _LAST_SELECTED_LIBRARY_ID_PREF, this.flux.stores.library.getCurrentLibraryID());
    };
    selectLibrary.reads = [];
    selectLibrary.writes = [locks.JS_LIBRARIES];
    selectLibrary.transfers = [preferencesActions.setPreference];

    /**
     * Creates a new library with the given name
     *
     * @param {string} name
     * @return {Promise.<Library>} Resolves to the created library
     */
    var createLibrary = function (name) {
        var libStore = this.flux.store("library"),
            libraryCollection = libStore.getLibraryCollection(),
            newLibrary = libraryCollection.createLibrary(name);
            
        this.dispatch(events.libraries.LIBRARY_CREATED, { library: newLibrary });

        return this.transfer(preferencesActions.setPreference,
            _LAST_SELECTED_LIBRARY_ID_PREF, libStore.getCurrentLibraryID());
    };
    createLibrary.reads = [];
    createLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    createLibrary.transfers = [preferencesActions.setPreference];

    /**
     * Removes a library from the collection
     *
     * @param {string} id
     * @return {Promise}
     */
    var removeLibrary = function (id) {
        var libStore = this.flux.store("library"),
            libraryCollection = libStore.getLibraryCollection(),
            library = libStore.getLibraryByID(id);

        if (!libraryCollection || !library) {
            return Promise.resolve();
        }

        var payload = {
            id: library.id
        };

        return Promise.fromNode(function (done) {
                libraryCollection.removeLibrary(library, done);
            })
            .bind(this)
            .then(function () {
                this.dispatch(events.libraries.LIBRARY_REMOVED, payload);
                
                return this.transfer(preferencesActions.setPreference,
                    _LAST_SELECTED_LIBRARY_ID_PREF, libStore.getCurrentLibraryID());
            });
    };
    removeLibrary.reads = [];
    removeLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    removeLibrary.transfers = [preferencesActions.setPreference];
    
    /**
     * Sync all libraries.
     *
     * @return {Promise}
     */
    var syncLibraries = function () {
        return this.dispatchAsync(events.libraries.SYNC_LIBRARIES);
    };
    syncLibraries.reads = [];
    syncLibraries.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];

    /**
     * Updates library's display name
     *
     * @param {string} id
     * @param {string} name
     * @return {Promise}
     */
    var renameLibrary = function (id, name) {
        var libStore = this.flux.store("library"),
            library = libStore.getLibraryByID(id);

        if (!library || library.name === name) {
            return Promise.resolve();
        }

        // Call library's setter function to update its name
        library.name = name;

        return this.dispatchAsync(events.libraries.LIBRARY_RENAMED, { id: id });
    };
    renameLibrary.reads = [];
    renameLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    
    /**
     * Handle libraries load event. 
     *
     * @private
     */
    var handleLibrariesLoaded = function () {
        var libraryCollection = (CCLibraries.getLoadedCollections() || [])[0];

        if (!libraryCollection) {
            searchActions.registerLibrarySearch.call(this, []);
            
            return this.dispatchAsync(events.libraries.LIBRARIES_UNLOADED);
        }

        searchActions.registerLibrarySearch.call(this, libraryCollection.libraries);
        
        // List to library collection's sync event.
        _librarySyncStatus = new LibrarySyncStatus(libraryCollection);
        _librarySyncStatus.addSyncListener(handleSyncingLibraries.bind(this));
        
        var preferenceState = this.flux.stores.preferences.getState(),
            graphicEditStatusPref = preferenceState.get(_EDIT_STATUS_PREF) || {},
            lastSelectedLibraryID = preferenceState.get(_LAST_SELECTED_LIBRARY_ID_PREF);
            
        return this.dispatchAsync(events.libraries.LIBRARIES_LOADED, {
            collection: libraryCollection,
            editStatus: graphicEditStatusPref,
            lastSelectedLibraryID: lastSelectedLibraryID
        });
    };
    
    /**
     * Callback for LibrarySyncStatus. Check LibrarySyncStatus#addSyncListener for details.
     *
     * @private
     * @param {boolean} isSyncing
     * @param {boolean} libraryNumberChanged
     */
    var handleSyncingLibraries = function (isSyncing, libraryNumberChanged) {
        this.dispatch(events.libraries.SYNCING_LIBRARIES, {
            isSyncing: isSyncing,
            libraryNumberChanged: libraryNumberChanged
        });
        
        this.flux.actions.preferences.setPreference(_LAST_SELECTED_LIBRARY_ID_PREF,
            this.flux.stores.library.getCurrentLibraryID());
    };

    var beforeStartup = function () {
        var dependencies = {
            // Photoshop on startup will grab the port of the CC Library process and expose it to us
            vulcanCall: function (requestType, requestPayload, responseType, callback) {
                descriptor.getProperty("application", "designSpaceLibrariesInfo")
                    .then(function (imsInfo) {
                        var port = imsInfo.port;

                        callback(JSON.stringify({ port: port }));
                    });
            }
        };

        // SHARED_LOCAL_STORAGE flag forces websocket use
        CCLibraries.configure(dependencies, {
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

        return Promise.resolve();
    };
    beforeStartup.reads = [locks.JS_PREF];
    beforeStartup.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];

    /**
     * After startup, load the libraries
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        // Listen to the load event of CC Libraries. The event has two scenarios:
        //     loaded: Libraries data is ready for use. Fired after user sign in creative cloud.
        //     unloaded: Libraries data is cleared. Fired after user sign out creative cloud.
        CCLibraries.addLoadedCollectionsListener(handleLibrariesLoaded.bind(this));
        
        // Triger the load event callback manually for initial start up.
        return (handleLibrariesLoaded.bind(this))();
    };
    afterStartup.reads = [locks.JS_PREF, locks.CC_LIBRARIES];
    afterStartup.writes = [locks.JS_LIBRARIES];
    
    exports.RENDITION_DEFAULT_SIZE = RENDITION_DEFAULT_SIZE;
    exports.RENDITION_GRAPHIC_SIZE = RENDITION_GRAPHIC_SIZE;
    exports.ELEMENT_CHARACTERSTYLE_TYPE = ELEMENT_CHARACTERSTYLE_TYPE;
    exports.ELEMENT_GRAPHIC_TYPE = ELEMENT_GRAPHIC_TYPE;
    exports.ELEMENT_LAYERSTYLE_TYPE = ELEMENT_LAYERSTYLE_TYPE;
    exports.ELEMENT_COLOR_TYPE = ELEMENT_COLOR_TYPE;
    exports.ELEMENT_BRUSH_TYPE = ELEMENT_BRUSH_TYPE;
    exports.ELEMENT_COLORTHEME_TYPE = ELEMENT_COLORTHEME_TYPE;

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
    exports.applyLayerStyle = applyLayerStyle;
    exports.applyCharacterStyle = applyCharacterStyle;
    exports.applyColor = applyColor;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
});
