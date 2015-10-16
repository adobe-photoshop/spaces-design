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

    var _CLEAR_PATH = 106;

    /**
     * Handle deleting vector mask for all of the vector mask mode tools
     *
     * @return {Promise}
     */
    var handleDeleteVectorMask = function () {
        var appStore = this.flux.store("application"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
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

    handleDeleteVectorMask.reads = [locks.JS_APP, locks.JS_DOC];
    handleDeleteVectorMask.writes = [];
    handleDeleteVectorMask.transfers = [layerActions.resetLayers,layerActions.deleteVectorMask,
        toolActions.changeVectorMaskMode, menuActions.native];

    exports.handleDeleteVectorMask = handleDeleteVectorMask;
});
