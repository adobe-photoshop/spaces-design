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
        tinycolor = require("tinycolor"),
        CCLibraries = require("file://shared/libs/cc-libraries-api.min.js");

    var descriptor = require("adapter/ps/descriptor"),
        docAdapter = require("adapter/lib/document"),
        colorAdapter = require("adapter/lib/color"),
        layerEffectAdapter = require("adapter/lib/layerEffect"),
        textLayerAdapter = require("adapter/lib/textLayer"),
        libraryAdapter = require("adapter/lib/libraries");

    var events = require("../events"),
        locks = require("../locks"),
        layerActions = require("./layers");

    /**
     * Uploads the selected single layer to the current library
     *
     * Achieves this by:
     *  - Creates a new element in the library
     *  - Calls PS to export the layer to a temporary location
     *  - Passes the temporary path to libraries API to update layer's content
     *  - Tells Photoshop the location of the content
     *  - Updates the document
     *
     * Eventually, we'll need this to accept layer(s), library, and be more flexible
     * Also, we definitely need to get rid of the update document call, but this is 0.1
     *
     * @return {Promise}
     */
    var createElementFromSelectedLayer = function () {
        var appStore = this.flux.store("application"),
            libStore = this.flux.store("library"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary(),
            currentLayers = currentDocument.layers.selected;

        if (!currentLibrary || currentLayers.count() !== 1) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.first(),
            IMAGE_ELEMENT_TYPE = "application/vnd.adobe.element.image+dcx",
            REPRESENTATION_TYPE = "image/vnd.adobe.photoshop";

        currentLibrary.beginOperation();

        var newElement = currentLibrary.createElement(currentLayer.name, IMAGE_ELEMENT_TYPE),
            representation = newElement.createRepresentation(REPRESENTATION_TYPE, "primary"),
            previewSize = {
                w: 248,
                h: 188
            };

        // FIXME: Mac/Win temporary locations!
        var exportObj = libraryAdapter.exportLayer("/tmp/", "/tmp/preview.png",
            currentLayer.name, previewSize);

        return descriptor.playObject(exportObj)
            .bind(this)
            .then(function (saveData) {
                var path = saveData.in._path;

                return Promise.fromNode(function (cb) {
                    representation.updateContentFromPath(path, false, cb);
                });
            }).then(function () {
                currentLibrary.endOperation();
            }).then(function () {
                var newRepresentation = newElement.getPrimaryRepresentation();
                return Promise.fromNode(function (cb) {
                    newRepresentation.getContentPath(cb);
                });
            }).then(function (path) {
                var createObj = libraryAdapter.createElement(currentDocument.id, currentLayer.id, newElement, path);
                return descriptor.playObject(createObj);
            }).then(function () {
                // FIXME: Find a way around this update Document
                this.flux.actions.documents.updateDocument();
            }).then(function () {
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
    createElementFromSelectedLayer.reads = [locks.JS_DOC, locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    createElementFromSelectedLayer.writes = [locks.JS_LIBRARIES];

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

        if (!currentLibrary || currentLayers.count() !== 1 ||
            !currentLayer || currentLayer.kind !== currentLayer.layerKinds.TEXT) {
            return Promise.resolve();
        }

        // FIXME: All constants like this should be described in one location for later
        var CHARACTERSTYLE_TYPE = "application/vnd.adobe.element.characterstyle+dcx",
            REPRESENTATION_TYPE = "application/vnd.adobe.characterstyle+json";

        currentLibrary.beginOperation();

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
            }).then(function () {
                // FIXME: Constant here
                newElement.setRenditionCache(104, filepath, function () {
                    // FIXME: In CEP Panel, they delete the temporary file afterwards
                });
            }).then(function () {
                currentLibrary.endOperation();
                // FIXME: Do we need payload?
                return this.dispatchAsync(events.libraries.ASSET_CREATED, {});
            });
    };
    createCharacterStyleFromSelectedLayer.reads = [locks.JS_DOC, locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    createCharacterStyleFromSelectedLayer.writes = [locks.JS_LIBRARIES];

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
            
        if (!currentLibrary || currentLayers.count() !== 1) {
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
            }).then(function () {
                // Assign the thumbnail to rendition
                var rendition = newElement.createRepresentation("image/png", "rendition");

                return Promise.fromNode(function (cb) {
                    rendition.updateContentFromPath(thumbnailPath, false, cb);
                });
            }).then(function () {
                // FIXME: Constant here
                newElement.setRenditionCache(108, thumbnailPath, function () {
                    // FIXME: In CEP panel, they delete the temporary thumbnail file afterwards
                });
            }).then(function () {
                currentLibrary.endOperation();
                // FIXME: Do we need payload?
                return this.dispatchAsync(events.libraries.ASSET_CREATED, {});
            });
    };
    createLayerStyleFromSelectedLayer.reads = [locks.JS_DOC, locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    createLayerStyleFromSelectedLayer.writes = [locks.JS_LIBRARIES];

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
        // FIXME: Color spaces? Color naming?
        var colorName = tinycolor(color).toHexString(),
            newElement = currentLibrary.createElement(colorName, COLOR_TYPE),
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
    createColorAsset.reads = [locks.JS_DOC, locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    createColorAsset.writes = [locks.JS_LIBRARIES];

    /**
     * Places the selected asset in the document as a cloud linked smart object
     *  - Gets the path to the content from libraries
     *  - Sends the path to Photoshop with a place command
     *
     * Right now, this only works with image assets, for other types of assets we'll need
     * different actions and handlers.
     *
     * @param {AdobeLibraryElement} element
     *
     * @return {Promise}
     */
    var createLayerFromElement = function (element) {
        var appStore = this.flux.store("application"),
            libStore = this.flux.store("library"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary();

        if (!currentDocument || !currentLibrary) {
            return Promise.resolve();
        }

        var docRef = docAdapter.referenceBy.id(currentDocument.id),
            location = { x: 100, y: 100 },
            representation = element.getPrimaryRepresentation();

        return Promise.fromNode(function (cb) {
            representation.getContentPath(cb);
        }).then(function (path) {
            var placeObj = libraryAdapter.placeElement(docRef, element, path, location);

            return descriptor.playObject(placeObj);
        });
    };
    createLayerFromElement.reads = [locks.JS_LIBRARIES, locks.JS_DOC];
    createLayerFromElement.writes = [locks.JS_LIBRARIES, locks.JS_DOC, locks.PS_DOC];

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

        if (!currentDocument) {
            return Promise.resolve();
        }

        var representation = element.getPrimaryRepresentation();

        return Promise.fromNode(function (cb) {
            representation.getContentPath(cb);
        }).bind(this).then(function (path) {
            var layerRef = layerEffectAdapter.referenceBy.current,
                placeObj = layerEffectAdapter.applyLayerStyleFile(layerRef, path);

            return descriptor.playObject(placeObj);
        }).then(function () {
            // FIXME: This can be more optimistic
            return this.transfer(layerActions.resetLayers, currentDocument, currentDocument.layers.selected);
        });
    };
    applyLayerStyle.reads = [locks.JS_DOC, locks.PS_DOC];
    applyLayerStyle.writes = [locks.JS_DOC, locks.PS_DOC];

    /**
     * Applies the given character style element to the active layers
     *  - Gets the path from primary representation of the asset
     *  - Uses textLayer adapter call to apply the style data
     *
     * @param {AdobeLibraryElement} element [description]
     *
     * @return {Promise}
     */
    var applyCharacterStyle = function (element) {
        var appStore = this.flux.store("application"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        var representation = element.getPrimaryRepresentation(),
            styleData = representation.getValue("characterstyle", "data"),
            layerRef = textLayerAdapter.referenceBy.current,
            applyObj = textLayerAdapter.applyTextStyle(layerRef, styleData);

        return descriptor.playObject(applyObj)
            .bind(this).then(function () {
                return this.transfer(layerActions.resetLayers, currentDocument, currentDocument.layers.selected);
            });
    };
    applyCharacterStyle.reads = [locks.JS_DOC, locks.PS_DOC];
    applyCharacterStyle.writes = [locks.JS_DOC, locks.PS_DOC];
    /**
     * Marks the given library ID as the active one
     *
     * @param {string} id
     *
     * @return {Promise}
     */
    var selectLibrary = function (id) {
        return this.dispatchAsync(events.libraries.LIBRARY_SELECTED, { id: id });
    };
    selectLibrary.reads = [];
    selectLibrary.writes = [locks.JS_LIBRARIES];

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

        return this.dispatchAsync(events.libraries.LIBRARY_CREATED, { library: newLibrary })
            .then(function () {
                return newLibrary;
            });
    };
    createLibrary.reads = [];
    createLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];

    /** 
     * Removes the current library from the collection
     *
     * @return {Promise}
     */
    var removeCurrentLibrary = function () {
        var libStore = this.flux.store("library"),
            libraryCollection = libStore.getLibraryCollection(),
            currentLibrary = libStore.getCurrentLibrary();

        if (!libraryCollection || !currentLibrary) {
            return Promise.resolve();
        }

        var payload = {
            id: currentLibrary.id
        };

        return Promise.fromNode(function (cb) {
            libraryCollection.removeLibrary(currentLibrary, cb);
        }).bind(this).then(function () {
            return this.dispatchAsync(events.libraries.LIBRARY_REMOVED, payload);
        });
    };
    removeCurrentLibrary.reads = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    removeCurrentLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];

    var beforeStartup = function () {
        var preferences = this.flux.store("preferences").getState(),
            librariesEnabled = preferences.get("librariesEnabled", false);

        if (!librariesEnabled) {
            return Promise.resolve();
        }

        var dependencies = {
            // Photoshop on startup will grab the port of the CC Library process and expose it to us
            vulcanCall: function (requestType, requestPayload, responseType, callback) {
                descriptor.getProperty("application", "designSpaceLibrariesIMSInfo")
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
                "application/vnd.adobe.element.layerstyle+dcx"
            ]
        });

        return Promise.resolve();
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [locks.JS_LIBRARIES];

    /**
     * After startup, load the libraries
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        var preferences = this.flux.store("preferences").getState(),
            librariesEnabled = preferences.get("librariesEnabled", false);

        if (!librariesEnabled) {
            return Promise.resolve();
        }

        var libraryCollection = CCLibraries.getLoadedCollections();

        if (!libraryCollection || !libraryCollection[0]) {
            return this.dispatchAsync(events.libraries.CONNECTION_FAILED);
        }

        // FIXME: Do we eventually need to handle other collections?
        var payload = {
            libraries: libraryCollection[0].libraries,
            collection: libraryCollection[0]
        };
        return this.dispatchAsync(events.libraries.LIBRARIES_UPDATED, payload);
    };
    afterStartup.reads = [locks.JS_LIBRARIES];
    afterStartup.writes = [locks.JS_LIBRARIES];


    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    
    exports.createLibrary = createLibrary;
    exports.selectLibrary = selectLibrary;
    exports.removeCurrentLibrary = removeCurrentLibrary;

    exports.createElementFromSelectedLayer = createElementFromSelectedLayer;
    exports.createCharacterStyleFromSelectedLayer = createCharacterStyleFromSelectedLayer;
    exports.createLayerStyleFromSelectedLayer = createLayerStyleFromSelectedLayer;
    exports.createColorAsset = createColorAsset;

    exports.createLayerFromElement = createLayerFromElement;
    exports.applyLayerStyle = applyLayerStyle;
    exports.applyCharacterStyle = applyCharacterStyle;
});
