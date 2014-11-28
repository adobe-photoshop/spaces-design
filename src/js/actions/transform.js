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
        contentLib = require("adapter/lib/contentLayer"),
        unitLib = require("adapter/lib/unit");

    var events = require("../events"),
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

        layerSpec = layerSpec.filter(function (layer) {
            return !!layer.bounds;
        });

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
                });
        }
    };

    /**
     * For two layers, calculates a new top left for both, keeping them within
     * the same bounding box, but swapping their locations
     *
     *  - If the two layers' top, bottom or vertical centers are close to each other
     *      We do intelligent swapping horizontally, but keep the layers in the same vertical location
     *      These cases usually apply to things like: Number and the numbered list item
     *      
     *  - If left, horizontal center, or right edges are close to each other
     *      We swap just the tops, keeping the layers in same horizontal location
     *      This applies to cases like two items in a list
     *      
     *  - Otherwise, we swap the layers top/left corners with each other. This applies to all other general cases
     *
     * @param {Array.<Layer>} layers
     * @param {number} sensitivity Fraction of the edge difference to consider two layers on same axis
     *
     * @return {Array.<{x: number, y: number}>} New position objects for layers
     */
    var _calculateSwapLocations = function (layers, sensitivity) {
        sensitivity = sensitivity || 10;
        
        var l1 = layers[0].bounds,
            l2 = layers[1].bounds,
            boundingBox = {
                left: Math.min(l1.left, l2.left),
                right: Math.max(l1.right, l2.right),
                top: Math.min(l1.top, l2.top),
                bottom: Math.max(l1.bottom, l2.bottom)
            },
            l1VertCenter = l1.top + l1.height / 2,
            l2VertCenter = l2.top + l2.height / 2,
            l1HorzCenter = l1.left + l1.width / 2,
            l2HorzCenter = l2.left + l2.width / 2,
            heightFraction = (boundingBox.bottom - boundingBox.top) / sensitivity,
            widthFraction = (boundingBox.right - boundingBox.left) / sensitivity,
            verticalEdgeClose = Math.abs(l1.left - l2.left) < widthFraction ||
                Math.abs(l1.right - l2.right) < widthFraction ||
                Math.abs(l1HorzCenter - l2HorzCenter) < widthFraction,
            horizontalEdgeClose = Math.abs(l1.top - l2.top) < heightFraction ||
                Math.abs(l1.bottom - l2.bottom) < heightFraction ||
                Math.abs(l1VertCenter - l2VertCenter) < heightFraction,
            l1Left = null,
            l1Top = null,
            l2Left = null,
            l2Top = null;

        if (verticalEdgeClose) {
            l1Left = l1.left;
            l1Top = l2.top;
            l2Left = l2.left;
            l2Top = l1.top;
        } else if (horizontalEdgeClose) {
            l1Left = boundingBox.left + boundingBox.right - l1.right;
            l2Left = boundingBox.left + boundingBox.right - l2.right;
            l1Top = l1.top;
            l2Top = l2.top;
        } else {
            l1Left = l2.left;
            l1Top = l2.top;
            l2Left = l1.left;
            l2Top = l1.top;
        }
        
        return [
            {x: l1Left, y: l1Top},
            {x: l2Left, y: l2Top}
        ];
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

        // Don't act if one of the layers is an empty bound
        if (!_.every(layers, "bounds")) {
            return Promise.resolve();
        }

        var newPositions = _calculateSwapLocations(layers),
            documentRef = documentLib.referenceBy.id(document.id),
            translateObjects = [
                _getTranslatePlayObject.call(this, document, layers[0], newPositions[0]),
                _getTranslatePlayObject.call(this, document, layers[1], newPositions[1])
            ],
            payloadOne = {
                documentID: document.id,
                layerIDs: [layers[0].id],
                position: newPositions[0]
            },
            payloadTwo = {
                documentID: document.id,
                layerIDs: [layers[1].id],
                position: newPositions[1]
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

        layerSpec = layerSpec.filter(function (layer) {
            return !!layer.bounds;
        });

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
            
            return descriptor.playObject(resizeObj);
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
     * Set the radius of the rectangle shapes in the given layers of the given
     * document to the given number of pixels. Currently, the command ignores
     * document and layers paramters and acts on the selected layers of the
     * active document.
     * 
     * @param {Document} document
     * @param {Array.<Layer>} layers
     * @param {number} radius New uniform border radius in pixels
     */
    var setRadiusCommand = function (document, layers, radius) {
        var radiusDescriptor = contentLib.setRadius(radius);

        this.dispatch(events.transform.RADII_CHANGED, {
            documentID: document.id,
            layerIDs: _.pluck(layers, "id"),
            radii: {
                topLeft: radius,
                topRight: radius,
                bottomRight: radius,
                bottomLeft: radius
            }
        });

        return descriptor.playObject(radiusDescriptor);
    };

    /**
     * Helper command to swap the two given layers top-left positions
     *
     * @private
     *
     * @return {Promise}
     */
    var swapLayersCurrentDocumentCommand = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.getSelectedLayers();

        if (!currentDocument ||
            currentDocument.selectedLayersLocked() ||
            selectedLayers.length !== 2) {
            return Promise.resolve();
        }
        return this.transfer(swapLayers, currentDocument, selectedLayers);
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
        reads: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to flip the current document's selected layers vertically
     * @type {Action}
     */
    var flipYCurrentDocument = {
        command: flipYCurrentDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to swap two selected layers
     * @type {Action}
     */
    var swapLayers = {
        command: swapLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to swap the two selected layers top-left positions in the current document
     * @type {Action}
     */
    var swapLayersCurrentDocument = {
        command: swapLayersCurrentDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to the set the border radius of a rectangle shape layer
     * @type {Action}
     */
    var setRadius = {
        command: setRadiusCommand,
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
    exports.swapLayersCurrentDocument = swapLayersCurrentDocument;
    exports.setRadius = setRadius;
});
