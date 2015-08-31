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

    var documentActions = require("./documents"),
        layerActions = require("./layers"),
        locks = require("../locks"),
        log = require("js/util/log");

    /**
     * Handle the deleteTextLayer event for the type tool by removing the
     * client-side layer model.
     *
     * @param {object} event
     * @param {boolean} layersReplaced If true, completely reset the document
     *  instead of just deleting the referenced layer.
     * @return {Promise}
     */
    var handleDeletedLayer = function (event, layersReplaced) {
        var applicationStore = this.flux.store("application"),
            document = applicationStore.getCurrentDocument();

        if (!document) {
            throw new Error("Unexpected deleteTextLayer event: no active document");
        }

        if (layersReplaced) {
            return this.transfer(documentActions.updateDocument);
        } else {
            var layerID = event.layerID,
                layer = document.layers.byID(layerID);

            if (!layer) {
                log.warn("Unable to handle deleted text layer because it does not exist: " + layerID);
                return this.transfer(documentActions.updateDocument);
            }

            return this.transfer(layerActions.removeLayers, document, layer, true);
        }
    };
    handleDeletedLayer.modal = true;
    handleDeletedLayer.reads = [locks.JS_APP, locks.JS_DOC];
    handleDeletedLayer.writes = [];
    handleDeletedLayer.transfers = [layerActions.removeLayers, documentActions.updateDocument];
    

    /**
     * Handle the toolModalStateChanged event, when it indicates a type tool
     * cancelation, by resetting the selected layers.
     *
     * @return {Promise}
     */
    var handleTypeModalStateCanceled = function () {
        var application = this.flux.store("application"),
            document = application.getCurrentDocument();

        if (!document) {
            throw new Error("Unexpected toolModalStateChanged event: no active document");
        }

        return this.transfer(layerActions.resetLayers, document, document.layers.selected);
    };
    handleTypeModalStateCanceled.modal = true;
    handleTypeModalStateCanceled.reads = [locks.JS_APP, locks.JS_DOC];
    handleTypeModalStateCanceled.writes = [];
    handleTypeModalStateCanceled.transfers = [layerActions.resetLayers];

    exports.handleDeletedLayer = handleDeletedLayer;
    exports.handleTypeModalStateCanceled = handleTypeModalStateCanceled;
});
