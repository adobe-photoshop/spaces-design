/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

    var historyActions = require("./history"),
        layerActions = require("./layers"),
        locks = require("../locks");

    var descriptor = require("adapter").ps.descriptor,
        boundsLib = require("adapter").lib.bounds,
        vectorMaskLib = require("adapter").lib.vectorMask,
        documentLib = require("adapter").lib.document,
        layerLib = require("adapter").lib.layer;

    var events = require("../events"),
        nls = require("js/util/nls"),
        layerActionsUtil = require("js/util/layeractions");

    var _CLEAR_PATH = 106;

    /**
     * Select the vector mask for the currently selected layer.
     *
     * @return {Promise}
     */
    var selectVectorMask = function () {
        return descriptor.playObject(vectorMaskLib.selectVectorMask());
    };

    selectVectorMask.action = {
        reads: [],
        writes: [locks.PS_DOC],
        modal: true
    };

    /**
     * Reveal and select the vector mask of the selected layer. 
     * Also switch to the vector based superselect tool.
     *
     * @return {Promise}
     */
    var editVectorMask = function () {
        var toolStore = this.flux.store("tool"),
            superselectVector = toolStore.getToolByID("superselectVector");

        return this.transfer("tools.select", superselectVector)
            .then(function () {
                // select and activate knots on Current Vector Mask
                return descriptor.playObject(vectorMaskLib.activateVectorMaskEditing());
            });
    };
    editVectorMask.action = {
        reads: [locks.JS_TOOL],
        writes: [locks.PS_DOC],
        transfers: ["tools.select"],
        modal: true
    };

    /**
     * Removes a vector mask on the selected layer.
     *
     * @return {Promise}
     */
    var deleteVectorMask = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (currentDocument === null) {
            return Promise.resolve();
        }

        var layers = currentDocument.layers.selected;

        if (layers === null || layers.isEmpty()) {
            return Promise.resolve();
        }

        var currentLayer = layers.first();

        if (currentLayer.vectorMaskEnabled) {
            var deleteMaskOptions = {
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.DELETE_VECTOR_MASK"),
                    target: documentLib.referenceBy.id(currentDocument.id)
                }
            };
            return descriptor.playObject(vectorMaskLib.deleteVectorMask(), deleteMaskOptions)
                .bind(this)
                .then(function () {
                    var payload = {
                            documentID: currentDocument.id,
                            layerIDs: Immutable.List.of(currentLayer.id),
                            vectorMaskEnabled: false,
                            history: {
                                newState: true,
                                name: nls.localize("strings.ACTIONS.DELETE_VECTOR_MASK")
                            }
                        },
                        event = events.document.history.REMOVE_VECTOR_MASK_FROM_LAYER;

                    return this.dispatchAsync(event, payload);
                });
        } else {
            return Promise.resolve();
        }
    };
    deleteVectorMask.action = {
        reads: [locks.JS_TOOL],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Handle escaping from vector mask for the selection-based vector mask tools.
     * Most tools can just call tools.changeVectorMaskMode directly.
     *
     * @return {Promise}
     */
    var handleEscapeVectorMask = function () {
        var appStore = this.flux.store("application"),
            toolStore = this.flux.store("tool"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        if (toolStore.getVectorMode() && toolStore.getModalToolState()) {
            return this.transfer("tools.changeVectorMaskMode", false);
        }

        var currentLayers = currentDocument.layers.selected;

        if (currentLayers.isEmpty()) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.first();

        return this.transfer("layers.resetLayers", currentDocument, currentLayer)
            .bind(this)
            .then(function () {
                currentDocument = appStore.getCurrentDocument();
                currentLayer = currentDocument.layers.selected.first();
                if (currentLayer && currentLayer.vectorMaskEmpty) {
                    return this.transfer("tools.changeVectorMaskMode", false);
                } else {
                    return this.transfer("tools.select", toolStore.getToolByID("newSelect"));
                }
            });
    };
    handleEscapeVectorMask.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: ["layers.resetLayers", "tools.changeVectorMaskMode", "tools.select"],
        modal: true
    };

    /**
     * Handle deleting the vector mask for all of the vector mask mode tools.
     *
     * @return {Promise}
     */
    var handleDeleteVectorMask = function () {
        var appStore = this.flux.store("application"),
            toolStore = this.flux.store("tool"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        if (toolStore.getModalToolState()) {
            return this.transfer("mask.deleteVectorMask")
                .bind(this)
                .then(function () {
                    return this.transfer("tools.changeVectorMaskMode", false);
                });
        }

        var currentLayer = currentDocument.layers.selected.first();

        return this.transfer("layers.resetLayers", currentDocument, currentLayer)
            .bind(this)
            .then(function () {
                currentDocument = appStore.getCurrentDocument();
                currentLayer = currentDocument.layers.selected.first();
                
                if (currentLayer && !currentLayer.vectorMaskEmpty) {
                    var payload = { commandID: _CLEAR_PATH, waitForCompletion: true };
                    return this.transfer("menu.native", payload)
                        .bind(this)
                        .then(function () {
                            return this.transfer("layers.resetLayers", currentDocument, currentLayer);
                        })
                        .then(function () {
                            currentDocument = appStore.getCurrentDocument();
                            currentLayer = currentDocument.layers.selected.first();
                            if (currentLayer && !currentLayer.vectorMaskEnabled) {
                                return this.transfer("mask.deleteVectorMask")
                                    .bind(this)
                                    .then(function () {
                                        return this.transfer("tools.changeVectorMaskMode", false);
                                    });
                            }
                        });
                } else {
                    return this.transfer("mask.deleteVectorMask")
                        .bind(this)
                        .then(function () {
                            this.transfer("tools.changeVectorMaskMode", false);
                        });
                }
            });
    };
    handleDeleteVectorMask.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: ["layers.resetLayers", "mask.deleteVectorMask", "tools.changeVectorMaskMode",
            "menu.native"]
    };

    /**
     * Create a mask that matches the bounds of the currently selected layer
     *
     * @return {Promise}
     */
    var applyRectangle = function () {
        var appStore = this.flux.store("application"),
            toolStore = this.flux.store("tool"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        var currentLayers = currentDocument.layers.selected;

        if (currentLayers.isEmpty()) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.last(),
            deletePromise;
            
        if (currentLayer.vectorMaskEnabled) {
            deletePromise = this.transfer("mask.deleteVectorMask");
        } else {
            deletePromise = Promise.resolve();
        }

        var bounds = boundsLib.bounds(currentDocument.layers.childBounds(currentLayer)),
            options = {
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.ADD_VECTOR_MASK"),
                    target: documentLib.referenceBy.id(currentDocument.id),
                    coalesce: true,
                    suppressHistoryStateNotification: true
                }
            },
            layerList = Immutable.List.of(currentLayer),
            createActions = [
                vectorMaskLib.makeBoundsWorkPath(bounds),
                vectorMaskLib.makeVectorMaskFromWorkPath(),
                vectorMaskLib.deleteWorkPath()];

        return layerActionsUtil.playSimpleLayerActions(currentDocument, layerList, createActions, true, options)
            .bind(this)
            .then(function () {
                return this.transfer("tools.select", toolStore.getToolByID("newSelect"));
            });
    };
    applyRectangle.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: ["tools.select", "mask.deleteVectorMask"]
    };

    /**
     * Create a circular mask the size of the currently selected layer
     *
     * @return {Promise}
     */
    var applyEllipse = function () {
        var appStore = this.flux.store("application"),
            toolStore = this.flux.store("tool"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        var currentLayers = currentDocument.layers.selected;

        if (currentLayers.isEmpty()) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.last(),
            deletePromise;

        if (currentLayer.vectorMaskEnabled) {
            deletePromise = this.transfer("mask.deleteVectorMask");
        } else {
            deletePromise = Promise.resolve();
        }

        var bounds = currentLayer.bounds,
            options = {
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.ADD_VECTOR_MASK"),
                    target: documentLib.referenceBy.id(currentDocument.id),
                    coalesce: true,
                    suppressHistoryStateNotification: true
                }
            },
            layerList = Immutable.List.of(currentLayer),
            createActions = [
                vectorMaskLib.makeCircularBoundsWorkPath(bounds),
                vectorMaskLib.makeVectorMaskFromWorkPath(),
                vectorMaskLib.deleteWorkPath()];

        return deletePromise
            .bind(this)
            .then(function () {
                layerActionsUtil.playSimpleLayerActions(currentDocument, layerList, createActions, true, options)
            })
            .then(function () {
                return this.transfer("tools.select", toolStore.getToolByID("newSelect"));
            });
    };
    applyEllipse.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: ["tools.select", "mask.deleteVectorMask"]
    };

    /**
     * if there are two selected layers create a vector mask on one of them from the path of the shape in the 
     * other selected layer
     *
     * @return {Promise}
     */
    var createVectorMaskFromShape = function () {
        var appStore = this.flux.store("application"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        var currentLayers = currentDocument.layers.selected;

        if (currentLayers.size !== 2) {
            return Promise.resolve();
        }

        var shapeLayers = currentLayers.filter(function (layer) {
                return layer.isVector;
            }),
            maskLayers = currentLayers.filter(function (layer) {
                return currentDocument.layers.canSupportVectorMask(layer) &&
                    !layer.vectorMaskEnabled;
            });

        if (shapeLayers.isEmpty() || maskLayers.isEmpty()) {
            return Promise.resolve();
        }
       
        var shapeLayer = shapeLayers.first(),
            maskLayer = maskLayers.first(),
            shapeLayerRef = layerLib.referenceBy.id(shapeLayer.id);

        var options = {
            paintOptions: {
                immediateUpdate: true,
                quality: "draft"
            },
            historyStateInfo: {
                name: nls.localize("strings.ACTIONS.ADD_VECTOR_MASK"),
                target: documentLib.referenceBy.id(currentDocument.id)
            }
        },
            playObjects = [layerLib.select(shapeLayerRef),
                vectorMaskLib.createMaskFromShape(maskLayer.id)],
            deleteShapeLayer = currentDocument.layers.all.some(function (layer) {
                    return !layer.isGroupEnd && !layer.isGroup && layer.id !== shapeLayer.id;
                });

        if (deleteShapeLayer) {
            playObjects.push(layerLib.delete(shapeLayerRef));
        }
        
        var playPromise = descriptor.batchPlayObjects(playObjects, options),
            historyPromise = this.transfer(historyActions.newHistoryState, currentDocument.id,
                nls.localize("strings.ACTIONS.ADD_VECTOR_MASK"));

        return Promise.join(historyPromise, playPromise)
            .bind(this)
            .then(function () {
                return this.transfer(layerActions.resetLayers, currentDocument, maskLayer);
            })
            .then(function () {
                if (deleteShapeLayer) {
                    var payload = {
                        documentID: currentDocument.id,
                        layerIDs: Immutable.List.of(shapeLayer.id)
                    };
                    
                    this.dispatch(events.document.history.DELETE_LAYERS, payload);
                }
            });
    };
    createVectorMaskFromShape.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [layerActions.resetLayers, layerActions.removeLayers, historyActions.newHistoryState]
    };

    exports.editVectorMask = editVectorMask;
    exports.selectVectorMask = selectVectorMask;
    exports.deleteVectorMask = deleteVectorMask;
    exports.handleDeleteVectorMask = handleDeleteVectorMask;
    exports.handleEscapeVectorMask = handleEscapeVectorMask;
    exports.applyEllipse = applyEllipse;
    exports.applyRectangle = applyRectangle;
    exports.createVectorMaskFromShape = createVectorMaskFromShape;
});
