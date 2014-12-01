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

    var _ = require("lodash"),
        Promise = require("bluebird"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        documents = require("js/actions/documents"),
        layerLib = require("adapter/lib/layer"),
        unitLib = require("adapter/lib/unit");

    var events = require("../events"),
        log = require("../util/log"),
        locks = require("js/locks"),
        documentActions = require("./documents");

    /**
     * Helper function to determine if any layers being transformed are groups
     * @param  {Array.<Layer>} layerSpec Layers being transformed
     * @return {boolean} True if any of the layers are a group
     */
    var _transformingAnyGroups = function (layerSpec) {
        return _.any(layerSpec, function (layer) {
            return layer.kind === layer.layerKinds.GROUP;
        });
    };
    
    /**
     * Helper function for setPosition action, prepares the playobject
     * @private
     * @param {Document} document
     * @param {Layer} layer
     * @param {{x: number, y: number}} position
     * @return {PlayObject}
     */
    var _getTranslatePlayObject = function (document, layer, position) {
        var documentRef = documentLib.referenceBy.id(document.id),
            layerRef = [documentRef, layerLib.referenceBy.id(layer.id)],
            newX = position.hasOwnProperty("x") ? position.x : layer.bounds.left,
            newY = position.hasOwnProperty("y") ? position.y : layer.bounds.top,
            xDelta = unitLib.pixels(newX - layer.bounds.left),
            yDelta = unitLib.pixels(newY - layer.bounds.top),
            translateObj = layerLib.translate(layerRef, xDelta, yDelta);

        return translateObj;
    };

    /**
     * Sets the given layers' positions
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Array.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {{x: number, y: number}} position New top and left values for each layer
     *
     * @return {Promise}
     */
    var setPositionCommand = function (document, layerSpec, position) {
        if (!_.isArray(layerSpec)) {
            layerSpec = [layerSpec];
        }

        var payload = {
                documentID: document.id,
                layerIDs: _.pluck(layerSpec, "id"),
                position: position
            };

        var documentRef = documentLib.referenceBy.id(document.id);

            
        if (layerSpec.length === 1) {
            var translatePromises = layerSpec.map(function (layer) {
                var translateObj = _getTranslatePlayObject.call(this, document, layer, position);

                return descriptor.playObject(translateObj);
            }, this);

            this.dispatch(events.transform.TRANSLATE_LAYERS, payload);
                
            return Promise.all(translatePromises)
                .bind(this)
                .then(function () {
                    if (_transformingAnyGroups(layerSpec)) {
                        return this.transfer(documentActions.updateDocument, document.id);
                    }
                })
                .catch(function (err) {
                    log.warn("Failed to translate layers", layerSpec, err);
                    this.flux.actions.documents.resetDocuments();
                });
        } else {
            // Photoshop does not apply "transform" objects to the referenced layer, and instead 
            // applies it to all selected layers, so here we deselectAll, 
            // and in chunks select one and move it and reselect all layers.
            // This is a temporary work around until we fix the underlying issue on PS side


            // We need to do this now, otherwise store gets updated before we can read current values
            var translateObjects = layerSpec.map(function (layer) {
                return _getTranslatePlayObject.call(this, document, layer, position);
            }, this);

            this.dispatch(events.transform.TRANSLATE_LAYERS, payload);
            
            return descriptor.playObject(layerLib.deselectAll())
                .bind(this)
                .then(function () {
                    return Promise.each(layerSpec, function (layer, index) {
                        var layerRef = layerLib.referenceBy.id(layer.id),
                            selectObj = layerLib.select([documentRef, layerRef]),
                            translateObj = translateObjects[index];
                        
                        return descriptor.playObject(selectObj).then(function () {
                            return descriptor.playObject(translateObj);
                        });
                    }.bind(this));
                }).then(function () {
                    var layerRef = layerSpec.map(function (layer) {
                        return layerLib.referenceBy.id(layer.id);
                    });
                    layerRef.unshift(documentRef);

                    var selectAllObj = layerLib.select(layerRef);
                    return descriptor.playObject(selectAllObj);
                }).then(function () {
                    if (_transformingAnyGroups(layerSpec)) {
                        return this.transfer(documentActions.updateDocument, document.id);
                    }
                }).catch(function (err) {
                    log.warn("Failed to translate layers", layerSpec, err);
                    this.flux.actions.documents.resetDocuments();
                });
        }
    };

    /**
     * Swaps the two given layers top-left positions
     *
     * @private
     * @param {Document} document Owner document
     * @param {[<Layer>, <Layer>]} layers An array of two layers
     *
     * @return {Promise}
     */
    var swapLayersCommand = function (document, layers) {
        // validate layers input
        if (!_.isArray(layers) || _.size(layers) !== 2) {
            throw new Error("Expected two layers");
        }

        var documentRef = documentLib.referenceBy.id(document.id),
            positionOne = {
                x: layers[0].bounds.left,
                y: layers[0].bounds.top
            },
            positionTwo = {
                x: layers[1].bounds.left,
                y: layers[1].bounds.top
            },
            translateObjects = [
                _getTranslatePlayObject.call(this, document, layers[0], positionTwo),
                _getTranslatePlayObject.call(this, document, layers[1], positionOne)
            ],
            payloadOne = {
                documentID: document.id,
                layerIDs: [layers[0].id],
                position: positionTwo
            },
            payloadTwo = {
                documentID: document.id,
                layerIDs: [layers[1].id],
                position: positionOne
            };


        this.dispatch(events.transform.TRANSLATE_LAYERS, payloadOne);
        this.dispatch(events.transform.TRANSLATE_LAYERS, payloadTwo);

        // Photoshop does not apply "transform" objects to the referenced layer, and instead 
        // applies it to all selected layers, so here we deselectAll, 
        // and in chunks select one and move it and reselect all layers.
        // This is a temporary work around until we fix the underlying issue on PS side
        return descriptor.playObject(layerLib.deselectAll())
            .bind(this)
            .then(function () {
                return Promise.each(layers, function (layer, index) {
                    var layerRef = layerLib.referenceBy.id(layer.id),
                        selectObj = layerLib.select([documentRef, layerRef]),
                        translateObj = translateObjects[index];
                        
                    return descriptor.playObject(selectObj).then(function () {
                        return descriptor.playObject(translateObj);
                    });
                }.bind(this));
            }).then(function () {
                var layerRef = layers.map(function (layer) {
                    return layerLib.referenceBy.id(layer.id);
                });
                layerRef.unshift(documentRef);

                var selectAllObj = layerLib.select(layerRef);
                
                return descriptor.playObject(selectAllObj);
            }).then(function () {
                if (_transformingAnyGroups(layers)) {
                    return this.transfer(documentActions.updateDocument, document.id);
                }
            }).catch(function (err) {
                log.warn("Failed to swap layers", layers, err);
                this.flux.actions.documents.resetDocuments();
            });
        
    };

    /**
     * Helper function for resize action, calculates the new x/y values for a layer
     * when it's resized so the layer is resized from top left
     * @private
     * @param {Document} document
     * @param {Layer} layer
     * @param {{w: number, h: number}} size
     * @return {PlayObject}
     */
    var _getResizePlayObject = function (document, layer, size) {
        var documentRef = documentLib.referenceBy.id(document.id),
            newWidth = size.hasOwnProperty("w") ? size.w : layer.bounds.width,
            newHeight = size.hasOwnProperty("h") ? size.h : layer.bounds.height,
            widthDiff = newWidth - layer.bounds.width,
            heightDiff = newHeight - layer.bounds.height,
            pixelWidth = unitLib.pixels(newWidth),
            pixelHeight = unitLib.pixels(newHeight),
            xDelta = unitLib.pixels(widthDiff / 2),
            yDelta = unitLib.pixels(heightDiff / 2),
            layerRef = [documentRef, layerLib.referenceBy.id(layer.id)],
            translateObj = layerLib.translate(layerRef, xDelta, yDelta),
            resizeObj = layerLib.setSize(layerRef, pixelWidth, pixelHeight),
            resizeAndMoveObj = _.merge(translateObj, resizeObj);

        return resizeAndMoveObj;

    };

    /**
     * Sets the given layers' sizes
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Array.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {w: {number}, h: {number}} size New width and height of the layers
     *
     * @returns {Promise}
     */
    var setSizeCommand = function (document, layerSpec, size) {
        if (!_.isArray(layerSpec)) {
            layerSpec = [layerSpec];
        }

        var payload = {
            documentID: document.id,
            layerIDs: _.pluck(layerSpec, "id"),
            size: size
        };

        var documentRef = documentLib.referenceBy.id(document.id);

        // Document
        if (layerSpec.length === 0) {
            var newWidth = size.hasOwnProperty("w") ? size.w : document.bounds.width,
                unitsWidth = unitLib.pixels(newWidth),
                newHeight = size.hasOwnProperty("h") ? size.h : document.bounds.height,
                unitsHeight = unitLib.pixels(newHeight),
                resizeObj = documentLib.resize(unitsWidth, unitsHeight);

            this.dispatch(events.transform.RESIZE_DOCUMENT, payload);
            
            return descriptor.playObject(resizeObj)
                .bind(this)
                .catch(function (err) {
                    log.warn("Failed to resize layers", layerSpec, err);
                    this.flux.actions.documents.resetDocuments();
                });
        } else if (layerSpec.length === 1) {
        
            // We have this in a map function because setSize anchors center
            // We calculate the new translation values to keep the layer anchored on top left
            var resizePromises = layerSpec.map(function (layer) {
                var resizeAndMoveObj = _getResizePlayObject.call(this, document, layer, size);

                return descriptor.playObject(resizeAndMoveObj);
            }, this);

            this.dispatch(events.transform.RESIZE_LAYERS, payload);
            
            return Promise.all(resizePromises)
                .bind(this)
                .then(function () {
                    if (_transformingAnyGroups(layerSpec)) {
                        return this.transfer(documentActions.updateDocument, document.id);
                    }
                })
                .catch(function (err) {
                    log.warn("Failed to resize layers", layerSpec, err);
                    this.flux.actions.documents.resetDocuments();
                });
        } else {
            // We need to do this now, otherwise store gets updated before we can read current values
            var resizeObjects = layerSpec.map(function (layer) {
                return _getResizePlayObject.call(this, document, layer, size);
            }, this);

            this.dispatch(events.transform.RESIZE_LAYERS, payload);
            
            return descriptor.playObject(layerLib.deselectAll())
                .bind(this)
                .then(function () {
                    return Promise.each(layerSpec, function (layer, index) {
                        var layerRef = layerLib.referenceBy.id(layer.id),
                            selectObj = layerLib.select([documentRef, layerRef]),
                            resizeAndMoveObj = resizeObjects[index];
                            
                        return descriptor.playObject(selectObj).then(function () {
                            return descriptor.playObject(resizeAndMoveObj);
                        });
                    }.bind(this));
                }).then(function () {
                    var layerRef = layerSpec.map(function (layer) {
                        return layerLib.referenceBy.id(layer.id);
                    });
                    layerRef.unshift(documentRef);

                    var selectAllObj = layerLib.select(layerRef);
                    return descriptor.playObject(selectAllObj);
                })
                .then(function () {
                    if (_transformingAnyGroups(layerSpec)) {
                        return this.transfer(documentActions.updateDocument, document.id);
                    }
                })
                .catch(function (err) {
                    log.warn("Failed to resize layers", layerSpec, err);
                    this.flux.actions.documents.resetDocuments();
                });
        }
    };
    
    /**
     * Asks photoshop to flip, either horizontally or vertically.
     * Note: this expects an array of layer models, but it only passes the first layer ref to the adapter
     * which seems to expect a ref to at least one active layer.
     * @private
     * @param {Document} document document model object
     * @param {Array.<Layer>} layers array of layer models
     * @param {string} axis Either horizontal or vertical
     *
     * @return {Promise}
     */
    var flipCommand = function (document, layers, axis) {
        // validate layers input
        if (!_.isArray(layers) || _.size(layers) < 1) {
            throw new Error("Expected at least one layer");
        }
        
        // Get a representative layer (non background)
        // This is a workaround.  The flip action validates that an active, non-background layer ref
        // is provided, even though this is ignored by the underlying photoshop flip process
        var repLayer = _.find(layers, function (l) {return !l.isBackground;});
        if (!repLayer) {
            throw new Error("flip was not provided a valid non-background layer");
        }
        
        // build a ref, and call photoshop
        var ref = layerLib.referenceBy.id(repLayer.id),
            flipPromise = descriptor.playObject(layerLib.flip(ref, axis));
        
        // TODO the following is not needed yet, because nothing cares about this event
        /**
        var payload = {
            documentID: document.id,
            layerIDs: _.pluck(layers, "id"),
            axis: axis
        };
        this.dispatch(events.transform.FLIP_LAYERS, payload);
        */
        
        return flipPromise
            .bind(this)
            .then(function () {
                // TODO there are more targeting ways of updating the bounds for the affected layers
                return this.transfer(documents.updateDocument, document.id);
            })
            .catch(function (err) {
                log.warn("Failed to flip layers", axis, err);
                this.flux.actions.documents.resetDocuments();
            });
    };
    
    /**
     * Helper command to flip horizontally
     * @private
     *
     * @param {Document} document document model object
     * @param {Array.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var flipXCommand = function (document, layers) {
        return flipCommand.call(this, document, layers, "horizontal");
    };
    
    /**
     * Helper command to flip vertically
     *
     * @private
     * @param {Document} document document model object
     * @param {Array.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var flipYCommand = function (document, layers) {
        return flipCommand.call(this, document, layers, "vertical");
    };

    /**
     * Helper command to flip selected layers in the current document horizontally
     *
     * @private
     * @return {Promise}
     */
    var flipXCurrentDocumentCommand = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.getSelectedLayers();

        if (!currentDocument || currentDocument.selectedLayersLocked()) {
            return Promise.resolve();
        }
        
        return this.transfer(flipX, currentDocument, selectedLayers);
    };
    
    /**
     * Helper command to flip selected layers in the current document vertically
     *
     * @private
     * @return {Promise}
     */
    var flipYCurrentDocumentCommand = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.getSelectedLayers();

        if (!currentDocument || currentDocument.selectedLayersLocked()) {
            return Promise.resolve();
        }

        return this.transfer(flipY, currentDocument, selectedLayers);
    };

    /**
     * Action to set Position
     * @type {Action}
     */
    var setPosition = {
        command: setPositionCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to set Size
     * @type {Action}
     */
    var setSize = {
        command: setSizeCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to flip horizontally
     * @type {Action}
     */
    var flipX =  {
        command: flipXCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to flip vertically
     * @type {Action}
     */
    var flipY = {
        command: flipYCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };
    
    /**
     * Action to flip the current document's selected layers horizontally
     * @type {Action}
     */
    var flipXCurrentDocument =  {
        command: flipXCurrentDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to flip the current document's selected layers vertically
     * @type {Action}
     */
    var flipYCurrentDocument = {
        command: flipYCurrentDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to swap two selected layers in the document
     * @type {Action}
     */
    var swapLayers = {
        command: swapLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    exports.setPosition = setPosition;
    exports.setSize = setSize;
    exports.flipX = flipX;
    exports.flipY = flipY;
    exports.flipXCurrentDocument = flipXCurrentDocument;
    exports.flipYCurrentDocument = flipYCurrentDocument;
    exports.swapLayers = swapLayers;
    
});
