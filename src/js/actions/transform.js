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
        Immutable = require("immutable");
        
    var descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer"),
        contentLib = require("adapter/lib/contentLayer"),
        unitLib = require("adapter/lib/unit");

    var events = require("../events"),
        locks = require("js/locks"),
        log = require("js/util/log"),
        layerActions = require("./layers"),
        collection = require("js/util/collection"),
        process = require("js/util/process"),
        locking = require("js/util/locking"),
        layerActionsUtil = require("js/util/layeractions");

    /**
     * play/batchPlay options that allow the canvas to be continually updated.
     *
     * @private
     * @type {object}
     */
    var _paintOptions = {
        paintOptions: {
            immediateUpdate: true,
            quality: "draft"
        }
    };


    /**
     * Helper function to determine if any layers being transformed are groups
     * @param {Immutable.Iterable.<Layer>} layerSpec Layers being transformed
     * @return {boolean} True if any of the layers are a group
     */
    var _transformingAnyGroups = function (layerSpec) {
        return layerSpec.some(function (layer) {
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
    var _getMovePlayObject = function (document, layer, position) {
        var childBounds = document.layers.childBounds(layer),
            documentRef = documentLib.referenceBy.id(document.id),
            layerRef = [documentRef, layerLib.referenceBy.id(layer.id)],
            newX = position.hasOwnProperty("x") ? position.x : childBounds.left,
            newY = position.hasOwnProperty("y") ? position.y : childBounds.top,
            moveObj = layerLib.setPosition(layerRef, newX, newY);

        return moveObj;
    };

    /**
     * Sets the given layers' positions
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {{x: number, y: number}} position New top and left values for each layer
     *
     * @return {Promise}
     */
    var setPositionCommand = function (document, layerSpec, position) {
        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.kind === layer.layerKinds.GROUPEND;
        });

        var layerIDs = collection.pluck(layerSpec, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                position: position
            };

        process.nextTick(function () {
            this.dispatch(events.document.REPOSITION_LAYERS, payload);
        }, this);

        var layerPlayObjects = layerSpec.map(function (layer) {
            var translateObj = _getMovePlayObject.call(this, document, layer, position);

            return {
                layer: layer,
                playObject: translateObj
            };
        }, this);

        return layerActionsUtil.playLayerActions(document, layerPlayObjects, true)
            .bind(this)
            .then(function () {
                if (_transformingAnyGroups(layerSpec)) {
                    var descendants = layerSpec.flatMap(document.layers.descendants, document.layers);

                    return this.transfer(layerActions.resetLayers, document, descendants);
                }
            });
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
     * @private
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {number} sensitivity Fraction of the edge difference to consider two layers on same axis
     * @return {Immutable.List.<{x: number, y: number}>} New position objects for layers
     */
    var _calculateSwapLocations = function (document, layers, sensitivity) {
        sensitivity = sensitivity || 10;
        
        var l1 = document.layers.childBounds(layers.get(0)),
            l2 = document.layers.childBounds(layers.get(1)),
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
        
        return Immutable.List.of(
            {x: l1Left, y: l1Top},
            {x: l2Left, y: l2Top}
        );
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
        if (layers.size !== 2) {
            throw new Error("Expected two layers");
        }

        // Don't act if one of the layers is an empty bound
        if (layers.every(function (layer) { return layer.kind === layer.layerKinds.GROUPEND; })) {
            return Promise.resolve();
        }

        var newPositions = _calculateSwapLocations(document, layers),
            documentRef = documentLib.referenceBy.id(document.id),
            translateObjects = [
                _getMovePlayObject.call(this, document, layers.get(0), newPositions.get(0)),
                _getMovePlayObject.call(this, document, layers.get(1), newPositions.get(1))
            ],
            payloadOne = {
                documentID: document.id,
                layerIDs: [layers.get(0).id],
                position: newPositions.get(0)
            },
            payloadTwo = {
                documentID: document.id,
                layerIDs: [layers.get(1).id],
                position: newPositions.get(1)
            };


        process.nextTick(function () {
            this.dispatch(events.document.REPOSITION_LAYERS, payloadOne);
            this.dispatch(events.document.REPOSITION_LAYERS, payloadTwo);
        }, this);

        var layerPlayObjects = layers.map(function (layer, index) {
            return {
                layer: layer,
                playObject: translateObjects[index]
            };
        });
        
        // Make sure to show this action as one history state
        var options = {
            historyStateInfo: {
                name: "swap-layers",
                target: documentRef
            }
        };

        return layerActionsUtil.playLayerActions(document, layerPlayObjects, true, options)
            .bind(this)
            .then(function () {
                if (_transformingAnyGroups(layers)) {
                    var descendants = layers.flatMap(document.layers.descendants, document.layers);

                    return this.transfer(layerActions.resetLayers, document, descendants);
                }
            });
    };

    /**
     * Sets the bounds of currently selected layer group in the given document
     *
     * @param {Document} document Target document to run action in
     * @param {Bounds} oldBounds The original bounding box of selected layers
     * @param {Bounds} newBounds Bounds to transform to
     */
    var setBoundsCommand = function (document, oldBounds, newBounds) {
        var documentRef = documentLib.referenceBy.id(document.id),
            pixelWidth = newBounds.width,
            pixelHeight = newBounds.height,
            pixelTop = newBounds.top,
            pixelLeft = newBounds.left,
            layerRef = [documentRef, layerLib.referenceBy.current],
            resizeObj = layerLib.setSize(layerRef, pixelWidth, pixelHeight, false, pixelLeft, pixelTop);

        // No need for lock/hide/select dance for this because this is only 
        // called from transform overlay
        return descriptor.playObject(resizeObj)
            .bind(this)
            .then(function () {
                var selected = document.layers.selected,
                    descendants = selected.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetLayers, document, descendants);
            });
    };

    /**
     * Helper function for resize action
     * @private
     * @param {Document} document
     * @param {Layer} layer
     * @param {{w: number, h: number}} size
     * @return {PlayObject}
     */
    var _getResizePlayObject = function (document, layer, size) {
        var childBounds = document.layers.childBounds(layer),
            documentRef = documentLib.referenceBy.id(document.id),
            newWidth = size.hasOwnProperty("w") ? size.w : childBounds.width,
            newHeight = size.hasOwnProperty("h") ? size.h : childBounds.height,
            pixelWidth = newWidth,
            pixelHeight = newHeight,
            pixelLeft = childBounds.left,
            pixelTop = childBounds.top,
            layerRef = [documentRef, layerLib.referenceBy.id(layer.id)],
            resizeObj = layerLib.setSize(layerRef, pixelWidth, pixelHeight, false, pixelLeft, pixelTop);

        return resizeObj;
    };

    /**
     * Sets the given layers' sizes
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {w: {number}, h: {number}} size New width and height of the layers
     *
     * @returns {Promise}
     */
    var setSizeCommand = function (document, layerSpec, size) {
        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.kind === layer.layerKinds.GROUPEND;
        });

        var layerIDs = collection.pluck(layerSpec, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                size: size
            };

        // Document
        if (layerSpec.isEmpty()) {
            process.nextTick(function () {
                this.dispatch(events.document.RESIZE_DOCUMENT, payload);
            }, this);

            var newWidth = size.hasOwnProperty("w") ? size.w : document.bounds.width,
                unitsWidth = unitLib.pixels(newWidth),
                newHeight = size.hasOwnProperty("h") ? size.h : document.bounds.height,
                unitsHeight = unitLib.pixels(newHeight),
                resizeObj = documentLib.resize(unitsWidth, unitsHeight);

            return descriptor.playObject(resizeObj);
        } else {
            process.nextTick(function () {
                this.dispatch(events.document.RESIZE_LAYERS, payload);
            }, this);

            var layerPlayObjects = layerSpec.map(function (layer) {
                var resizeObj = _getResizePlayObject.call(this, document, layer, size);

                return {
                    layer: layer,
                    playObject: resizeObj
                };
            }, this);

            return layerActionsUtil.playLayerActions(document, layerPlayObjects, true)
                .bind(this)
                .then(function () {
                    if (_transformingAnyGroups(layerSpec)) {
                        var descendants = layerSpec.flatMap(document.layers.descendants, document.layers);

                        return this.transfer(layerActions.resetLayers, document, descendants);
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
     * @param {Immutable.Iterable.<Layer>} layers array of layer models
     * @param {string} axis Either horizontal or vertical
     *
     * @return {Promise}
     */
    var flipCommand = function (document, layers, axis) {
        // validate layers input
        if (layers.isEmpty()) {
            throw new Error("Expected at least one layer");
        }
        
        // Get a representative layer (non background)
        // This is a workaround.  The flip action validates that an active, non-background layer ref
        // is provided, even though this is ignored by the underlying photoshop flip process
        var repLayer = layers.find(function (l) { return !l.isBackground; });
        if (!repLayer) {
            throw new Error("flip was not provided a valid non-background layer");
        }
        
        // build a ref, and call photoshop
        var ref = layerLib.referenceBy.id(repLayer.id),
            flipAction = layerLib.flip(ref, axis);

        // TODO the following is not needed yet, because nothing cares about this event
        /**
        var payload = {
            documentID: document.id,
            layerIDs: collection.pluck(layers, "id"),
            axis: axis
        };
        this.dispatch(events.document.FLIP_LAYERS, payload);
        */
        
        return locking.playWithLockOverride(document, layers, flipAction)
            .bind(this)
            .then(function () {
                // TODO there are more targeting ways of updating the bounds for the affected layers
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetLayers, document, descendants);
            });
    };
    
    /**
     * Helper command to flip horizontally
     * @private
     *
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
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
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
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
            selectedLayers = currentDocument.layers.selected;

        if (!currentDocument) {
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
            selectedLayers = currentDocument.layers.selected;

        if (!currentDocument) {
            return Promise.resolve();
        }

        return this.transfer(flipY, currentDocument, selectedLayers);
    };


    /**
     * Asks photoshop to align layers either Left, right or center. (horizontally or vertically).
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models
     * @param {string} align either left right top bottom hCenter or vCenter
     * @return {Promise}
     */
    var alignCommand = function (document, layers, align) {
        // validate layers input
        if (layers.isEmpty()) {
            throw new Error("Expected at least one layer");
        }
        
        var repLayer = layers.find(function (l) { return !l.isBackground; });
        if (!repLayer) {
            throw new Error("align was not provided a valid non-background layer");
        }
        // build a ref, and call photoshop
        var ref = layerLib.referenceBy.id(repLayer.id),
            alignAction = layerLib.align(ref, align);
        
        
        
        return locking.playWithLockOverride(document, layers, alignAction)
            .bind(this)
            .then(function () {
                // TODO there are more targeting ways of updating the bounds for the affected layers
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetLayers, document, descendants);
            });
    };
    
    /**
     * Helper command to align Left
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignLeftCommand = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return alignCommand.call(this, document, layers, "left");
    };

    /**
     * Helper command to align right
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignRightCommand = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return alignCommand.call(this, document, layers, "right");
    };
    
    /**
     * Helper command to align top
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignTopCommand = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return alignCommand.call(this, document, layers, "top");
    };

    /**
     * Helper command to align bottom
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignBottomCommand = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return alignCommand.call(this, document, layers, "bottom");
    };

    /**
     * Helper command to align vCenter
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignVCenterCommand = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return alignCommand.call(this, document, layers, "vCenter");
    };

    /**
     * Helper command to align hCenter
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignHCenterCommand = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return alignCommand.call(this, document, layers, "hCenter");
    };

    /**
     * Asks photoshop to align layers either Left, right or center. (horizontally or vertically).
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models
     * @param {string} align either left right top bottom hCenter or vCenter
     * @return {Promise}
     */
    var distributeCommand = function (document, layers, align) {
        // validate layers input
        if (layers.isEmpty()) {
            throw new Error("Expected at least one layer");
        }
        
        var repLayer = layers.find(function (l) { return !l.isBackground; });
        if (!repLayer) {
            throw new Error("distribute was not provided a valid non-background layer");
        }
        // build a ref, and call photoshop
        var ref = layerLib.referenceBy.id(repLayer.id),
            distributeAction = layerLib.distribute(ref, align);
        
        return locking.playWithLockOverride(document, layers, distributeAction)
            .bind(this)
            .then(function () {
                // TODO there are more targeting ways of updating the bounds for the affected layers
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetLayers, document, descendants);
            });
    };
    
    /**
     * Helper command to dstribute along the horizontal axis
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var distributeXCommand = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return distributeCommand.call(this, document, layers, "horizontally");
    };

     /**
     * Helper command to dstribute along the horizontal axis
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var distributeYCommand = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return distributeCommand.call(this, document, layers, "vertically");
    };

    /**
     * Set the radius of the rectangle shapes in the given layers of the given
     * document to the given number of pixels. Currently, the command ignores
     * document and layers paramters and acts on the selected layers of the
     * active document.
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {number} radius New uniform border radius in pixels
     */
    var setRadiusCommand = function (document, layers, radius) {
        var radiusDescriptor = contentLib.setRadius(radius);

        process.nextTick(function () {
            this.dispatch(events.document.RADII_CHANGED, {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                radii: {
                    topLeft: radius,
                    topRight: radius,
                    bottomRight: radius,
                    bottomLeft: radius
                }
            });
        }, this);
        return locking.playWithLockOverride(document, layers, radiusDescriptor, _paintOptions);
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
            selectedLayers = currentDocument.layers.selected;

        if (!currentDocument ||
            selectedLayers.size !== 2) {
            return Promise.resolve();
        }
        return this.transfer(swapLayers, currentDocument, selectedLayers);
    };

    /**
     * Rotates the currently selected layers by given angle
     *
     * @param {Document} document 
     * @param {number} angle Angle in degrees
     * @return {Promise}
     */
    var rotateCommand = function (document, angle) {
        var documentRef = documentLib.referenceBy.id(document.id),
            layerRef = [documentRef, layerLib.referenceBy.current],
            rotateObj = layerLib.rotate(layerRef, angle);

        return locking.playWithLockOverride(document, document.layers.selected, rotateObj)
            .bind(this)
            .then(function () {
                var selected = document.layers.selected,
                    descendants = selected.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetLayers, document, descendants);
            });
    };

    /**
     * Helper command to rotate layers in currently selected document through the menu
     *
     * @param  {{angle: number}} payload Contains the angle to rotate layers by
     * @return {Promise}
     */
    var rotateLayersInCurrentDocumentCommand = function (payload) {
        if (!payload.hasOwnProperty("angle")) {
            log.error("Missing angle");
            return Promise.resolve();
        }

        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        var angle = payload.angle;

        return this.transfer(rotate, currentDocument, angle);
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
     * Action to set Size
     * @type {Action}
     */
    var setBounds = {
        command: setBoundsCommand,
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
     * Action to align left
     * @type {Action}
     */
    var alignLeft = {
        command: alignLeftCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to align right
     * @type {Action}
     */
    var alignRight = {
        command: alignRightCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };
    /**
     * Action to align top
     * @type {Action}
     */
    var alignTop = {
        command: alignTopCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };
    /**
     * Action to align bottom
     * @type {Action}
     */
    var alignBottom = {
        command: alignBottomCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to align HCenter
     * @type {Action}
     */
    var alignHCenter = {
        command: alignHCenterCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to align VCenter
     * @type {Action}
     */
    var alignVCenter = {
        command: alignVCenterCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to distribute Horizontally
     * @type {Action}
     */
    var distributeX = {
        command: distributeXCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action to distribute Vetrically
     * @type {Action}
     */
    var distributeY = {
        command: distributeYCommand,
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

    /**
     * Action to set the rotation angle of current layer
     * @type {Action}
     */
    var rotate = {
        command: rotateCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Action that rotates all selected layers a certain degree
     * @type {Action}
     */
    var rotateLayersInCurrentDocument = {
        command: rotateLayersInCurrentDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    exports.setPosition = setPosition;
    exports.setSize = setSize;
    exports.flipX = flipX;
    exports.flipY = flipY;
    exports.flipXCurrentDocument = flipXCurrentDocument;
    exports.flipYCurrentDocument = flipYCurrentDocument;
    exports.alignLeft = alignLeft;
    exports.alignRight = alignRight;
    exports.alignTop = alignTop;
    exports.alignBottom = alignBottom;
    exports.alignVCenter = alignVCenter;
    exports.alignHCenter = alignHCenter;
    exports.distributeY = distributeY;
    exports.distributeX = distributeX;
    exports.swapLayers = swapLayers;
    exports.swapLayersCurrentDocument = swapLayersCurrentDocument;
    exports.setRadius = setRadius;
    exports.setBounds = setBounds;
    exports.rotate = rotate;
    exports.rotateLayersInCurrentDocument = rotateLayersInCurrentDocument;


});
