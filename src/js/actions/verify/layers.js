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
        documentLib = require("adapter").lib.document,
        layerLib = require("adapter").lib.layer;

    var locks = require("js/locks"),
        documentActions = require("../documents"),
        layerActions = require("../layers");

    /**
     * Verify the correctness of the list of layer IDs.
     *
     * @return {Promise} Rejects if the number or order of layer IDs in the
     *  active document differs from Photoshop.
     */
    var verifyLayerIndex = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        return layerActions.getLayerIDsForDocumentID(currentDocument.id)
            .bind(this)
            .then(function (payload) {
                var layerIDs = payload.layerIDs;

                if (currentDocument.layers.all.size !== layerIDs.length) {
                    throw new Error("Incorrect layer count: " + currentDocument.layers.all.size +
                        " instead of " + layerIDs.length);
                } else {
                    layerIDs.reverse();
                    currentDocument.layers.index.forEach(function (layerID, index) {
                        if (layerID !== layerIDs[index]) {
                            throw new Error("Incorrect layer ID at index " + index + ": " + layerID +
                                " instead of " + layerIDs[index]);
                        }
                    });
                }
            });
    };
    verifyLayerIndex.action = {
        reads: [locks.JS_APP, locks.JS_DOC, locks.PS_DOC],
        writes: []
    };

    /**
     * Verify the correctness of the layer selection.
     *
     * @return {Promise} Rejects if set of selected layer IDs differs from
     *  Photoshop.
     */
    var verifyLayerSelection = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }
        
        var documentRef = documentLib.referenceBy.current;
        return documentActions._getDocumentByRef(documentRef, ["targetLayers"], [])
            .bind(this)
            .then(function (payload) {
                var targetLayers = payload.targetLayers.map(function (targetLayer) {
                    return targetLayer._index;
                });

                if (currentDocument.layers.selected.size !== targetLayers.length) {
                    throw new Error("Incorrect selected layer count: " + currentDocument.layers.selected.size +
                        " instead of " + targetLayers.length);
                } else {
                    targetLayers.forEach(function (targetLayerIndex) {
                        var layer = currentDocument.layers.byIndex(targetLayerIndex + 1);
                        if (!layer.selected) {
                            throw new Error("Missing layer selection at index " + targetLayerIndex);
                        }
                    });
                }
            }, function () {
                if (currentDocument.layers.selected.size > 0) {
                    throw new Error("Incorrect selected layer count: " + currentDocument.layers.selected.size +
                        " instead of " + 0);
                }
            });
    };
    verifyLayerSelection.action = {
        reads: [locks.JS_APP, locks.JS_DOC, locks.PS_DOC],
        writes: []
    };

    /**
     * Verify the bounds of the selected layers and their descendants.
     *
     * @return {Promise}
     */
    var verifySelectedBounds = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }
        
        var docRef = documentLib.referenceBy.current,
            layers = currentDocument.layers.allSelected.toList(),
            propertyRefs = layers
                .map(function (layer) {
                    var property = layerActions._boundsPropertyForLayer(layer);

                    return [
                        docRef,
                        layerLib.referenceBy.id(layer.id),
                        {
                            _ref: "property",
                            _property: property
                        }
                    ];
                })
                .toArray();

        return descriptor.batchGet(propertyRefs)
            .bind(this)
            .then(function (results) {
                if (results.length !== propertyRefs.length) {
                    throw new Error("Incorrect bounds count: " + propertyRefs.length + " instead of " + results.length);
                }

                results = results.map(function (descriptor, index) {
                    var layer = layers.get(index);

                    return {
                        layerID: layer.id,
                        descriptor: descriptor
                    };
                });

                var currentDocument = applicationStore.getCurrentDocument(),
                    currentLayers = currentDocument.layers,
                    nextLayers = currentLayers.resetBounds(results);

                if (!Immutable.is(currentLayers, nextLayers)) {
                    throw new Error("Bounds mismatch");
                }
            });
    };
    verifySelectedBounds.action = {
        reads: [locks.JS_APP, locks.JS_DOC, locks.PS_DOC],
        writes: []
    };

    exports.verifyLayerIndex = verifyLayerIndex;
    exports.verifyLayerSelection = verifyLayerSelection;
    exports.verifySelectedBounds = verifySelectedBounds;
});
