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
        path = require("js/util/path"),
        os = require("adapter/os");

    var events = require("../events"),
        locks = require("../locks"),
        pathUtil = require("js/util/path"),
        collection = require("js/util/collection"),
        layerActionsUtil = require("js/util/layeractions"),
        documentActions = require("./documents"),
        layerActions = require("./layers"),
        searchActions = require("./search/libraries"),
        shapeActions = require("./shapes"),
        typeActions = require("./type"),
        preferencesActions = require("./preferences");

    /**
     * Preference name for storing the ID of the last selected library.
     *
     * @private
     */
    var _LAST_SELECTED_LIBRARY_ID_PREF = "lastSelectedLibraryID";

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
     * Uploads the selected layer(s) to the current library
     *
     * Achieves this by:
     *  - Creates a new element in the library
     *  - Calls PS to export the layer to a temporary location
     *  - Passes the temporary path to libraries API to update layer's content
     *  - Tells Photoshop the location of the content
     *  - Updates the document
     *
     * @todo Eventually, we'll need this to accept layer(s), library, and be more flexible
     * @todo Also, we definitely need to get rid of the update document call, but this is 0.1
     *
     * @return {Promise}
     */
    var createElementFromSelectedLayer = function () {
        var appStore = this.flux.store("application"),
            libStore = this.flux.store("library"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary(),
            currentLayers = currentDocument.layers.selected;

        if (!currentLibrary) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.first(),
            IMAGE_ELEMENT_TYPE = "application/vnd.adobe.element.image+dcx",
            representationType = "image/vnd.adobe.photoshop", // This is the default type
            newElement;

        // However, if the layer is a smart object, and is owned by some other app, we need to change representation
        // we do this by matching extensions
        if (currentLayer.isSmartObject()) {
            var layerFileName = currentLayer.smartObject.fileReference,
                fileExtension = pathUtil.extension(layerFileName);

            if (_EXTENSION_TO_REPRESENTATION_MAP.hasOwnProperty(fileExtension)) {
                representationType = _EXTENSION_TO_REPRESENTATION_MAP[fileExtension];
            }
        }

        var tempLayerName = (new Date().getTime()).toString();

        return os.getTempFilename(tempLayerName)
            .bind(this)
            .then(function (tempFilename) {
                // Export the selected layers

                var tempPath = path.dirname(tempFilename.path),
                    tempPreviewPath = tempPath + "/preview.png",
                    previewSize = { w: 248, h: 188 },
                    exportObj = libraryAdapter.exportLayer(tempPath, tempPreviewPath, tempLayerName, previewSize);

                return descriptor.playObject(exportObj);
            })
            .then(function (saveData) {
                // Create new graphic asset of the exported layer(s) using the CC Libraries api.

                currentLibrary.beginOperation();
                newElement = currentLibrary.createElement(currentLayer.name, IMAGE_ELEMENT_TYPE);

                return Promise.fromNode(function (cb) {
                    var exportedLayerPath = saveData.in._path,
                        representation = newElement.createRepresentation(representationType, "primary");

                    representation.updateContentFromPath(exportedLayerPath, false, cb);
                }).finally(function () {
                    currentLibrary.endOperation();
                });
            })
            .then(function () {
                var newRepresentation = newElement.getPrimaryRepresentation();
                return Promise.fromNode(function (cb) {
                    newRepresentation.getContentPath(cb);
                });
            })
            .then(function (path) {
                var createObj = libraryAdapter.createElement(currentDocument.id, currentLayer.id, newElement, path);
                return descriptor.playObject(createObj);
            })
            .then(function () {
                // FIXME: Find a way around this update Document
                return this.transfer(documentActions.updateDocument);
            })
            .then(function () {
                var payload = {
                    library: currentLibrary,
                    element: newElement,
                    document: currentDocument,
                    layers: currentLayer
                };
                // WE ONLY LINK IF THE LAYER WAS A SMART OBJECT
                return this.dispatchAsync(events.libraries.ASSET_CREATED, payload);
            });
    };
    createElementFromSelectedLayer.reads = [locks.JS_DOC, locks.JS_APP];
    createElementFromSelectedLayer.writes = [locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    createElementFromSelectedLayer.transfers = [documentActions.updateDocument];

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
     * @todo  Eventually, we may need to be better about what to export with the object
     * and evolve this function as @see models/layer text improves
     *
     * @todo Make sure the typeObject is correctly created for everything we're supplying
     * @todo Update the library itself by either listening to notifications or something
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

        if (!currentLibrary || currentLayers.size !== 1 ||
            !currentLayer || !currentLayer.isTextLayer()) {
            return Promise.resolve();
        }

        // FIXME: All constants like this should be described in one location for later
        var CHARACTERSTYLE_TYPE = "application/vnd.adobe.element.characterstyle+dcx",
            REPRESENTATION_TYPE = "application/vnd.adobe.characterstyle+json";

        currentLibrary.beginOperation();

        // FIXME: We should build this name correctly, instead of layer name
        var newElement = currentLibrary.createElement(currentLayer.name, CHARACTERSTYLE_TYPE),
            representation = newElement.createRepresentation(REPRESENTATION_TYPE, "primary"),
            imageRepresentation = newElement.createRepresentation("image/png", "rendition"),
            typeData = fontStore.getTypeObjectFromLayer(currentLayer),
            // FIXME: Mac/Win temporary locations!
            filepath = "/tmp/textThumbnailPreview.png";

        // Where magic happens
        representation.setValue("characterstyle", "data", typeData);

        // FIXME: Make sure this reflects the character style we're recreating
        // check to see how CEP Panel does it.
        var exportObj = libraryAdapter.createTextThumbnail(filepath,
            typeData.adbeFont.postScriptName,
            "Aa",
            36,
            colorAdapter.colorObject([0, 0, 0]));

        return descriptor.playObject(exportObj)
            .bind(this)
            .then(function () {
                return Promise.fromNode(function (cb) {
                    imageRepresentation.updateContentFromPath(filepath, false, cb);
                });
            })
            .then(function () {
                // FIXME: Constant here
                newElement.setRenditionCache(104, filepath, function () {
                    // FIXME: In CEP Panel, they delete the temporary file afterwards
                });
            })
            .finally(function () {
                currentLibrary.endOperation();
                // FIXME: Do we need payload?
                this.dispatch(events.libraries.ASSET_CREATED, {});
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
     * @todo  It seems like saveLayerStyle also accepts thumbnail size and background color, but these are not
     * in use in Photoshop
     * @todo  Update the library after asset creation
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

        // FIXME: All constants like this should be described in one location for later
        var LAYERSTYLE_TYPE = "application/vnd.adobe.element.layerstyle+dcx",
            REPRESENTATION_TYPE = "application/vnd.adobe.layerstyle";

        var currentLayer = currentLayers.first(),
            layerRef = layerEffectAdapter.referenceBy.id(currentLayer.id),
            stylePath = "/tmp/layerStyleExport.asl",
            thumbnailPath = "/tmp/layerStyleThumbnail.png",
            saveLayerStyleObj = layerEffectAdapter.saveLayerStyleFile(layerRef, stylePath, thumbnailPath);

        currentLibrary.beginOperation();

        // Create the layer style asset
        var newElement = currentLibrary.createElement(currentLayer.name, LAYERSTYLE_TYPE);

        // Then, have PS generate the style file (.asl) and the thumbnail (.png)
        return descriptor.playObject(saveLayerStyleObj)
            .bind(this)
            .then(function () {
                // Assign it's primary representation (.asl file)
                var representation = newElement.createRepresentation(REPRESENTATION_TYPE, "primary");

                return Promise.fromNode(function (cb) {
                    representation.updateContentFromPath(stylePath, false, cb);
                });
            })
            .then(function () {
                // Assign the thumbnail to rendition
                var rendition = newElement.createRepresentation("image/png", "rendition");

                return Promise.fromNode(function (cb) {
                    rendition.updateContentFromPath(thumbnailPath, false, cb);
                });
            })
            .then(function () {
                // FIXME: Constant here
                newElement.setRenditionCache(108, thumbnailPath, function () {
                    // FIXME: In CEP panel, they delete the temporary thumbnail file afterwards
                });
            })
            .finally(function () {
                currentLibrary.endOperation();
                // FIXME: Do we need payload?
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

        // FIXME: All constants like this should be described in one location for later
        var COLOR_TYPE = "application/vnd.adobe.element.color+dcx",
            REPRESENTATION_TYPE = "application/vnd.adobe.color+json";

        currentLibrary.beginOperation();

        // Create the color asset
        // FIXME: Color spaces?
        var newElement = currentLibrary.createElement("", COLOR_TYPE),
            representation = newElement.createRepresentation(REPRESENTATION_TYPE, "primary");

        // FIXME: This is how they expect the data, might need more research to see
        // if there is a utility library we can use
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
        // FIXME: Do we need payload?
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
            .fromNode(function (cb) {
                var representation = _findPlacableImageRepresentation(element);

                representation.getContentPath(cb);
            })
            .bind(this)
            .then(function (path) {
                var docRef = docAdapter.referenceBy.id(currentDocument.id),
                    placeObj = libraryAdapter.placeElement(docRef, element, path, location);

                return descriptor.playObject(placeObj);
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
                    existingLayerIDs = currentDocument.layers.index.toArray();

                return _.difference(nextLayerIDs, existingLayerIDs).reverse();
            })
            .then(function (newLayerIDs) {
                return this.transfer(layerActions.addLayers, currentDocument, newLayerIDs, true, false);
            });
    };
    createLayerFromElement.reads = [locks.CC_LIBRARIES, locks.JS_DOC, locks.JS_UI, locks.JS_APP];
    createLayerFromElement.writes = [locks.PS_DOC];
    createLayerFromElement.transfers = [layerActions._getLayerIDsForDocumentID, layerActions.addLayers];

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

        return Promise.fromNode(function (cb) {
            representation.getContentPath(cb);
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
            styleData = representation.getValue("characterstyle", "data"),
            textLayerIDs = collection.pluck(textLayers, "id"),
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
            shapeFillOptions = {
                coalesce: false,
                enabled: true,
                ignoreAlpha: false
            };

        // FIXME: Setting font color and fill color at the same time will result in two histroy states.
        //        We should merge the two states when transaction is supported.
        var setTextColorPromise = textLayers.isEmpty() ? Promise.resolve() :
                this.transfer(typeActions.setColor, currentDocument, textLayers, color, true, true),
            setShapeFillColorPromise = vectorLayers.isEmpty() ? Promise.resolve() :
                this.transfer(shapeActions.setFillColor, currentDocument, vectorLayers, color, shapeFillOptions);

        return Promise.join(setTextColorPromise, setShapeFillColorPromise);
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
        return this.dispatchAsync(events.libraries.LIBRARY_SELECTED, { id: id })
            .then(function () {
                return this.transfer(preferencesActions.setPreference, _LAST_SELECTED_LIBRARY_ID_PREF, id);
            });
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

        return this.dispatchAsync(events.libraries.LIBRARY_CREATED, { library: newLibrary });
    };
    createLibrary.reads = [];
    createLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];

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

        return Promise.fromNode(function (cb) {
                libraryCollection.removeLibrary(library, cb);
            })
            .bind(this)
            .then(function () {
                return this.dispatchAsync(events.libraries.LIBRARY_REMOVED, payload);
            });
    };
    removeLibrary.reads = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    removeLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];

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
    removeLibrary.reads = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    removeLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];

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
                "application/vnd.adobe.element.color+dcx",
                "application/vnd.adobe.element.image+dcx",
                "application/vnd.adobe.element.characterstyle+dcx",
                "application/vnd.adobe.element.layerstyle+dcx",
                "application/vnd.adobe.element.brush+dcx",
                "application/vnd.adobe.element.colortheme+dcx"
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
        var libraryCollection = (CCLibraries.getLoadedCollections() || [])[0];

        if (!libraryCollection) {
            return this.dispatchAsync(events.libraries.CONNECTION_FAILED);
        }

        searchActions.registerLibrarySearch.call(this, libraryCollection.libraries);

        var preferences = this.flux.store("preferences").getState();

        // FIXME: Do we eventually need to handle other collections?
        var payload = {
            lastSelectedLibraryID: preferences.get(_LAST_SELECTED_LIBRARY_ID_PREF),
            collection: libraryCollection
        };

        return this.dispatchAsync(events.libraries.LIBRARIES_UPDATED, payload);
    };
    afterStartup.reads = [locks.JS_PREF, locks.CC_LIBRARIES];
    afterStartup.writes = [locks.JS_LIBRARIES];

    exports.selectLibrary = selectLibrary;
    exports.createLibrary = createLibrary;
    exports.renameLibrary = renameLibrary;
    exports.removeLibrary = removeLibrary;

    exports.createElementFromSelectedLayer = createElementFromSelectedLayer;
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
