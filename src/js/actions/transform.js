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
        artboardLib = require("adapter/lib/artboard"),
        contentLib = require("adapter/lib/contentLayer"),
        unitLib = require("adapter/lib/unit");

    var events = require("../events"),
        locks = require("js/locks"),
        log = require("js/util/log"),
        layerActions = require("./layers"),
        toolActions = require("./tools"),
        collection = require("js/util/collection"),
        locking = require("js/util/locking"),
        layerActionsUtil = require("js/util/layeractions"),
        headlights = require("js/util/headlights"),
        strings = require("i18n!nls/strings"),
        synchronization = require("js/util/synchronization");

    /**
     * play/batchPlay options that allow the canvas to be continually updated.
     *
     * @private
     * @type {object}
     */
    var _paintOptions = {
        immediateUpdate: true,
        quality: "draft"
    };

    /**
     * Helper function that will break down a given layer to all it's children
     * and return layerActionsUtil compatible layer actions to move all the kids
     * so the overall selection ends at given position
     *
     * @param {Document} document
     * @param {Layer} targetLayer
     * @param {{x: number, y: number}} position
     * @param {Array.<{layer: Layer, x: number, y: number}>} moveResults payload for updating each layer's bounds
     *
     * @return {Immutable.List<{layer: Layer, playObject: PlayObject}>}
     */
    var _getMoveLayerActions = function (document, targetLayer, position, moveResults) {
        var overallBounds = document.layers.childBounds(targetLayer),
            movingLayers = document.layers.descendants(targetLayer),
            deltaX = position.hasOwnProperty("x") ? position.x - overallBounds.left : 0,
            deltaY = position.hasOwnProperty("y") ? position.y - overallBounds.top : 0,
            documentRef = documentLib.referenceBy.id(document.id);

        moveResults = moveResults || [];

        return movingLayers.reduce(function (playObjects, layer) {
            if (!layer.bounds || layer.bounds.empty) {
                return playObjects;
            }
            var layerRef = [documentRef, layerLib.referenceBy.id(layer.id)],
                translateObj;

            if (layer.isArtboard) {
                var newX = position.hasOwnProperty("x") ? position.x : layer.bounds.left,
                    newY = position.hasOwnProperty("y") ? position.y : layer.bounds.top,
                    boundingBox = {
                        top: newY,
                        bottom: newY + layer.bounds.height,
                        left: newX,
                        right: newX + layer.bounds.width
                    };

                moveResults.push({
                    layer: layer,
                    x: newX,
                    y: newY
                });

                translateObj = artboardLib.transform(layerRef, boundingBox);
            } else {
                moveResults.push({
                    layer: layer,
                    x: layer.bounds.left + deltaX,
                    y: layer.bounds.top + deltaY
                });
                translateObj = layerLib.translate(layerRef, deltaX, deltaY);
            }

            return playObjects.push({
                layer: layer,
                playObject: translateObj
            });
        }, Immutable.List(), this);
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
     *  - Otherwise, we swap the layers within their bounding box. 
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
            l1Left = boundingBox.left + boundingBox.right - l1.right;
            l2Left = boundingBox.left + boundingBox.right - l2.right;
            l1Top = boundingBox.top + boundingBox.bottom - l1.bottom;
            l2Top = boundingBox.top + boundingBox.bottom - l2.bottom;
        }
        
        return Immutable.List.of(
            { x: l1Left, y: l1Top },
            { x: l2Left, y: l2Top }
        );
    };

    /**
     * Helper function for resize action
     * @private
     * @param {object} bounds
     * @param {{w: number=, h: number=}} size
     * @param {boolean=} proportional
     * @return {{w:number, h: number}} size
     */
    var _calculateNewSize = function (bounds, size, proportional) {
        var newSize = {};
        if (proportional) {
            if (size.hasOwnProperty("w")) {
                newSize.w = size.w;
                newSize.h = newSize.w * (bounds.height / bounds.width);
            } else if (size.hasOwnProperty("h")) {
                newSize.h = size.h;
                newSize.w = newSize.h * (bounds.width / bounds.height);
            } else {
                newSize.w = bounds.width;
                newSize.h = bounds.height;
            }
        } else {
            newSize.w = size.hasOwnProperty("w") ? size.w : bounds.width;
            newSize.h = size.hasOwnProperty("h") ? size.h : bounds.height;
        }
        return newSize;
    };

    /**
     * Helper function that will break down a given layer to all it's children
     * and return layerActionsUtil compatible layer actions to resize all the kids
     * so the overall selection ends with given size
     *
     * @param {Document} document
     * @param {Layer} targetLayer
     * @param {{w: number, h: number}} size
     * @param {Array.<{layer: Layer, w: number, h: number}>} resizeResults payload for updating each layer's bounds
     *
     * @return {Immutable.List<{layer: Layer, playObject: PlayObject}>}
     */
    var _getResizeLayerActions = function (document, targetLayer, size, resizeResults) {
        var overallBounds = document.layers.childBounds(targetLayer),
            documentRef = documentLib.referenceBy.id(document.id),
            resizingLayers;

        if (targetLayer.isArtboard) {
            // We don't want to break down artboards, but just change their bounds
            resizingLayers = Immutable.List.of(targetLayer);
        } else {
            resizingLayers = document.layers.descendants(targetLayer);
        }

        resizeResults = resizeResults || [];

        // Used to calculate the new top/left positions of all layers in relation to top/left
        // of the group
        var overallWidthRatio = size.w ? size.w / overallBounds.width : 0,
            overallHeightRatio = size.h ? size.h / overallBounds.height : 0;

        // We used to pass Photoshop just the width and height, and groups would be resized
        // in the same ratio. However, layers like center aligned text and adjustment layers
        // would not resize correctly and report few extra pixels on the sides.
        // To work around this bug (#577) we compute new bounds for all child layers
        // so that they're resized the way Photoshop would resize them through the entire group
        return resizingLayers.reduce(function (playObjects, layer) {
            if (!layer.bounds || layer.bounds.empty) {
                return playObjects;
            }

            var layerRef = [documentRef, layerLib.referenceBy.id(layer.id)],
                layerTop = layer.bounds.top,
                layerLeft = layer.bounds.left,
                targetSize = {},
                targetPosition = {
                    left: layerLeft,
                    top: layerTop
                },
                widthRatio = layer.bounds.width / overallBounds.width,
                heightRatio = layer.bounds.height / overallBounds.height,
                resizeObj;

            if (size.hasOwnProperty("w")) {
                targetSize.w = size.w * widthRatio;
                targetPosition.left = overallBounds.left + (layerLeft - overallBounds.left) * overallWidthRatio;
            }

            if (size.hasOwnProperty("h")) {
                targetSize.h = size.h * heightRatio;
                targetPosition.top = overallBounds.top + (layerTop - overallBounds.top) * overallHeightRatio;
            }

            var newSize = _calculateNewSize(layer.bounds, targetSize, targetLayer.proportionalScaling),
                newWidth = newSize.w,
                newHeight = newSize.h,
                newLeft = targetPosition.left,
                newTop = targetPosition.top;

            if (layer.isArtboard) {
                var boundingBox = {
                    top: newTop,
                    bottom: newTop + newHeight,
                    left: newLeft,
                    right: newLeft + newWidth
                };

                resizeResults.push({
                    layer: layer,
                    w: newWidth,
                    h: newHeight,
                    x: newLeft,
                    y: newTop
                });

                resizeObj = artboardLib.transform(layerRef, boundingBox);
            } else {
                resizeResults.push({
                    layer: layer,
                    w: newWidth,
                    h: newHeight,
                    x: newLeft,
                    y: newTop
                });

                resizeObj = layerLib.setSize(layerRef, newWidth, newHeight, false, newLeft, newTop);
            }

            return playObjects.push({
                layer: layer,
                playObject: resizeObj
            });
        }, Immutable.List(), this);
    };

    /**
     * Sets the given layers' positions
     * Does this by moving every layer inside the selection by itself
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {{x: number, y: number}} position New top and left values for each layer
     *
     * @return {Promise}
     */
    var setPosition = function (document, layerSpec, position) {
        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.kind === layer.layerKinds.GROUPEND;
        });

        var payload = {
                documentID: document.id,
                positions: []
            },
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.SET_LAYER_POSITION,
                    target: documentLib.referenceBy.id(document.id)
                }
            };

        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.REPOSITION_LAYERS, payload)
            .bind(this).then(function () {
                return this.transfer(toolActions.resetBorderPolicies);
            }),
            translateLayerActions = layerSpec.reduce(function (actions, layer) {
                var layerActions = _getMoveLayerActions.call(this, document, layer, position, payload.positions);
                return actions.concat(layerActions);
            }, Immutable.List(), this);

        var positionPromise = layerActionsUtil.playLayerActions(document, translateLayerActions, true, options);

        return Promise.join(dispatchPromise, positionPromise);
    };
    setPosition.reads = [];
    setPosition.writes = [locks.PS_DOC, locks.JS_DOC];
    setPosition.transfers = [toolActions.resetBorderPolicies];

    /**
     * Swaps the two given layers top-left positions
     *
     * @private
     * @param {Document} document Owner document
     * @param {Array.<Layer>} layers An array of two layers
     *
     * @return {Promise}
     */
    var swapLayers = function (document, layers) {
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
            payload = {
                documentID: document.id,
                positions: []
            },
            layerOneActions = _getMoveLayerActions
                .call(this, document, layers.get(0), newPositions.get(0), payload.positions),
            layerTwoActions = _getMoveLayerActions
                .call(this, document, layers.get(1), newPositions.get(1), payload.positions),
            translateActions = layerOneActions.concat(layerTwoActions);
                
        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.REPOSITION_LAYERS, payload)
            .bind(this)
            .then(function () {
                return this.transfer(toolActions.resetBorderPolicies);
            });

        // Make sure to show this action as one history state
        var options = {
            historyStateInfo: {
                name: strings.ACTIONS.SWAP_LAYERS,
                target: documentRef
            }
        };

        var autoExpandEnabled = false;

        headlights.logEvent("edit", "layers", "swap_layers");
        var swapPromise = descriptor.getProperty(documentRef, "artboards")
            .bind(this)
            .then(function (artboardInfo) {
                autoExpandEnabled = artboardInfo.autoExpandEnabled;

                if (!autoExpandEnabled) {
                    return Promise.resolve();
                } else {
                    var setObj = documentLib.setArtboardAutoAttributes(documentRef, {
                        autoExpandEnabled: false
                    });

                    return descriptor.playObject(setObj);
                }
            })
            .then(function () {
                return layerActionsUtil.playLayerActions(document, translateActions, true, options);
            })
            .then(function () {
                if (autoExpandEnabled) {
                    var setObj = documentLib.setArtboardAutoAttributes(documentRef, {
                        autoExpandEnabled: true
                    });

                    return descriptor.playObject(setObj);
                }
            });

        return Promise.join(dispatchPromise, swapPromise);
    };
    swapLayers.reads = [];
    swapLayers.writes = [locks.PS_DOC, locks.JS_DOC];
    swapLayers.transfers = [toolActions.resetBorderPolicies];

    /**
     * Sets the given layers' sizes
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {{w: number, h: number}} size New width and height of the layers
     *
     * @returns {Promise}
     */
    var setSize = function (document, layerSpec, size) {
        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.kind === layer.layerKinds.GROUPEND ||
                document.layers.strictAncestors(layer)
                .some(function (ancestor) {
                    return layerSpec.contains(ancestor);
                });
        }, this);

        var payload = {
                documentID: document.id,
                sizes: []
            },
            options = {
                paintOptions: _paintOptions,
                historyStateInfo: {
                    name: strings.ACTIONS.SET_LAYER_SIZE,
                    target: documentLib.referenceBy.id(document.id)
                }
            };
        // Document
        var dispatchPromise,
            sizePromise;
        if (layerSpec.isEmpty()) {
            var newSize = _calculateNewSize(document.bounds, size),
                newWidth = newSize.w,
                unitsWidth = unitLib.pixels(newWidth),
                newHeight = newSize.h,
                unitsHeight = unitLib.pixels(newHeight),
                resizeObj = documentLib.resize(unitsWidth, unitsHeight, "left", "top");

            payload.size = newSize;
            
            dispatchPromise = this.dispatchAsync(events.document.history.optimistic.RESIZE_DOCUMENT, payload);
            sizePromise = descriptor.playObject(resizeObj);
        } else {
            var resizeLayerActions = layerSpec.reduce(function (actions, layer) {
                var layerActions = _getResizeLayerActions.call(this, document, layer, size, payload.sizes);
                return actions.concat(layerActions);
            }, Immutable.List(), this);

            dispatchPromise = this.dispatchAsync(events.document.history.optimistic.RESIZE_LAYERS, payload);

            sizePromise = layerActionsUtil.playLayerActions(document, resizeLayerActions, true, options);
        }

        return Promise.join(dispatchPromise, sizePromise)
            .bind(this)
            .then(function () {
                var typeLayers = layerSpec.filter(function (layer) {
                    return layer.kind === layer.layerKinds.TEXT;
                });

                // Reset type layers to pick up their implicit font size changes.
                // Final true parameter indicates that history should be amended
                // with this change.
                var typePromise = this.transfer(layerActions.resetLayers, document, typeLayers, true),
                    policyPromise = this.transfer(toolActions.resetBorderPolicies);

                return Promise.join(typePromise, policyPromise);
            });
    };
    setSize.reads = [];
    setSize.writes = [locks.PS_DOC, locks.JS_DOC];
    setSize.transfers = [toolActions.resetBorderPolicies, layerActions.resetLayers];
    
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
    var _flip = function (document, layers, axis) {
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
            flipAction = layerLib.flip(ref, axis),
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.FLIP_LAYERS,
                    target: documentLib.referenceBy.id(document.id)
                }
            };

        return locking.playWithLockOverride(document, layers, flipAction, options)
            .bind(this)
            .then(function () {
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetBounds, document, descendants);
            })
            .then(function () {
                return this.transfer(toolActions.resetBorderPolicies);
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
    var flipX = function (document, layers) {
        return _flip.call(this, document, layers, "horizontal");
    };
    flipX.reads = [];
    flipX.writes = [locks.JS_DOC, locks.PS_DOC];
    flipX.transfers = [layerActions.resetBounds, toolActions.resetBorderPolicies];
    
    /**
     * Helper command to flip vertically
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var flipY = function (document, layers) {
        return _flip.call(this, document, layers, "vertical");
    };
    flipY.reads = [];
    flipY.writes = [locks.JS_DOC, locks.JS_DOC];
    flipY.transfers = [layerActions.resetBounds, toolActions.resetBorderPolicies];
    
    /**
     * Helper command to flip selected layers in the current document horizontally
     *
     * @private
     * @return {Promise}
     */
    var flipXCurrentDocument = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.layers.selected;

        if (!currentDocument) {
            return Promise.resolve();
        }
        
        return this.transfer(flipX, currentDocument, selectedLayers);
    };
    flipXCurrentDocument.reads = [locks.PS_APP];
    flipXCurrentDocument.writes = [];
    flipXCurrentDocument.transfers = [flipX];
    
    /**
     * Helper command to flip selected layers in the current document vertically
     *
     * @private
     * @return {Promise}
     */
    var flipYCurrentDocument = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.layers.selected;

        if (!currentDocument) {
            return Promise.resolve();
        }

        return this.transfer(flipY, currentDocument, selectedLayers);
    };
    flipYCurrentDocument.reads = [locks.JS_APP];
    flipYCurrentDocument.writes = [];
    flipYCurrentDocument.transfers = [flipY];
    
    /**
     * Asks photoshop to align layers either Left, right or center. (horizontally or vertically).
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models
     * @param {string} align either left right top bottom hCenter or vCenter
     * @return {Promise}
     */
    var _align = function (document, layers, align) {
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
            alignAction = layerLib.align(ref, align),
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.ALIGN_LAYERS,
                    target: documentLib.referenceBy.id(document.id)
                }
            };
        
        return locking.playWithLockOverride(document, layers, alignAction, options)
            .bind(this)
            .then(function () {
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetBounds, document, descendants);
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
    var alignLeft = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return _align.call(this, document, layers, "left");
    };
    alignLeft.reads = [locks.JS_APP];
    alignLeft.writes = [locks.PS_DOC, locks.JS_DOC];
    alignLeft.transfers = [layerActions.resetBounds];

    /**
     * Helper command to align right
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignRight = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return _align.call(this, document, layers, "right");
    };
    alignRight.reads = [locks.JS_APP];
    alignRight.writes = [locks.PS_DOC, locks.JS_DOC];
    alignRight.transfers = [layerActions.resetBounds];
    
    /**
     * Helper command to align top
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignTop = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return _align.call(this, document, layers, "top");
    };
    alignTop.reads = [locks.JS_APP];
    alignTop.writes = [locks.PS_DOC, locks.JS_DOC];
    alignTop.transfers = [layerActions.resetBounds];

    /**
     * Helper command to align bottom
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignBottom = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return _align.call(this, document, layers, "bottom");
    };
    alignBottom.reads = [locks.JS_APP];
    alignBottom.writes = [locks.PS_DOC, locks.JS_DOC];
    alignBottom.transfers = [layerActions.resetBounds];

    /**
     * Helper command to align vCenter
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignVCenter = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return _align.call(this, document, layers, "vCenter");
    };
    alignVCenter.reads = [locks.JS_APP];
    alignVCenter.writes = [locks.PS_DOC, locks.JS_DOC];
    alignVCenter.transfers = [layerActions.resetBounds];

    /**
     * Helper command to align hCenter
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var alignHCenter = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return _align.call(this, document, layers, "hCenter");
    };
    alignHCenter.reads = [locks.JS_APP];
    alignHCenter.writes = [locks.PS_DOC, locks.JS_DOC];
    alignHCenter.transfers = [layerActions.resetBounds];

    /**
     * Asks photoshop to align layers either Left, right or center. (horizontally or vertically).
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models
     * @param {string} align either left right top bottom hCenter or vCenter
     * @return {Promise}
     */
    var _distribute = function (document, layers, align) {
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
            distributeAction = layerLib.distribute(ref, align),
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.DISTRIBUTE_LAYERS,
                    target: documentLib.referenceBy.id(document.id)
                }
            };
        
        return locking.playWithLockOverride(document, layers, distributeAction, options)
            .bind(this)
            .then(function () {
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetBounds, document, descendants);
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
    var distributeX = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return _distribute.call(this, document, layers, "horizontally");
    };
    distributeX.reads = [locks.JS_APP];
    distributeX.writes = [locks.PS_DOC, locks.JS_DOC];
    distributeX.transfers = [layerActions.resetBounds];

    /**
     * Helper command to dstribute along the horizontal axis
     *
     * @private
     * @param {Document} document document model object
     * @param {Immutable.Iterable.<Layer>} layers array of layer models 
     * @return {Promise}
     */
    var distributeY = function (document, layers) {
        if (!document && !layers) {
            document = this.flux.store("application").getCurrentDocument();
            layers = document.layers.selected;
        }
        return _distribute.call(this, document, layers, "vertically");
    };
    distributeY.reads = [locks.JS_APP];
    distributeY.writes = [locks.PS_DOC, locks.JS_DOC];
    distributeY.transfers = [layerActions.resetBounds];

    /**
     * Set the radius of the rectangle shapes in the given layers of the given
     * document to the given number of pixels. Currently, the command ignores
     * document and layers paramters and acts on the selected layers of the
     * active document.
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {number} radius New uniform border radius in pixels
     * @param {boolean} coalesce Whether this history state should be coalesce with the previous one
     */
    var setRadius = function (document, layers, radius, coalesce) {
        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.RADII_CHANGED, {
            documentID: document.id,
            layerIDs: collection.pluck(layers, "id"),
            coalesce: coalesce,
            radii: {
                topLeft: radius,
                topRight: radius,
                bottomRight: radius,
                bottomLeft: radius
            }
        });

        var radiusDescriptor = contentLib.setRadius(radius),
            options = {
                paintOptions: _paintOptions,
                historyStateInfo: {
                    name: strings.ACTIONS.SET_RADIUS,
                    target: documentLib.referenceBy.id(document.id),
                    coalesce: !!coalesce,
                    suppressHistoryStateNotification: !!coalesce
                }
            },
            radiusPromise = locking.playWithLockOverride(document, layers, radiusDescriptor, options);

        return Promise.join(dispatchPromise, radiusPromise);
    };
    setRadius.reads = [locks.PS_DOC, locks.JS_DOC];
    setRadius.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Helper command to swap the two given layers top-left positions
     *
     * @private
     *
     * @return {Promise}
     */
    var swapLayersCurrentDocument = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.layers.selected;

        if (!currentDocument ||
            selectedLayers.size !== 2) {
            return Promise.resolve();
        }
        return this.transfer(swapLayers, currentDocument, selectedLayers);
    };
    swapLayersCurrentDocument.reads = [locks.JS_APP, locks.JS_DOC];
    swapLayersCurrentDocument.writes = [];
    swapLayersCurrentDocument.transfers = [swapLayers];

    /**
     * Rotates the currently selected layers by given angle
     *
     * @param {Document} document 
     * @param {number} angle Angle in degrees
     * @return {Promise}
     */
    var rotate = function (document, angle) {
        var documentRef = documentLib.referenceBy.id(document.id),
            layerRef = [documentRef, layerLib.referenceBy.current],
            rotateObj = layerLib.rotate(layerRef, angle),
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.ROTATE_LAYERS,
                    target: documentLib.referenceBy.id(document.id)
                }
            };

        return locking.playWithLockOverride(document, document.layers.selected, rotateObj, options)
            .bind(this)
            .then(function () {
                var selected = document.layers.selected,
                    descendants = selected.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetBounds, document, descendants);
            });
    };
    rotate.reads = [locks.JS_DOC];
    rotate.writes = [locks.PS_DOC];
    rotate.transfers = [layerActions.resetBounds];

    /**
     * Helper command to rotate layers in currently selected document through the menu
     *
     * @param  {{angle: number}} payload Contains the angle to rotate layers by
     * @return {Promise}
     */
    var rotateLayersInCurrentDocument = function (payload) {
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
    rotateLayersInCurrentDocument.reads = [locks.JS_APP];
    rotateLayersInCurrentDocument.writes = [];
    rotateLayersInCurrentDocument.transfers = [rotate];

    /**
     * Nudges the given layers in the given direction
     *
     * @param {string} direction Direction of nudge
     * @param {boolean} bigStep Flag to indicate bigger nudge
     *
     * @return {Promise}
     */
    var nudgeLayers = function (direction, bigStep) {
        // Different from other actions, nudge always makes sure to get the latest document model
        // Since we rely on the bounds information from the model to compute new positions
        // Otherwise, superselectTool.onKeyDown's document model and the current document model
        // can fall out of sync and produce false results, breaking parity
        var document = this.flux.store("application").getCurrentDocument(),
            layerSpec = document.layers.selected;

        if (layerSpec.isEmpty()) {
            return Promise.resolve();
        }

        var hasLocked = layerSpec.some(function (layer) {
            return layer.locked;
        });

        if (hasLocked) {
            return Promise.resolve();
        }

        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.kind === layer.layerKinds.GROUPEND;
        });

        var options = {
                historyStateInfo: {
                    name: strings.ACTIONS.NUDGE_LAYERS,
                    target: documentLib.referenceBy.id(document.id)
                }
            },
            payload = {
                documentID: document.id,
                positions: []
            },
            deltaX = 0,
            deltaY = 0,
            bigNudge = 10,
            nudge = 1;

        switch (direction) {
            case "up":
                deltaY = bigStep ? -bigNudge : -nudge;
                break;
            case "down":
                deltaY = bigStep ? bigNudge : nudge;
                break;
            case "left":
                deltaX = bigStep ? -bigNudge : -nudge;
                break;
            case "right":
                deltaX = bigStep ? bigNudge : nudge;
                break;
        }

        var translateLayerActions = layerSpec.reduce(function (actions, layer) {
            var currentBounds = document.layers.childBounds(layer),
                position = {
                    x: currentBounds.left + deltaX,
                    y: currentBounds.top + deltaY
                },
                layerActions = _getMoveLayerActions.call(this, document, layer, position, payload.positions);

            return actions.concat(layerActions);
        }, Immutable.List(), this);

        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.REPOSITION_LAYERS, payload)
                .bind(this).then(function () {
                    this.transfer(toolActions.resetBorderPolicies);
                }),
            positionPromise = layerActionsUtil.playLayerActions(document, translateLayerActions, true, options);
        
        return Promise.join(positionPromise, dispatchPromise);
    };
    nudgeLayers.reads = [locks.JS_APP];
    nudgeLayers.writes = [locks.PS_DOC, locks.JS_DOC];
    nudgeLayers.transfers = [toolActions.resetBorderPolicies];

    /**
     * Transform event handler initialized in beforeStartup
     *
     * @private
     * @type {function()}
     */
    var _artboardTransformHandler,
        _layerTransformHandler;

    var beforeStartup = function () {
        _artboardTransformHandler = synchronization.debounce(function () {
            // After each action we call, document model changes
            // so we re-get it
            var appStore = this.flux.store("application"),
                nextDoc = appStore.getCurrentDocument();

            return this.flux.actions.layers.resetBounds(nextDoc, nextDoc.layers.allSelected)
                .bind(this)
                .then(function () {
                    nextDoc = appStore.getCurrentDocument();
                    this.flux.actions.layers.resetSelection(nextDoc);
                }).then(function () {
                    nextDoc = appStore.getCurrentDocument();
                    this.flux.actions.layers.resetIndex(nextDoc, true);
                });
        }, this);

        _layerTransformHandler = synchronization.debounce(function (event) {
            // If it was a simple click/didn't move anything, there is no need to update bounds,
            // just redraw the overlay
            if (event.trackerEndedWithoutBreakingHysteresis) {
                return this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: true });
            }

            this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: true });

            var appStore = this.flux.store("application"),
                currentDoc = appStore.getCurrentDocument(),
                textLayers = currentDoc.layers.allSelected.filter(function (layer) {
                    // Reset these layers completely because their impliedFontSize may have changed
                    return layer.kind === layer.layerKinds.TEXT;
                }),
                otherLayers = currentDoc.layers.allSelected.filterNot(function (layer) {
                    return layer.kind === layer.layerKinds.TEXT;
                }),
                textLayersPromise = this.flux.actions.layers.resetLayers(currentDoc, textLayers),
                otherLayersPromise = this.flux.actions.layers.resetBounds(currentDoc, otherLayers);

            return Promise.join(textLayersPromise, otherLayersPromise);
        }, this);

        descriptor.addListener("transform", _layerTransformHandler);
        descriptor.addListener("move", _layerTransformHandler);
        descriptor.addListener("editArtboardEvent", _artboardTransformHandler);
        return Promise.resolve();
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [];

    /**
     * Clean up event handlers
     */
    var onReset = function () {
        descriptor.removeListener("transform", _layerTransformHandler);
        descriptor.removeListener("move", _layerTransformHandler);
        descriptor.removeListener("editArtboardEvent", _artboardTransformHandler);

        return Promise.resolve();
    };
    onReset.reads = [];
    onReset.writes = [];
    
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;

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
    exports.rotate = rotate;
    exports.rotateLayersInCurrentDocument = rotateLayersInCurrentDocument;
    exports.nudgeLayers = nudgeLayers;
});
