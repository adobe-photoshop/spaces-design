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

    var _ = require("lodash"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer");

    var events = require("../events"),
        log = require("../util/log"),
        locks = require("js/locks"),
        documentActions = require("./documents");
    
    /**
     * Selects the given layer with given modifiers
     *
     * @param {number} documentID Owner document ID
     * @param {number|Array.<number>} layerSpec Either an ID of single layer that
     *  the selection is based on, or an array of such layer IDs
     * @param {string} modifier Way of modifying the selection. Possible values
     *  are defined in `adapter/lib/layer.js` under `select.vals`
     *
     * @returns {Promise}
     */
    var selectLayerCommand = function (documentID, layerSpec, modifier) {
        if (!_.isArray(layerSpec)) {
            layerSpec = [layerSpec];
        }

        var payload = {
            documentID: documentID
        };

        // TODO: Dispatch optimistically here for the other modifiers, and
        // eventually remove SELECT_LAYERS_BY_INDEX.
        if (!modifier || modifier === "select") {
            payload.selectedIDs = layerSpec;
            this.dispatch(events.layers.SELECT_LAYERS_BY_ID, payload);
        }

        var layerRef = layerSpec.map(function (layerID) {
            return layerLib.referenceBy.id(layerID);
        });
        layerRef.unshift(documentLib.referenceBy.id(documentID));

        var selectObj = layerLib.select(layerRef, true, modifier);
        return descriptor.playObject(selectObj)
            .then(function () {
                if (modifier && modifier !== "select") {
                    descriptor.getProperty(documentLib.referenceBy.id(documentID), "targetLayers")
                        .then(function (targetLayers) {
                            payload.selectedIndices = _.pluck(targetLayers, "index");
                            this.dispatch(events.layers.SELECT_LAYERS_BY_INDEX, payload);
                        }.bind(this));
                }
            }.bind(this))
            .catch(function (err) {
                log.warn("Failed to select layers", layerSpec, err);
                this.dispatch(events.layers.SELECT_LAYER_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
    };

    /**
     * Renames the given layer
     *
     * @param {number} documentID Owner document ID
     * @param {number} layerID ID of layer that the selection is based on
     * @param {string} newName What to rename the layer
     * 
     * @returns {Promise}
     */
    var renameLayerCommand = function (documentID, layerID, newName) {
        var payload = {
            layerID: layerID,
            name: newName
        };

        this.dispatch(events.layers.RENAME_LAYER, payload);

        var layerRef = [
                documentLib.referenceBy.id(documentID),
                layerLib.referenceBy.id(layerID)
            ],
            renameObj = layerLib.rename(layerRef, newName);

        return descriptor.playObject(renameObj)
            .catch(function (err) {
                log.warn("Failed to rename layer", layerID, err);
                this.dispatch(events.layers.RENAME_LAYER_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
    };

    /**
     * Deselects all layers in the current image
     * 
     * FIXME: The descriptor below should be specific to the document ID
     * 
     * @param {number} documentID
     * @returns {Promise}
     */
    var deselectAllLayersCommand = function (documentID) {
        var payload = {
            documentID: documentID
        };

        this.dispatch(events.layers.DESELECT_ALL, payload);

        
        return descriptor.playObject(layerLib.deselectAll())
            .catch(function (err) {
                log.warn("Failed to deselect all layers", err);
                this.dispatch(events.layers.DESELECT_ALL_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
    };

    /**
     * Groups the currently active layers
     * 
     * FIXME: This method should be parametrized by document ID
     * 
     * @returns {Promise}
     */
    var groupSelectedLayersCommand = function () {
        this.dispatch(events.layers.GROUP_SELECTED);

        return descriptor.playObject(layerLib.groupSelected())
            .catch(function (err) {
                log.warn("Failed to group selected layers", err);
                this.dispatch(events.layers.GROUP_SELECTED_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
    };

    /**
     * Changes the visibility of layer
     *
     * @param {number} documentID Owner document ID
     * @param {number} layerID
     * @param {boolean} visible Whether to show or hide the layer

     * @returns {Promise}
     */
    var setVisibilityCommand = function (documentID, layerID, visible) {
        var payload = {
                id: layerID,
                visible: visible
            },
            command = visible ? layerLib.show : layerLib.hide,
            layerRef = [
                documentLib.referenceBy.id(documentID),
                layerLib.referenceBy.id(layerID)
            ];

        this.dispatch(events.layers.VISIBILITY_CHANGED, payload);

        return descriptor.playObject(command.apply(this, [layerRef]))
            .catch(function (err) {
                log.warn("Failed to hide/show layer", layerID, visible, err);
                this.dispatch(events.layers.VISIBILITY_CHANGE_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
    };

    /**
     * Changes the lock state of layer
     *
     * @param {number} documentID Owner document ID
     * @param {number} layerID
     * @param {boolean} locked Whether all properties of layer is to be locked
     *
     * @returns {Promise}
     */
    var setLockingCommand = function (documentID, layerID, locked) {
        var payload = {
                id: layerID,
                locked: locked
            },
            layerRef = [
                documentLib.referenceBy.id(documentID),
                layerLib.referenceBy.id(layerID)
            ];

        this.dispatch(events.layers.LOCK_CHANGED, payload);

        return descriptor.playObject(layerLib.setLocking(layerRef, locked))
            .catch(function (err) {
                log.warn("Failed to lock/unlock layer", layerID, locked, err);
                this.dispatch(events.layers.LOCK_CHANGE_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
    };

    var _getLayerIDsForDocument = function (doc) {
        var layerCount = doc.numberOfLayers,
            startIndex = (doc.hasBackgroundLayer ? 0 : 1),
            layerGets = _.range(layerCount, startIndex - 1, -1).map(function (i) {
                var layerReference = [
                    documentLib.referenceBy.id(doc.documentID),
                    layerLib.referenceBy.index(i)
                ];
                return descriptor.getProperty(layerReference, "layerID");
            });
        
        return Promise.all(layerGets);
    };

    /**
     * Moves the given layers to their given position
     * In Photoshop images, targetIndex 0 means bottom of the document, and will throw if
     * it is a background layer, targetIndex n, where n is the number of layers, means top of the 
     * document. Hidden endGroup layers also count in the index, and are used to tell between whether
     * to put next to the group, or inside the group as last element
     *
     * @throws if Target Index is invalid, or if targetIndex is the child of the selected layers
     *
     * @param {number} documentID Owner document ID
     * @param {number|Array.<number>} layerSpec Either an ID of single layer that
     *  the selection is based on, or an array of such layer IDs
     * @param {number} targetIndex Target index where to drop the layers
     *
     * @returns {Promise}
     **/
    var reorderLayersCommand = function (documentID, layerSpec, targetIndex) {
        if (!_.isArray(layerSpec)) {
            layerSpec = [layerSpec];
        }
        
        var payload = {
            documentID: documentID
        };

        var layerRef = layerSpec.map(function (layerID) {
            return layerLib.referenceBy.id(layerID);
        });
        layerRef.unshift(documentLib.referenceBy.id(documentID));

        var targetRef = layerLib.referenceBy.index(targetIndex);

        var reorderObj = layerLib.reorder(layerRef, targetRef);
        return descriptor.playObject(reorderObj)
            .bind(this)
            .then(function () {
                var docRef = documentLib.referenceBy.id(documentID);
                return descriptor.get(docRef)
                    .bind(this)
                    .then(function (doc) {
                        return _getLayerIDsForDocument(doc)
                            .then(function (layerIDs) {
                                payload.layerIDs = layerIDs;
                                this.dispatch(events.layers.REORDER_LAYERS, payload);
                            }.bind(this));
                    });
            })
            .catch(function (err) {
                log.warn("Failed to reorder layers", layerSpec, err);
                this.dispatch(events.layers.REORDER_LAYERS_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
    };

    var selectLayer = {
        command: selectLayerCommand,
        writes: locks.ALL_LOCKS
    };

    var rename = {
        command: renameLayerCommand,
        writes: locks.ALL_LOCKS
    };

    var deselectAll = {
        command: deselectAllLayersCommand,
        writes: locks.ALL_LOCKS
    };

    var groupSelected = {
        command: groupSelectedLayersCommand,
        writes: locks.ALL_LOCKS
    };

    var setVisibility = {
        command: setVisibilityCommand,
        writes: locks.ALL_LOCKS
    };

    var setLocking = {
        command: setLockingCommand,
        writes: locks.ALL_LOCKS
    };

    var reorderLayers = {
        command: reorderLayersCommand,
        writes: locks.ALL_LOCKS
    };

    exports.select = selectLayer;
    exports.rename = rename;
    exports.deselectAll = deselectAll;
    exports.groupSelected = groupSelected;
    exports.setVisibility = setVisibility;
    exports.setLocking = setLocking;
    exports.reorder = reorderLayers;
});
