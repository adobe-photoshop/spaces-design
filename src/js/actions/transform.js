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
        
    var descriptor = require("adapter").ps.descriptor,
        documentLib = require("adapter").lib.document,
        layerLib = require("adapter").lib.layer,
        artboardLib = require("adapter").lib.artboard,
        contentLib = require("adapter").lib.contentLayer,
        unitLib = require("adapter").lib.unit,
        uiUtil = require("js/util/ui");

    var events = require("../events"),
        locks = require("js/locks"),
        log = require("js/util/log"),
        layerActions = require("./layers"),
        collection = require("js/util/collection"),
        historyActions = require("./history"),
        locking = require("js/util/locking"),
        layerActionsUtil = require("js/util/layeractions"),
        headlights = require("js/util/headlights"),
        nls = require("js/util/nls"),
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
     * Filter out layers that can't generally be transformed like empty,
     * adjustment and background layers.
     *
     * @private
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {boolean=} filterArtboards
     * @return {Immutable.Iterable.<Layer>}
     */
    var _filterTransform = function (document, layers, filterArtboards) {
        return layers.filterNot(function (layer) {
            // Adjustment and background layers can't be transformed
            if (layer.isAdjustment || layer.isBackground) {
                return true;
            }

            // Artboards may be exempt from the empty-bounds rule below
            if (!filterArtboards && layer.isArtboard) {
                return false;
            }

            // Layers with empty bounds can't be transformed
            var bounds = document.layers.childBounds(layer);
            return !bounds || bounds.empty;
        });
    };

    /**
     * Helper function that will break down a given layer to all it's children
     * and calculate the move action for the layer and new bounds of all the children.
     *
     * @param {Document} document
     * @param {Layer} targetLayer
     * @param {{relative: boolean=, x: number, y: number}} position
     * @param {boolean=} position.relative If true, will calculate new position relative to
     *                                     parent artboard of the layer
     * @param {string} refPoint Two character string denoting corner/edge of the layer to set the position into
     * @param {Array.<{layer: Layer, x: number, y: number}>} moveResults payload for updating each layer's bounds
     * @param {boolean=} translate Whether to use translate or set absolute position by given coordinates
     *                             absolute position is default
     *
     * @return {Immutable.List<{layer: Layer, playObject: PlayObject}>}
     */
    var _getMoveLayerActions = function (document, targetLayer, position, refPoint, moveResults, translate) {
        var overallBounds = position.relative ?
                document.layers.relativeChildBounds(targetLayer) :
                document.layers.childBounds(targetLayer),
            positionKeys = uiUtil.getPositionKeysByRefPoint(refPoint),
            deltaX = position.hasOwnProperty("x") ? position.x - overallBounds[positionKeys.x] : 0,
            deltaY = position.hasOwnProperty("y") ? position.y - overallBounds[positionKeys.y] : 0,
            newX = translate ? deltaX : (overallBounds.left + deltaX),
            newY = translate ? deltaY : (overallBounds.top + deltaY),
            documentRef = documentLib.referenceBy.id(document.id),
            movingLayers = document.layers.descendants(targetLayer),
            layerRef = [documentRef, layerLib.referenceBy.id(targetLayer.id)],
            descriptorFn = translate ? layerLib.translate : layerLib.setPosition;

        moveResults = moveResults || [];

        // We only send the move command for the main layer, but we
        // calculate the new bounds for all child layers
        movingLayers.forEach(function (layer) {
            if (!layer.bounds || layer.bounds.empty) {
                return;
            }
            
            moveResults.push({
                layer: layer,
                x: layer.bounds.left + deltaX,
                y: layer.bounds.top + deltaY
            });
        });

        return Immutable.List.of({
            layer: targetLayer,
            playObject: descriptorFn(layerRef, newX, newY)
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
            { x: l1Left, y: l1Top, relative: false },
            { x: l2Left, y: l2Top, relative: false }
        );
    };

    /**
     * Helper function for resize action
     * @private
     * @param {object} bounds
     * @param {{w: number=, h: number=}} size
     * @param {boolean=} proportional
     * 
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
     * Resizing layers needs to acccount for a number of different cases:
     *      - artboards
     *      - groups of layers 
     *      - the reference point
     *      - whether the width and height should grow proportionally
     * 
     * In the case of groups of layers, we need to get all the descendants and calculate
     * the ratio at which they should each change given the new size. Then we need to 
     * calculate how much the layer will shift with regard to its current top-left position,
     * given the reference point and new size. These shifts will be known as the top and left
     * offsets respectively.
     *
     * @param {Document} document
     * @param {Layer} targetLayer
     * @param {{w: number=, h: number=}} nextSize
     * @param {Array.<{layer: Layer, w: number, h: number}>} resizeResults payload for updating each layer's bounds
     * @param {string} refPoint in the format of vertical direction then horizontal
     *
     * @return {Immutable.List<{layer: Layer, playObject: PlayObject}>}
     */
    var _getResizeLayerActions = function (document, targetLayer, nextSize, resizeResults, refPoint) {
        var overallBounds = document.layers.childBounds(targetLayer),
            documentRef = documentLib.referenceBy.id(document.id),
            resizingLayers;

        if (targetLayer.isArtboard) {
            // We don't want to break down artboards, but just change their bounds
            resizingLayers = Immutable.List.of(targetLayer);
        } else {
            // For groups, grab all the descendants 
            resizingLayers = document.layers.descendants(targetLayer);
        }

        resizeResults = resizeResults || [];

        var size = _calculateNewSize(overallBounds, nextSize, targetLayer.proportionalScaling);

        // Used to calculate the new top/left positions of all layers in relation to top/left
        // of the group
        var overallWidthRatio = size.w ? size.w / overallBounds.width : 0,
            overallHeightRatio = size.h ? size.h / overallBounds.height : 0,
            overallLeftOffset = 0,
            overallTopOffset = 0,
            horizontalDirection,
            verticalDirection;

        // This is the case if the width input was changed
        // "L" and "T" are the default cases in which none of the offsets need to be calculated.
        horizontalDirection = refPoint.charAt(0);
        switch (horizontalDirection) {
            // This is the default case in which no left offset needs to be calculated. 
            // This case is included for self-documentation.
            case "l":
                break;
            case "m":
                overallLeftOffset = (overallBounds.width - size.w) / 2;
                break;
            case "r":
                overallLeftOffset = overallBounds.width - size.w;
                break;
        }
        
        // if the height input was changed
        verticalDirection = refPoint.charAt(1);
        switch (verticalDirection) {
            // This is the default case in which no top offset needs to be calculated. 
            // This case is included for self-documentation.
            case "t":
                break;
            case "c":
                overallTopOffset = (overallBounds.height - size.h) / 2;
                break;
            case "b":
                overallTopOffset = overallBounds.height - size.h;
                break;
        }

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
                    left: layerLeft + overallLeftOffset,
                    top: layerTop + overallTopOffset
                },
                widthRatio = layer.bounds.width / overallBounds.width,
                heightRatio = layer.bounds.height / overallBounds.height,
                resizeObj;

            if (size.w !== overallBounds.width) {
                targetSize.w = size.w * widthRatio;
                targetPosition.left =
                    overallBounds.left + overallLeftOffset + (layerLeft - overallBounds.left) * overallWidthRatio;
            }

            if (size.h !== overallBounds.height) {
                targetSize.h = size.h * heightRatio;
                targetPosition.top =
                    overallBounds.top + overallTopOffset + (layerTop - overallBounds.top) * overallHeightRatio;
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
     * @param {object} position Object describing the position to move layers to
     * @param {number} position.x Target horizontal location of top left corner of layer
     * @param {number} position.y Target vertical location of top left corner of the layer
     * @param {boolean} position.relative If true, x and y will be relative to the owner artboard of layer
     * @param {string} refPoint Two character string denoting the active reference point so we know 
     *                 which corner of the layer to move
     * @param {object} options Batch play options
     * 
     * @return {Promise}
     */
    var setPosition = function (document, layerSpec, position, refPoint, options) {
        options = _.merge({}, options);
        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.isGroupEnd;
        });

        var payload = {
            documentID: document.id,
            positions: [],
            coalesce: !!options.coalesce,
            history: {
                newState: true,
                name: nls.localize("strings.ACTIONS.SET_LAYER_POSITION")
            }
        };

        options = _.merge(options, {
            paintOptions: _paintOptions,
            historyStateInfo: {
                name: nls.localize("strings.ACTIONS.SET_LAYER_POSITION"),
                target: documentLib.referenceBy.id(document.id),
                coalesce: !!options.coalesce,
                suppressHistoryStateNotification: !!options.coalesce
            }
        });

        // If coalescing, we use absolute setPosition function to avoid model mismatch
        var dispatchPromise = this.dispatchAsync(events.document.history.REPOSITION_LAYERS, payload),
            translateLayerActions = layerSpec.reduce(function (actions, layer) {
                var layerActions = _getMoveLayerActions.call(this,
                        document, layer, position, refPoint, payload.positions, !options.coalesce);
                return actions.concat(layerActions);
            }, Immutable.List(), this);

        var transaction = descriptor.beginTransaction(options),
            actionOpts = _.merge(options, {
                transaction: transaction
            });

        var positionPromise = layerActionsUtil.playLayerActions(document, translateLayerActions, true, actionOpts)
            .then(function () {
                return descriptor.endTransaction(transaction);
            });

        return Promise.join(dispatchPromise, positionPromise)
            .bind(this)
            .then(function () {
                return this.transfer(layerActions.resetIndex, undefined);
            });
    };
    setPosition.action = {
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [layerActions.resetIndex]
    };

    /**
     * Swaps the two given layers top-left positions
     *
     * @private
     * @param {Document} document Owner document
     * @param {Immutable.Iterable.<Layer>} layers A list of two layers
     *
     * @return {Promise}
     */
    var swapLayers = function (document, layers) {
        layers = _filterTransform(document, layers);

        // validate layers input
        if (layers.size !== 2) {
            return Promise.resolve();
        }

        var newPositions = _calculateSwapLocations(document, layers),
            documentRef = documentLib.referenceBy.id(document.id),
            payload = {
                documentID: document.id,
                positions: [],
                history: {
                    newState: true,
                    name: nls.localize("strings.ACTIONS.SWAP_LAYERS")
                }
            },
            layerOneActions = _getMoveLayerActions
                .call(this, document, layers.get(0), newPositions.get(0), "lt", payload.positions),
            layerTwoActions = _getMoveLayerActions
                .call(this, document, layers.get(1), newPositions.get(1), "lt", payload.positions),
            translateActions = layerOneActions.concat(layerTwoActions);
                
        var dispatchPromise = this.dispatchAsync(events.document.history.REPOSITION_LAYERS, payload);

        var autoExpandEnabled = false;

        var hasArtboard = layers.some(function (layer) {
            return layer.isArtboard;
        });

        if (hasArtboard) {
            headlights.logEvent("edit", "layers", "swap-artboard");
        } else {
            headlights.logEvent("edit", "layers", "swap-non-artboard");
        }

        var options = {
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.SWAP_LAYERS"),
                    target: documentRef
                }
            },
            transaction = descriptor.beginTransaction(options),
            actionOpts = {
                transaction: transaction
            };

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
                return layerActionsUtil.playLayerActions(document, translateActions, true, actionOpts);
            })
            .then(function () {
                if (autoExpandEnabled) {
                    var setObj = documentLib.setArtboardAutoAttributes(documentRef, {
                        autoExpandEnabled: true
                    });

                    return descriptor.playObject(setObj);
                }
            })
            .then(function () {
                return descriptor.endTransaction(transaction);
            })
            .then(function () {
                return this.transfer(layerActions.resetIndex, document);
            });

        return Promise.join(dispatchPromise, swapPromise);
    };
    swapLayers.action = {
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [layerActions.resetIndex]
    };

    /**
     * Sets the given layers' sizes
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {{w: number=, h: number=}} size
     * @param {string} refPoint reference point, vertical position first then horizontal
     * @param {object} options Batch play options
     *
     * @returns {Promise}
     */
    var setSize = function (document, layerSpec, size, refPoint, options) {
        options = _.merge({}, options);
        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.isGroupEnd ||
                document.layers.strictAncestors(layer)
                .some(function (ancestor) {
                    return layerSpec.contains(ancestor);
                });
        }, this);

        var payload = {
            documentID: document.id,
            sizes: [],
            coalesce: !!options.coalesce,
            history: {
                newState: true,
                name: nls.localize("strings.ACTIONS.SET_LAYER_SIZE")
            }
        };
        
        options = _.merge(options, {
            paintOptions: _paintOptions,
            historyStateInfo: {
                name: nls.localize("strings.ACTIONS.SET_LAYER_SIZE"),
                target: documentLib.referenceBy.id(document.id),
                coalesce: !!options.coalesce,
                suppressHistoryStateNotification: !!options.coalesce
            }
        });

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
            
            dispatchPromise = this.dispatchAsync(events.document.history.RESIZE_DOCUMENT, payload);
            sizePromise = descriptor.playObject(resizeObj);
        } else {
            var documentRef = documentLib.referenceBy.id(document.id),
                autoExpandEnabled = false,
                resizeLayerActions = layerSpec.reduce(function (actions, layer) {
                    var action = _getResizeLayerActions.call(this, document, layer, size, payload.sizes, refPoint);
                    return actions.concat(action);
                }, Immutable.List(), this);

            dispatchPromise = this.dispatchAsync(events.document.history.RESIZE_LAYERS, payload);

            var transaction = descriptor.beginTransaction(options),
                actionOpts = _.merge(options, {
                    transaction: transaction
                });

            sizePromise = descriptor.getProperty(documentRef, "artboards", actionOpts)
                .bind(this)
                .then(function (artboardInfo) {
                    autoExpandEnabled = artboardInfo.autoExpandEnabled;

                    if (!autoExpandEnabled) {
                        return Promise.resolve();
                    } else {
                        var setObj = documentLib.setArtboardAutoAttributes(documentRef, {
                            autoExpandEnabled: false
                        });

                        return descriptor.playObject(setObj, actionOpts);
                    }
                })
                .then(function () {
                    return layerActionsUtil.playLayerActions(document, resizeLayerActions, true, actionOpts);
                })
                .then(function () {
                    if (autoExpandEnabled) {
                        var setObj = documentLib.setArtboardAutoAttributes(documentRef, {
                            autoExpandEnabled: true
                        });

                        return descriptor.playObject(setObj, actionOpts);
                    }
                })
                .then(function () {
                    return descriptor.endTransaction(transaction);
                });
        }

        return Promise.join(dispatchPromise, sizePromise)
            .bind(this)
            .then(function () {
                var typeLayers = layerSpec.filter(function (layer) {
                    return layer.isText;
                });

                // Reset type layers to pick up their implicit font size changes.
                // Final true parameter indicates that history should be amended
                // with this change.
                return this.transfer(layerActions.resetLayers, document, typeLayers, true);
            });
    };
    setSize.action = {
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [layerActions.resetLayers]
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
    var _flip = function (document, layers, axis) {
        layers = _filterTransform(document, layers);

        // validate layers input
        if (layers.isEmpty()) {
            return Promise.resolve();
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
                    name: nls.localize("strings.ACTIONS.FLIP_LAYERS"),
                    target: documentLib.referenceBy.id(document.id)
                }
            },
            historyPromise = this.transfer(historyActions.newHistoryState, document.id,
                nls.localize("strings.ACTIONS.FLIP_LAYERS")),
            playPromise = locking.playWithLockOverride(document, layers, flipAction, options);

        return Promise.join(historyPromise, playPromise)
            .bind(this)
            .then(function () {
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetBounds, document, descendants);
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
    flipX.action = {
        reads: [],
        writes: [locks.JS_DOC, locks.PS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetBounds]
    };
    
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
    flipY.action = {
        reads: [],
        writes: [locks.JS_DOC, locks.JS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetBounds]
    };
    
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
    flipXCurrentDocument.action = {
        reads: [locks.PS_APP],
        writes: [],
        transfers: [flipX]
    };
    
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
    flipYCurrentDocument.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [flipY]
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
    var align = function (document, layers, align) {
        layers = _filterTransform(document, layers);

        // validate layers input
        if (layers.size < 2) {
            return Promise.resolve();
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
                    name: nls.localize("strings.ACTIONS.ALIGN_LAYERS"),
                    target: documentLib.referenceBy.id(document.id)
                }
            },
            historyPromise = this.transfer(historyActions.newHistoryState, document.id,
                nls.localize("strings.ACTIONS.ALIGN_LAYERS")),
            playPromise = locking.playWithLockOverride(document, layers, alignAction, options);

        return Promise.join(historyPromise, playPromise)
            .bind(this)
            .then(function () {
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetBounds, document, descendants);
            });
    };
    align.action = {
        reads: [locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetBounds]
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
        return this.transfer(align, document, layers, "left");
    };
    alignLeft.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [align]
    };

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
        return this.transfer(align, document, layers, "right");
    };
    alignRight.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [align]
    };
    
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
        return this.transfer(align, document, layers, "top");
    };
    alignTop.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [align]
    };

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
        return this.transfer(align, document, layers, "bottom");
    };
    alignBottom.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [align]
    };

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
        return this.transfer(align, document, layers, "vCenter");
    };
    alignVCenter.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [align]
    };

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
        return this.transfer(align, document, layers, "hCenter");
    };
    alignHCenter.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [align]
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
    var _distribute = function (document, layers, align) {
        layers = _filterTransform(document, layers);

        // validate layers input
        if (layers.size < 2) {
            return Promise.resolve();
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
                    name: nls.localize("strings.ACTIONS.DISTRIBUTE_LAYERS"),
                    target: documentLib.referenceBy.id(document.id)
                }
            },
            historyPromise = this.transfer(historyActions.newHistoryState, document.id,
                nls.localize("strings.ACTIONS.DISTRIBUTE_LAYERS")),
            playPromise = locking.playWithLockOverride(document, layers, distributeAction, options);
        
        return Promise.join(historyPromise, playPromise)
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
    distributeX.action = {
        reads: [locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetBounds]
    };

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
    distributeY.action = {
        reads: [locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetBounds]
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
     * @param {object} options
     * @param {boolean=} options.coalesce Whether this history state should be coalesce with the previous one
     */
    var setRadius = function (document, layers, radius, options) {
        options = _.merge({}, options);
        layers = _filterTransform(document, layers, true)
            .filter(function (l) { return !!l.radii; }); // Exclude layers without radii attribute

        if (layers.isEmpty()) {
            return Promise.resolve();
        }

        var dispatchPromise = this.dispatchAsync(events.document.history.RADII_CHANGED, {
            documentID: document.id,
            layerIDs: collection.pluck(layers, "id"),
            coalesce: !!options.coalesce,
            radii: {
                topLeft: radius,
                topRight: radius,
                bottomRight: radius,
                bottomLeft: radius
            },
            history: {
                newState: true,
                name: nls.localize("strings.ACTIONS.SET_RADIUS")
            }
        });
        
        options = _.merge(options, {
            paintOptions: _paintOptions,
            historyStateInfo: {
                name: nls.localize("strings.ACTIONS.SET_RADIUS"),
                target: documentLib.referenceBy.id(document.id),
                coalesce: !!options.coalesce,
                suppressHistoryStateNotification: !!options.coalesce
            }
        });

        var radiusDescriptor = contentLib.setRadius(radius),
            radiusPromise = locking.playWithLockOverride(document, layers, radiusDescriptor, options);

        return Promise.join(dispatchPromise, radiusPromise);
    };
    setRadius.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

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
    swapLayersCurrentDocument.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: [swapLayers]
    };

    /**
     * Rotates the currently selected layers by given angle
     *
     * @param {Document} document 
     * @param {number} angle Angle in degrees
     * @return {Promise}
     */
    var rotate = function (document, angle, options) {
        options = _.merge({}, options);
        var layers = _filterTransform(document, document.layers.selected);
        if (layers.isEmpty()) {
            return Promise.resolve();
        }

        var coalesce = !!options.coalesce;

        options = _.merge(options, {
            historyStateInfo: {
                name: nls.localize("strings.ACTIONS.ROTATE_LAYERS"),
                target: documentLib.referenceBy.id(document.id),
                coalesce: coalesce,
                suppressHistoryStateNotification: coalesce
            }
        });
        
        var documentRef = documentLib.referenceBy.id(document.id),
            layerRef = layers.map(function (layer) {
                    return layerLib.referenceBy.id(layer.id);
                })
                .unshift(documentRef)
                .toArray(),
            rotateObj = layerLib.rotate(layerRef, angle),
            historyPromise = coalesce ? Promise.resolve() : this.transfer(historyActions.newHistoryState, document.id,
                nls.localize("strings.ACTIONS.ROTATE_LAYERS")),
            playPromise = locking.playWithLockOverride(document, layers, rotateObj, options);

        return Promise.join(historyPromise, playPromise)
            .bind(this)
            .then(function () {
                var descendants = layers.flatMap(document.layers.descendants, document.layers);

                return this.transfer(layerActions.resetBounds, document, descendants);
            });
    };
    rotate.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetBounds]
    };

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
    rotateLayersInCurrentDocument.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [rotate]
    };

    /**
     * Handle the "editArtboardEvent" from photoshop
     * TODO: This is a bit heavy-handed
     *
     * @return {Promise}
     */
    var handleTransformArtboard = function () {
        // After each action we call, document model changes
        // so we re-get it
        var appStore = this.flux.store("application"),
            nextDoc = appStore.getCurrentDocument();

        if (!nextDoc) {
            throw new Error("No current document");
        }

        return this.transfer("history.newHistoryStateRogueSafe", nextDoc.id)
            .bind(this)
            .then(function () {
                return this.transfer("layers.resetBounds", nextDoc, nextDoc.layers.allSelected);
            })
            .then(function () {
                nextDoc = appStore.getCurrentDocument();
                return this.transfer("layers.resetSelection", nextDoc);
            })
            .then(function () {
                nextDoc = appStore.getCurrentDocument();
                return this.transfer("layers.resetIndex", nextDoc);
            });
    };
    handleTransformArtboard.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: ["history.newHistoryStateRogueSafe", "layers.resetBounds", "layers.resetSelection",
            "layers.resetIndex"]
    };

    /**
     * Transform event handler initialized in beforeStartup
     *
     * @private
     * @type {function()}
     */
    var _artboardTransformHandler,
        _moveToArtboardHandler,
        _layerTransformHandler;

    var beforeStartup = function () {
        // TODO does this still need to debounce?  Are there cases where we get several events that correspond to
        // one history state?
        _artboardTransformHandler = synchronization.debounce(function () {
            return this.flux.actions.transform.handleTransformArtboard();
        }, this);

        _layerTransformHandler = function (event) {
            this.dispatch(events.panel.TOGGLE_OVERLAYS, { enabled: true });

            var appStore = this.flux.store("application"),
                currentDoc = appStore.getCurrentDocument();

            // Handle the normal move events with a debounced function
            var debouncedMoveHandler = synchronization.debounce(function () {
                // short circuit based on this trackerEndedWithoutBreakingHysteresis event flag
                if (event.trackerEndedWithoutBreakingHysteresis) {
                    return Promise.resolve();
                } else {
                    var textLayers = currentDoc.layers.allSelected.filter(function (layer) {
                            // Reset these layers completely because their impliedFontSize may have changed
                            return layer.isText;
                        }),
                        otherLayers = currentDoc.layers.allSelected.filterNot(function (layer) {
                            return layer.isText;
                        }),

                        // note that in this case, the debouncing is critical even for just one "move" event
                        // because the historyState event must be processed first for the following
                        // "amend history" workflow to function correctly
                        textLayersPromise = this.flux.actions.layers.resetLayers(currentDoc, textLayers),
                        otherLayersPromise = this.flux.actions.layers.resetBounds(currentDoc, otherLayers);

                    return Promise.join(textLayersPromise, otherLayersPromise);
                }
            }, this, 200);

            // newDuplicateSheets move events should be processed immediately, not debounced
            if (event.newDuplicateSheets) {
                var duplicateInfo = event.newDuplicateSheets,
                    newSheetIDlist = duplicateInfo.newSheetIDlist,
                    toIDs = _.pluck(newSheetIDlist, "newLayerID");

                // TODO: The objects in this array also contain layerID and
                // newLayerIndex properties which could be used to implement
                // a somewhat more optimistic copy routine, instead of addLayers
                // which doesn't know that the layers being added are copies of
                // existing layers.
                return this.flux.actions.layers.addLayers(currentDoc, toIDs, true, false)
                    .bind(this)
                    .then(function () {
                        return this.flux.actions.ui.updateTransform();
                    });
            } else {
                return debouncedMoveHandler();
            }
        }.bind(this);

        _moveToArtboardHandler = synchronization.debounce(function () {
            // Undefined makes it use the most recent document model
            return this.flux.actions.layers.resetIndex(undefined);
        }, this);

        descriptor.addListener("transform", _layerTransformHandler);
        descriptor.addListener("move", _layerTransformHandler);
        descriptor.addListener("nudge", _layerTransformHandler);
        descriptor.addListener("editArtboardEvent", _artboardTransformHandler);
        descriptor.addListener("moveToArtboard", _moveToArtboardHandler);
        return Promise.resolve();
    };
    beforeStartup.action = {
        reads: [],
        writes: []
    };

    /**
     * Clean up event handlers
     */
    var onReset = function () {
        descriptor.removeListener("transform", _layerTransformHandler);
        descriptor.removeListener("move", _layerTransformHandler);
        descriptor.removeListener("nudge", _layerTransformHandler);
        descriptor.removeListener("editArtboardEvent", _artboardTransformHandler);
        descriptor.removeListener("moveToArtboard", _moveToArtboardHandler);

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: []
    };
    
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;

    exports.setPosition = setPosition;
    exports.setSize = setSize;
    exports.flipX = flipX;
    exports.flipY = flipY;
    exports.flipXCurrentDocument = flipXCurrentDocument;
    exports.flipYCurrentDocument = flipYCurrentDocument;
    exports.align = align;
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
    exports.handleTransformArtboard = handleTransformArtboard;
});
