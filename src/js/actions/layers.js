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

    var descriptor = require("adapter/ps/descriptor"),
        layerLib = require("adapter/lib/layer"),
        documentLib = require("adapter/lib/document"),
        Promise = require("bluebird");

    var events = require("../events"),
        log = require("../util/log"),
        locks = require("js/locks");
    
    /**
     * Selects the given layer with given modifiers
     *
     * @param {number} layerID ID of layer that the selection is based on
     * @param {string} modifier Way of modifying selection
     *  With possible values:
     *        - "select" - Changes selection to given layer
     *        - "addUpTo" - Adds all layers from current selection to given layer
     *        - "deselect" - Deselects the given layer
     *        - "add" - Adds the given layer to current selection
     * @returns {Promise}
     */
    var selectLayerCommand = function (layerID, modifier) {
        var payload = {
            layerID: layerID,
            modifier: modifier
        };

        this.dispatch(events.layers.SELECT_LAYER, payload);

        var layerRef = layerLib.referenceBy.id(layerID);
        var selectObj = layerLib.select(layerRef, 1, modifier);

        return descriptor.playObject(selectObj)
            .catch(function (err) {
                log.warn("Failed to select layer", layerID, err);
                this.dispatch(events.layers.SELECT_LAYER_FAILED);
                return initializeCommand.call(this);
            });
    };

    /**
     * Renames the given layer
     *
     * @param {number} layerID ID of layer that the selection is based on
     * @param {string} newName What to rename the layer
     * 
     * @returns {Promise}
     */
    var renameLayerCommand = function (layerID, newName) {
        var payload = {
            layerID: layerID,
            name: newName
        };

        this.dispatch(events.layers.RENAME_LAYER, payload);

        var layerRef = layerLib.referenceBy.id(layerID);
        var renameObj = layerLib.rename(layerRef, newName);

        return descriptor.playObject(renameObj)
            .catch(function (err) {
                log.warn("Failed to rename layer", layerID, err);
                this.dispatch(events.layers.RENAME_LAYER_FAILED);
                return initializeCommand.call(this);
            });
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
                return initializeCommand.call(this);
            });
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
                return initializeCommand.call(this);
            });
    };

    /**
     * Photoshop gives us layers in a flat array with hidden endGroup layers
     * This function parses that array into a tree where layer's children
     * are in a children object, and each layer also have a parent object pointing at their parent
     * 
     * @private
     *
     * @param {Array.<Object>} layerArray Array of layer objects, it should be in order of PS layer indices
     *
     * @returns {{children: Array.<Object>}} Root of the document with rest of the layers in a tree under children value
     */
    var _makeLayerTree = function (layerArray) {
        var root = {children: []},
            currentParent = root,
            depth = 0,
            layerKinds = this.flux.store("layer").layerKinds;

        layerArray.reverse();

        layerArray.forEach(function (layer) {
            layer.children = [];
            layer.parent = currentParent;
            layer.depth = depth;

            currentParent.children.push(layer);
        
            // If we're encountering a groupend layer, we go up a level
            if (layer.layerKind === layerKinds.GROUPEND) {
                // TODO: Assert to see if currentParent is root here, it should never be
                currentParent = currentParent.parent;
                depth--;
            } else if (layer.layerKind === layerKinds.GROUP) {
                currentParent = layer;
                depth++;
            }
        });

        return root;
    };

    /**
     * Gets all the layers in all open documents in Photoshop
     * parses them to individual layer trees
     * and puts them in a dictionary of document IDs, dispatching 
     * events.layers.LAYERS_UPDATED
     *
     * @return {Promise}
     */
    var initializeCommand = function () {
        var documentState = this.flux.store("document").getState();

        var allDocumentsLayers = {};
        var targetLayers = [];
        var allLayers = {};

        documentState.openDocuments.forEach(function (document) {
            var layerCount = document.numberOfLayers,
                startIndex = (document.hasBackgroundLayer ? 0 : 1);

            var layerGets = [];

            for (var i = startIndex; i <= layerCount; i++) {
                var layerReference = [
                    documentLib.referenceBy.id(document.documentID),
                    layerLib.referenceBy.index(i)
                ];

                layerGets.push(descriptor.get(layerReference));
            }

            if (documentState.selectedDocumentID === document.documentID) {
                if (document.targetLayers) {
                    targetLayers = document.targetLayers.map(function (layerRef) {
                        return layerRef.index;
                    });
                } else {
                    targetLayers = [];
                }
            }

            allDocumentsLayers[document.documentID.toString()] = Promise.all(layerGets);
        });

        return Promise.props(allDocumentsLayers).then(function (allLayerArrays) {
            //allLayerArrays has documentIDs on root, pointing at array of 
            // all the layers in those documents, we parse them into trees here
            Object.keys(allLayerArrays).map(function (documentID) {
                allLayers[documentID] = _makeLayerTree.call(this, allLayerArrays[documentID]);
            }.bind(this));
            var payload = {
                allLayers: allLayers,
                selectedLayerIndices: targetLayers
            };

            this.dispatch(events.layers.LAYERS_UPDATED, payload);
        }.bind(this));
    };

    var selectLayer = {
        command: selectLayerCommand,
        writes: locks.ALL_LOCKS
    };

    var initialize = {
        command: initializeCommand,
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

    exports.select = selectLayer;
    exports.initialize = initialize;
    exports.rename = rename;
    exports.deselectAll = deselectAll;
    exports.groupSelected = groupSelected;

});
