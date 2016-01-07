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

    var descriptor = require("adapter").ps.descriptor,
        PS = require("adapter").ps,
        UI = require("adapter").ps.ui,
        OS = require("adapter").os,
        toolLib = require("adapter").lib.tool,
        vectorMaskLib = require("adapter").lib.vectorMask;

    var layerActions = require("js/actions/layers"),
        policy = require("js/actions/policy"),
        PolicyStore = require("js/stores/policy"),
        locks = require("js/locks"),
        events = require("js/events");

    /**
     * Handler for mouseDown events
     */
    var _mouseDownHandler;

    /**
     * @private
     */
    var select = function () {
        var toolOptions = {
            "$AtSl": false, // Don't auto select on drag
            "$ASGr": false, // Don't auto select Groups,
            "$Abbx": true // Show transform controls
        };

        var toolStore = this.flux.store("tool"),
            applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            vectorMode = toolStore.getVectorMode(),
            vectorUnlinked = toolStore.getVectorUnlinkedMode();

        _mouseDownHandler = function (event) {
            if (event.clickCount === 2) {
                this.flux.actions.tool.superselect.doubleclick();
            }
        }.bind(this);
        OS.addListener("externalMouseDown", _mouseDownHandler);

        if (!vectorMode || !currentDocument || vectorUnlinked) {
            return descriptor.playObject(toolLib.setToolOptions("moveTool", toolOptions))
                .bind(this)
                .then(function () {
                    return this.transfer(policy.setMode, PolicyStore.eventKind.POINTER,
                        UI.pointerPropagationMode.PROPAGATE_BY_ALPHA_AND_NOTIFY);
                });
        } else {
            var currentLayers = currentDocument.layers.selected;

            if (currentLayers.isEmpty()) {
                return Promise.resolve();
            }

            var currentLayer = currentLayers.first();

            if (currentLayer.vectorMaskEnabled) {
                return this.transfer(layerActions.resetLayers, currentDocument, currentLayer)
                    .bind(this)
                    .then(function () {
                        currentLayer = applicationStore.getCurrentDocument().layers.selected.first();
                        if (!currentLayer.vectorMaskEmpty) {
                            return descriptor.playObject(vectorMaskLib.activateVectorMaskEditing())
                                .bind(this)
                                .then(function () {
                                    // We are not transferring here
                                    // because we actively want to end the use of our locks
                                    this.flux.actions.tools.enterPathModalState();
                                    return Promise.resolve();
                                });
                        }
                    });
            } else {
                return Promise.resolve();
            }
        }
    };
    select.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: ["policy.setMode", "layers.resetLayers"],
        modal: true
    };

    /**
     * @private
     */
    var deselect = function () {
        OS.removeListener("externalMouseDown", _mouseDownHandler);
        _mouseDownHandler = null;

        return this.transfer(policy.setMode, PolicyStore.eventKind.POINTER,
            UI.pointerPropagationMode.PROPAGATE_BY_ALPHA);
    };
    deselect.action = {
        reads: [],
        writes: [],
        transfers: ["policy.setMode"],
        modal: true
    };

    /**
    * switch to vector tool, while linking the vector mask from the layer.  
    *
    * @return {Promise}
    */
    var doubleclick = function () {
        var flux = this.flux,
            toolStore = flux.store("tool"),
            vectorMaskMode = toolStore.getVectorMode(),
            appStore = flux.store("application"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        var currentLayers = currentDocument.layers.selected,
            currentLayer = currentLayers.first();

        // vector mask mode requires an active layer
        if (!currentLayer || !vectorMaskMode) {
            return Promise.resolve();
        } else {
            return PS.endModalToolState(true)
                .bind(this)
                .then(function () {
                    return descriptor.playObject(vectorMaskLib.setVectorMaskLinked(true))
                })
                .then(function () {
                    return this.dispatchAsync(events.tool.VECTOR_MASK_UNLINK_CHANGE, false);
                })
                .then(function () {
                    return this.transfer("tools.select", toolStore.getToolByID("superselectVector"));
                })
                .then(function () {
                    currentLayer = appStore.getCurrentDocument().layers.selected.first();
                    if (!currentLayer.vectorMaskEmpty) {
                        return descriptor.playObject(vectorMaskLib.activateVectorMaskEditing())
                            .bind(this)
                            .then(function () {
                                // We are not transferring here
                                // because we actively want to end the use of our locks
                                this.flux.actions.tools.enterPathModalState();
                                return Promise.resolve();
                            });
                    }
                });
        }
    };
    doubleclick.action = {
        reads: [locks.JS_APP],
        writes: [locks.PS_APP],
        transfers: ["tools.select"]
    };

    exports.doubleclick = doubleclick;
    exports.select = select;
    exports.deselect = deselect;
});
