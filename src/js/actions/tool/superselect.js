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
        UI = require("adapter").ps.ui,
        toolLib = require("adapter").lib.tool,
        vectorMaskLib = require("adapter").lib.vectorMask;

    var layerActions = require("js/actions/layers"),
        policy = require("js/actions/policy"),
        PolicyStore = require("js/stores/policy"),
        locks = require("js/locks");

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
            vectorMode = toolStore.getVectorMode();

        if (!vectorMode || !currentDocument) {
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
                                });
                        }
                    });
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
        return this.transfer(policy.setMode, PolicyStore.eventKind.POINTER,
            UI.pointerPropagationMode.PROPAGATE_BY_ALPHA);
    };
    deselect.action = {
        reads: [],
        writes: [],
        transfers: ["policy.setMode"],
        modal: true
    };

    exports.select = select;
    exports.deselect = deselect;
});
