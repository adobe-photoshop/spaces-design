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
        Promise = require("bluebird"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        documents = require("js/actions/documents"),
        layerLib = require("adapter/lib/layer");

    var events = require("../events"),
        log = require("../util/log"),
        locks = require("js/locks"),
        shortcuts = require("js/actions/shortcuts");
    
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
     * @param {number} documentID 
     * @return {Promise}
     */
    var groupSelectedLayersCommand = function (documentID) {
        var payload = {
            documentID: documentID
        };

        this.dispatch(events.layers.GROUP_SELECTED, payload);

        return descriptor.playObject(layerLib.groupSelected())
            .bind(this)
            .then(function () {
                // this should be removed once GROUP_SELECTED is correctly handled by the layer store
                return this.transfer(documents.updateDocument, documentID);
            })
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
     * @param {number} documentID Owner document ID
     * @param {number|Array.<number>} layerSpec Either an ID of single layer that
     *  the selection is based on, or an array of such layer IDs
     * @param {number} targetIndex Target index where to drop the layers
     *
     * @return {Promise} Resolves to the new ordered IDs of layers, or rejects if targetIndex
     * is invalid, as example when it is a child of one of the layers in layer spec
     **/
    var reorderLayersCommand = function (documentID, layerSpec, targetIndex) {
        if (!_.isArray(layerSpec)) {
            layerSpec = [layerSpec];
        }
        
        var payload = {
                documentID: documentID
            },
            documentRef = documentLib.referenceBy.id(documentID),
            layerRef = layerSpec.map(function (layerID) {
                return layerLib.referenceBy.id(layerID);
            });
        
        layerRef.unshift(documentRef);

        var targetRef = layerLib.referenceBy.index(targetIndex),
            reorderObj = layerLib.reorder(layerRef, targetRef);

        return descriptor.playObject(reorderObj)
            .bind(this)
            .then(function () {
                return descriptor.get(documentRef)
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

    /**
     * Register layer-related keyboard shortcuts.
     * 
     * @return {Promise}
     */
    var onStartupCommand = function () {
        var flux = this.flux,
            applicationStore = flux.store("application");

        // Group selected layers keyboard shortcut command
        var groupSelectedLayersInCurrentDocument = function () {
            var currentDocument = applicationStore.getCurrentDocument();

            if (!currentDocument) {
                return;
            }

            flux.actions.layers.groupSelected(currentDocument.id);
        };

        return this.transfer(shortcuts.addShortcut, "G", false, false, false, false,
            groupSelectedLayersInCurrentDocument);
    };

    var selectLayer = {
        command: selectLayerCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var rename = {
        command: renameLayerCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var deselectAll = {
        command: deselectAllLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var groupSelected = {
        command: groupSelectedLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setVisibility = {
        command: setVisibilityCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setLocking = {
        command: setLockingCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var reorderLayers = {
        command: reorderLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var onStartup = {
        command: onStartupCommand,
        reads: [],
        writes: [locks.PS_APP, locks.JS_APP]
    };

    exports.select = selectLayer;
    exports.rename = rename;
    exports.deselectAll = deselectAll;
    exports.groupSelected = groupSelected;
    exports.setVisibility = setVisibility;
    exports.setLocking = setLocking;
    exports.reorder = reorderLayers;
    exports.onStartup = onStartup;
});
