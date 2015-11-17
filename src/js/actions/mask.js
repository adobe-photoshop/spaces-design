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

    var Promise = require("bluebird");

    var layerActions = require("./layers"),
        menuActions = require("./menu"),
        toolActions = require("./tools"),
        locks = require("../locks");

    var descriptor = require("adapter/ps/descriptor"),
        boundsLib = require("adapter/lib/bounds"),
        vectorMaskLib = require("adapter/lib/vectorMask");

    var _CLEAR_PATH = 106;

    /**
     * Handle escaping from vector mask for the selection based vector mask tools
     * most tools can just call toolActions.changeVectorMaskMode directly
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
            return this.transfer(toolActions.changeVectorMaskMode, false);
        }

        var currentLayers = currentDocument.layers.selected;

        if (currentLayers.isEmpty()) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.first();

        return this.transfer(layerActions.resetLayers, currentDocument, currentLayer)
            .bind(this)
            .then(function () {
                currentDocument = appStore.getCurrentDocument();
                currentLayer = currentDocument.layers.selected.first();
                if (currentLayer && currentLayer.vectorMaskEmpty) {
                    return this.transfer(toolActions.changeVectorMaskMode, false);
                } else {
                    return this.transfer(toolActions.select, toolStore.getToolByID("newSelect"));
                }
            });
    };
    handleEscapeVectorMask.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: [layerActions.resetLayers, toolActions.changeVectorMaskMode, toolActions.select],
        modal: true
    };

    /**
     * Handle deleting vector mask for all of the vector mask mode tools
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
            return this.transfer(layerActions.deleteVectorMask)
                .bind(this)
                .then(function () {
                    return this.transfer(toolActions.changeVectorMaskMode, false);
                });
        }

        var currentLayer = currentDocument.layers.selected.first();

        return this.transfer(layerActions.resetLayers, currentDocument, currentLayer)
            .bind(this)
            .then(function () {
                currentDocument = appStore.getCurrentDocument();
                currentLayer = currentDocument.layers.selected.first();
                
                if (currentLayer && !currentLayer.vectorMaskEmpty) {
                    var payload = { commandID: _CLEAR_PATH, waitForCompletion: true };
                    return this.transfer(menuActions.native, payload)
                        .bind(this)
                        .then(function () {
                            return this.transfer(layerActions.resetLayers, currentDocument, currentLayer);
                        })
                        .then(function () {
                            currentDocument = appStore.getCurrentDocument();
                            currentLayer = currentDocument.layers.selected.first();
                            if (currentLayer && !currentLayer.vectorMaskEnabled) {
                                return this.transfer(layerActions.deleteVectorMask)
                                    .bind(this)
                                    .then(function () {
                                        return this.transfer(toolActions.changeVectorMaskMode, false);
                                    });
                            }
                        });
                } else {
                    return this.transfer(layerActions.deleteVectorMask)
                        .bind(this)
                        .then(function () {
                            this.transfer(toolActions.changeVectorMaskMode, false);
                        });
                }
            });
    };
    handleDeleteVectorMask.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: [layerActions.resetLayers, layerActions.deleteVectorMask, toolActions.changeVectorMaskMode,
            menuActions.native]
    };

    /**
     * Create an circular mask the size of the currently selected layer
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
            bounds = boundsLib.bounds(currentLayer.bounds),
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.ADD_VECTOR_MASK,
                    target: documentLib.referenceBy.id(document.id),
                    coalesce: true,
                    suppressHistoryStateNotification: true
                }
            }


        return descriptor.batchPlayObjects([vectorMaskLib.deleteVectorMask(),
            vectorMaskLib.makeBoundsWorkPath(bounds),
            vectorMaskLib.makeVectorMaskFromWorkPath(),
            vectorMaskLib.deleteWorkPath()], options)
            .bind(this)
            .then(function () {
                return this.transfer(toolActions.select, toolStore.getToolByID("newSelect"));
            });
    };
    applyRectangle.reads = [locks.JS_APP, locks.JS_DOC];
    applyRectangle.writes = [locks.PS_DOC];
    applyRectangle.transfers = [toolActions.select];

    /**
     * Create an circular mask the size of the currently selected layer
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
                    name: strings.ACTIONS.ADD_VECTOR_MASK,
                    target: documentLib.referenceBy.id(document.id),
                    coalesce: true,
                    suppressHistoryStateNotification: true
                }
            };
            
        return descriptor.batchPlayObjects([vectorMaskLib.deleteVectorMask(),
            vectorMaskLib.makeCircularBoundsWorkPath(bounds),
            vectorMaskLib.makeVectorMaskFromWorkPath(),
            vectorMaskLib.deleteWorkPath()], options)
            .bind(this)
            .then(function () {
                return this.transfer(toolActions.select, toolStore.getToolByID("newSelect"));
            });
    };
    applyEllipse.reads = [locks.JS_APP, locks.JS_DOC];
    applyEllipse.writes = [locks.PS_DOC];
    applyEllipse.transfers = [toolActions.select];

    exports.handleDeleteVectorMask = handleDeleteVectorMask;
    exports.handleEscapeVectorMask = handleEscapeVectorMask;
    exports.applyEllipse = applyEllipse;
    exports.applyRectangle = applyRectangle;
});
