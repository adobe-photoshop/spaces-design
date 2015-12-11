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

    var descriptor = require("adapter").ps.descriptor,
        boundsLib = require("adapter").lib.bounds,
        vectorMaskLib = require("adapter").lib.vectorMask,
        documentLib = require("adapter").lib.document;

    var locks = require("../locks"),
        events = require("../events"),
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

        var currentLayer = currentLayers.first(),
            bounds = boundsLib.bounds(currentDocument.layers.childBounds(currentLayer)),
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
        transfers: ["tools.select"]
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

        var currentLayer = currentLayers.first(),
            bounds = currentLayer.bounds,
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

        return layerActionsUtil.playSimpleLayerActions(currentDocument, layerList, createActions, true, options)
            .bind(this)
            .then(function () {
                return this.transfer("tools.select", toolStore.getToolByID("newSelect"));
            });
    };
    applyEllipse.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: ["tools.select"]
    };

    exports.editVectorMask = editVectorMask;
    exports.selectVectorMask = selectVectorMask;
    exports.deleteVectorMask = deleteVectorMask;
    exports.handleDeleteVectorMask = handleDeleteVectorMask;
    exports.handleEscapeVectorMask = handleEscapeVectorMask;
    exports.applyEllipse = applyEllipse;
    exports.applyRectangle = applyRectangle;
});
