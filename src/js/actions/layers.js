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
        layer = require("adapter/lib/layer"),
        events = require("../events"),
        log = require("../util/log");

    var Promise = require("bluebird");

    var locks = require("js/locks");
        
    /**
     * Selects the given layer with given modifiers
     *
     * @param {Object} layer Key value pair to describe the layer
     *    Possible keys are:
     *        - id {number}
     *        - index {number}
     *        - mame {string}
     *  Default behavior will target current layer
     * @param {string} modifier Way of modifying selection
     *  With possible values:
     *        - "select" - Changes selection to given layer
     *        - "addUpTo" - Adds all layers from current selection to given layer
     *        - "deselect" - Deselects the given layer
     *        - "add" - Adds the given layer to current selection
     */
    var selectLayerCommand = function (layer, modifier) {
        var layerRef = layer.id ? layer.referenceBy.id(layer.id) :
                       layer.index ? layer.referenceBy.index(layer.index) :
                       layer.name ? layer.referenceBy.name(layer.name) :
                       layer.referenceBy.current;

        var payload = {
            layer: layer,
            modifier: modifier
        };

        this.dispatch(events.layers.SELECT_LAYER, payload);
        var selectObj = layer.select(layerRef, 1, modifier);

        return descriptor.playObject(selectObj)
            .catch(function (err) {
                log.warn("Failed to select layer", layer, err);
                this.dispatch(events.layers.SELECT_LAYER_FAILED);
                return initializeCommand();
            });
    };

    /**
     * Maps the layer kinds to their values in Photoshop
     */
    var layerKinds = {
        "any": 0,
        "pixel": 1,
        "adjustment": 2,
        "text": 3,
        "vector": 4,
        "smartobject": 5,
        "video": 6,
        "group": 7,
        "3d": 8,
        "gradient": 9,
        "pattern": 10,
        "solidcolor": 11,
        "background": 12,
        "groupend": 13
    };

    /**
     * Photoshop gives us layers in a flat array with hidden endGroup layers
     * This function parses that array into a tree where layer's children
     * are in a children object, and each layer also have a parent object pointing at their parent
     * 
     * @param {Array.<Object>} layerArray Array of layer objects, it should be in order of PS layer indices
     *
     * @returns {{children: Array.<Object>}} Root of the document with rest of the layers in a tree under children value
     */
    var _makeLayerTree = function (layerArray) {
        var root = {children: []},
            currentParent = root;

        layerArray.reverse();

        layerArray.forEach(function (layer) {
            layer.children = [];
            layer.parent = currentParent;

            currentParent.children.push(layer);
            layer.parent = currentParent;

            // If we're encountering a groupend layer, we go up a level
            if (layer.layerKind === layerKinds.groupend) {
                // TODO: ASsert to see if currentParent is root here, it should never be
                currentParent = currentParent.parent;
            } else if (layer.layerKind === layerKinds.group) {
                currentParent = layer;
            }
        });

        return root;
    };

    /**
     * Gets the current layer list from Photoshop, parses it into a tree and dispatches it
     * alongside current selected layer indices
     *
     * @return {Promise}
     */
    var initializeCommand = function () {
        return descriptor.getProperty("document", "numberOfLayers").then(function (layerCount) {
            return descriptor.getProperty("document", "hasBackgroundLayer").then(function (hasBackground) {
                var layerGets = [];
                var startIndex = hasBackground ? 0 : 1;

                for (var i = startIndex; i <= layerCount; i++) {
                    layerGets.push(descriptor.get(layer.referenceBy.index(i)));
                }

                var allLayersPromise = Promise.all(layerGets),
                    currentLayerPromise = descriptor.getProperty("document", "targetLayers");

                return Promise.join(allLayersPromise, currentLayerPromise,
                    function (layers, selectedLayerRefs) {
                        var layerTree = _makeLayerTree(layers),
                            selectedLayerIndices = selectedLayerRefs.map(function (layerRef) {
                                return layerRef.index;
                            });

                        var payload = {
                            layerTree: layerTree,
                            selectedLayers: selectedLayerIndices
                        };

                        this.dispatch(events.layers.LAYERS_UPDATED, payload);
                    }.bind(this));
            }.bind(this));
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

    exports.select = selectLayer;
    exports.initialize = initialize;

    exports.layerKinds = layerKinds;

});
