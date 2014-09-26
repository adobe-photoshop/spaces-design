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
        locks = require("js/locks");
    
    /**
     * Selects the given layer with given modifiers
     *
     * @param {number} documentID Owner document ID
     * @param {number} layerID ID of layer that the selection is based on
     * @param {string} modifier Way of modifying selection
     * Possible values are defined in `adapter/lib/layer.js` under `select.vals`
     *
     * @returns {Promise}
     */
    var selectLayerCommand = function (documentID, layerID, modifier) {
        var layerRef = [
                documentLib.referenceBy.id(documentID),
                layerLib.referenceBy.id(layerID)
            ],
            selectObj = layerLib.select(layerRef, true, modifier),
            payload = {};

        return descriptor.playObject(selectObj)
            .then(function () {
                descriptor.getProperty(documentLib.referenceBy.id(documentID), "targetLayers")
                    .then(function (targetLayers) {
                        payload = {
                            documentID: documentID,
                            targetLayers: _.pluck(targetLayers, "index")
                        };
                        this.dispatch(events.layers.SELECT_LAYER, payload);
                    }.bind(this));
            }.bind(this))
            .catch(function (err) {
                log.warn("Failed to select layer", layerID, err);
                this.dispatch(events.layers.SELECT_LAYER_FAILED);
                this.flux.actions.documents.updateDocumentList();
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
                this.flux.actions.documents.updateDocumentList();
            }.bind(this));
    };

    /**
     * Deselects all layers in the current image
     * 
     * @returns {Promise}
     */
    var deselectAllLayersCommand = function () {
        this.dispatch(events.layers.DESELECT_ALL);

        return descriptor.playObject(layerLib.deselectAll())
            .catch(function (err) {
                log.warn("Failed to deselect all layers", err);
                this.dispatch(events.layers.DESELECT_ALL_FAILED);
                this.flux.actions.documents.updateDocumentList();
            }.bind(this));
    };

    /**
     * Groups the currently active layers
     * 
     * @returns {Promise}
     */
    var groupSelectedLayersCommand = function () {
        this.dispatch(events.layers.GROUP_SELECTED);

        return descriptor.playObject(layerLib.groupSelected())
            .catch(function (err) {
                log.warn("Failed to group selected layers", err);
                this.dispatch(events.layers.GROUP_SELECTED_FAILED);
                this.flux.actions.documents.updateDocumentList();
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
                this.flux.actions.documents.updateDocumentList();
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
                this.flux.actions.documents.updateDocumentList();
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

    exports.select = selectLayer;
    exports.rename = rename;
    exports.deselectAll = deselectAll;
    exports.groupSelected = groupSelected;
    exports.setVisibility = setVisibility;
    exports.setLocking = setLocking;
});
