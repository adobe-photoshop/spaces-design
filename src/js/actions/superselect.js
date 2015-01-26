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

    var Promise = require("bluebird"),
        Immutable = require("immutable");

    var descriptor = require("adapter/ps/descriptor"),
        system = require("js/util/system"),
        adapterOS = require("adapter/os"),
        hitTestLib = require("adapter/lib/hitTest");

    var keyUtil = require("js/util/key"),
        locks = require("js/locks"),
        layerActions = require("./layers"),
        documentActions = require("./documents"),
        toolActions = require("./tools"),
        collection = require("js/util/collection");

    /**
     * Returns all leaf layers we can directly dive into
     * 
     * @private
     * @param  {LayerStructure} layerTree
     * @return {Immutable.Iterable.<Layer>}
     */
    var _getDiveableLayers = function (layerTree) {
        return layerTree.selected
            .map(layerTree.children, layerTree) // Grab their children
            .flatten(true) // Flatten all children to one array
            .filter(function (layer) { // Only allow for unlocked layers
                return !layer.locked && layer.kind !== layer.layerKinds.GROUPEND;
            });
    };

    /**
     * Helper for backOut function
     * Gets all parents of selected layers
     * 
     * @param  {LayerStructure} layerTree
     * @param  {boolean} noDeselect Does not deselect root layers
     * @return {Immutable.Iterable.<Layer>} Parent layers of all selected layers
     */
    var _getSelectedLayerParents = function (layerTree, noDeselect) {
        return Immutable.List(layerTree.selected
            .reduce(function (parents, layer) {
                var parent = layerTree.parent(layer);
                // Don't get rid of root layers if noDeselect is passed
                if (noDeselect && !parent) {
                    return parents.add(layer);
                } else if (parent) {
                    return parents.add(parent);
                }

                return parents;
            }, new Set()));
    };

    /**
     * For every selected layer, returns the next sibling in it's group
     * For now, we only return one sibling
     *
     * @private
     * @param  {LayerStructure} layerTree
     * @return {Immutable.Iterable.<Layer>}
     */
    var _getNextSiblingsForSelectedLayers = function (layerTree) {
        if (layerTree.all.isEmpty()) {
            return Immutable.List();
        }

        var selectedLayers = layerTree.selected;

        if (selectedLayers.isEmpty()) {
            selectedLayers = layerTree.top;
        }

        // Should we want to return next sibling of all selected layers, delete this line
        selectedLayers = selectedLayers.take(1);
        
        return selectedLayers.map(function (layer) {
            var siblings = layerTree.siblings(layer)
                .filter(function (layer) {
                    return layer.kind !== layer.layerKinds.GROUPEND && !layer.locked;
                });

            var layerIndex = siblings.indexOf(layer),
                nextIndex = (layerIndex + 1) % siblings.size;

            return siblings.get(nextIndex);
        });
    };

    /**
     * Asynchronously get the basic list of hit layer IDs.
     *
     * @param {number} x Horizontal coordinate
     * @param {number} y Vertical coordinate
     * @return {Promise.<Array.<number>>}
     */
    var _getHitLayerIDs = function (x, y) {
        var hitPlayObj = hitTestLib.layerIDsAtPoint(x, y);

        return descriptor.playObject(hitPlayObj)
            .get("layersHit")
            .then(function (ids) {
                return Immutable.List(ids);
            }, function () {
                return Immutable.List();
            });
    };

    /**
     * Get all the layers and layer groups underneath x,y, including layer groups
     * 
     * This would only work with rectangular layers because bounds are boxes
     * @private
     * @param  {LayerStructure} layerTree
     * @param  {number} x
     * @param  {number} y
     * @return {Immutable.Set.<Layer>} All bounding boxes of layers/groups under the point
     */
    var _getContainingLayerBounds = function (layerTree, x, y) {
        return Immutable.Set(layerTree.all.reduce(function (layerSet, layer) {
            var bounds = layerTree.childBounds(layer);

            if (bounds && bounds.contains(x, y)) {
                layerSet.add(layer);
            }

            return layerSet;
        }, new Set()));
    };

    /**
     * Gets the non group layers that have one of the passed in IDs
     * 
     * @param  {LayerStructure} layerTree
     * @param  {Object.<{number: boolean}>} layerMap       
     * @return {Immutable.Iterable.<Layer>}
     */
    var _getLeafLayersWithID = function (layerTree, layerMap) {
        return layerTree.leaves.filter(function (layer) {
            return layerMap.hasOwnProperty(layer.id);
        });
    };

    /**
     * Checks to see if the layer is the only selected layer
     *
     * @private
     * @param {LayerStructure} layerTree
     * @param {Layer} layer
     * @return {boolean}
     */
    var _isOnlySelectedLayer = function (layerTree, layer) {
        var selected = layerTree.selected;
        if (selected.size !== 1) {
            return false;
        }

        return Immutable.is(selected.first(), layer);
    };

    /**
     * Filters out selected layers and families from the covered layers
     * 
     * @private
     * @param {LayerStructure} layerTree
     * @param {Immutable.Iterable.<Layer>} coveredLayers Layers under a certain point
     * @return {Immutable.Iterable.<number>} IDs of the subset of coveredLayers that do not own selected layers
     */
    var _getLayersBelowCurrentSelection = function (layerTree, coveredLayers) {
        var selectedLayerAncestors = layerTree.selected
                .reduce(function (layerSet, layer) {
                    layerTree.ancestors(layer).forEach(function (ancestor) {
                        layerSet.add(ancestor);
                    });
                    return layerSet;
                }, new Set()),
            selectableCoveredLayers = coveredLayers.filter(function (layer) {
                return !layer.locked && // Only allow for unlocked layers
                    layer.kind !== layer.layerKinds.GROUPEND &&
                    !selectedLayerAncestors.has(layer);
            });

        return collection.pluck(selectableCoveredLayers, "id");
    };

    /**
     * Enters the edit mode for the given layer
     * No-op if there is no special edit mode
     * 
     * @param {Document} document Active documentID
     * @param {Layer} layer layer to edit
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise} 
     */
    var _editLayer = function (document, layer, x, y) {
        // We don't want to do anything on background layer
        if (layer.isBackground) {
            return Promise.resolve();
        }
        
        var kinds = layer.layerKinds,
            tool;

        // If _editLayer is called through keyboard, we calculate the center of the layer
        // This will not work if the layer is concave, as we can't click on an empty pixel
        if (!x || !y) {
            var bounds = layer.bounds;
            if (!bounds) {
                return Promise.resolve();
            }

            x = (bounds.right + bounds.left) / 2;
            y = (bounds.top + bounds.bottom) / 2;

            var windowCoords = this.flux.store("ui").transformCanvasToWindow(x, y);
            x = windowCoords.x;
            y = windowCoords.y;
        }

        var resultPromise;

        switch (layer.kind) {
        case kinds.VECTOR:
            tool = this.flux.store("tool").getToolByID("superselectVector");
        
            resultPromise = this.transfer(toolActions.select, tool)
                .bind(this)
                .then(function () {
                    var eventKind = adapterOS.eventKind.LEFT_MOUSE_DOWN,
                        coordinates = [x, y];
                        
                    return adapterOS.postEvent({eventKind: eventKind, location: coordinates});
                });
            break;
        case kinds.TEXT:
            tool = this.flux.store("tool").getToolByID("superselectType");
            
            resultPromise = this.transfer(toolActions.select, tool)
                .bind(this)
                .then(function () {
                    var eventKind = adapterOS.eventKind.LEFT_MOUSE_DOWN,
                        coordinates = [x, y];
                        
                    return adapterOS.postEvent({eventKind: eventKind, location: coordinates});
                });
            break;
        default:
            resultPromise = Promise.resolve();
        }

        return resultPromise;
    };
    
    /**
     * Process a single click from the SuperSelect tool. First determines a set of
     * layers to select, then transfers control to actions.layers.select or
     * actions.layers.deselect.
     * 
     * @private
     * @param {Document} doc Document model
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @param {boolean} deep Whether to choose all layers or not
     * @param {boolean} add Whether to add/remove layer to selection
     * @return {Promise.<boolean>} True if any layers are selected after this command, used for dragging
     */
    var clickCommand = function (doc, x, y, deep, add) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerTree = doc.layers;

        return _getHitLayerIDs(coords.x, coords.y)
            .bind(this)
            .then(function (hitLayerIDs) {
                var clickedSelectableLayerIDs;

                if (deep) {
                    // Select any non-group layer
                    var hitLayerMap = hitLayerIDs.reduce(function (layerMap, id) {
                            layerMap[id] = true;
                            return layerMap;
                        }, {}),
                        clickedSelectableLayers = _getLeafLayersWithID(layerTree, hitLayerMap);

                    clickedSelectableLayerIDs = collection.pluck(clickedSelectableLayers, "id");
                } else {
                    var coveredLayers = _getContainingLayerBounds(layerTree, coords.x, coords.y),
                        selectableLayers = layerTree.selectable,
                        clickableLayers = collection.intersection(selectableLayers, coveredLayers),
                        clickableLayerIDs = collection.pluck(clickableLayers, "id");
                    
                    clickedSelectableLayerIDs = collection.intersection(hitLayerIDs, clickableLayerIDs);
                }
                
                if (!clickedSelectableLayerIDs.isEmpty()) {
                    // due to way hitTest works, the top z-order layer is the last one in the list
                    var topLayerID = clickedSelectableLayerIDs.last(),
                        topLayer = layerTree.byID(topLayerID),
                        modifier = "select";

                    if (add && topLayer.selected) {
                        // If we hold shift, and this is the only layer selected, we deselect all
                        if (_isOnlySelectedLayer(layerTree, topLayer)) {
                            return this.transfer(layerActions.deselectAll, doc)
                                .catch(function () {})
                                .return(false);
                        }
                        modifier = "deselect";
                    } else if (add) {
                        modifier = "add";
                    }

                    // If our single click is going to be a no-op, just prevent firing it at all
                    if (modifier === "select" && topLayer.selected) {
                        return Promise.resolve(true);
                    }

                    return this.transfer(layerActions.select, doc, topLayer, modifier)
                        .return(true);
                } else if (!doc.layers.selected.isEmpty()) {
                    return this.transfer(layerActions.deselectAll, doc)
                        .return(false);
                } else {
                    return Promise.resolve(false);
                }
            });
    };

    /**
     * Process a double click
     * Double click dives into the next level of the selected group, selecting the layer under the click
     * NOTE: Double Click relies on the fact that single click was ran before hand
     * 
     * @private
     * @param {Document} doc Document model
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise}
     */
    var doubleClickCommand = function (doc, x, y) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerTree = doc.layers;

        return _getHitLayerIDs(coords.x, coords.y)
            .bind(this)
            .then(function (hitLayerIDs) {
                // Child layers of selected layers
                var selectableLayers = _getDiveableLayers(layerTree);

                // If this is empty, we're probably trying to dive into an edit mode
                if (selectableLayers.isEmpty()) {
                    var selectedLayers = layerTree.selected,
                        clickedLayer = selectedLayers.find(function (layer) {
                            return hitLayerIDs.contains(layer.id);
                        });

                    if (clickedLayer) {
                        return this.transfer(layerActions.select, doc, clickedLayer)
                            .then(function () {
                                return _editLayer.call(this, doc, clickedLayer, x, y);
                            });
                    } else {
                        return Promise.resolve();
                    }
                }
                    
                // Layers/Groups under the mouse
                var coveredLayers = _getContainingLayerBounds(layerTree, coords.x, coords.y);
                // Valid children of selected under the mouse 
                var diveableLayers = collection.intersection(selectableLayers, coveredLayers);
                // Grab their ids...
                var diveableLayerIDs = collection.pluck(diveableLayers, "id");
                // Find the ones user actually clicked on
                var targetLayerIDs = collection.intersection(hitLayerIDs, diveableLayerIDs);
                // Get the top z-order one
                var topTargetID = targetLayerIDs.last();

                if (!targetLayerIDs.isEmpty()) {
                    return this.transfer(layerActions.select, doc, layerTree.byID(topTargetID));
                } else {
                    // We get in this situation if user double clicks in a group with nothing underneath.
                    // We "fall down" to the super selectable layer underneath the selection in these cases
                    var underLayerIDs = _getLayersBelowCurrentSelection(layerTree, coveredLayers);
                    if (!underLayerIDs.isEmpty()) {
                        var topLayerID = underLayerIDs.last();
                        return this.transfer(layerActions.select, doc, layerTree.byID(topLayerID));
                    } else {
                        return Promise.resolve();
                    }
                }
            });
    };

    /**
     * Backs out of the selected layers to their parents
     * 
     * @param {Document} doc
     * @param {boolean} noDeselect If true, top level layers will not be removed from selection
     * @return {Promise}
     */
    var backOutCommand = function (doc, noDeselect) {
        var layerTree = doc.layers,
            backOutParents = _getSelectedLayerParents(layerTree, noDeselect);

        if (!backOutParents.isEmpty()) {
            return this.transfer(layerActions.select, doc, backOutParents);
        } else if (!noDeselect) {
            return this.transfer(layerActions.deselectAll, doc).catch(function () {});
        } else {
            return Promise.resolve();
        }
    };

    /**
     * Skips to the next unlocked sibling layer of the first selected layer
     * 
     * @param {Document} doc
     * @return {Promise}
     */
    var nextSiblingCommand = function (doc) {
        var layerTree = doc.layers,
            nextSiblings = _getNextSiblingsForSelectedLayers(layerTree);

        return this.transfer(layerActions.select, doc, nextSiblings);
    };

    /**
     * Dives in one level to the selected layer, no op if it's not a group layer
     * 
     * @param {Document} doc
     * @return {Promise}
     */
    var diveInCommand = function (doc) {
        var layerTree = doc.layers,
            diveableLayers = _getDiveableLayers(layerTree);

        // If this is empty, we're probably trying to dive into an edit mode
        if (diveableLayers.isEmpty()) {
            var selectedLayers = layerTree.selected;

            // Only dive into edit mode when there is one layer
            if (selectedLayers.size === 1) {
                var topLayer = selectedLayers.get(0);
                
                return _editLayer.call(this, doc, topLayer);
            } else {
                return Promise.resolve();
            }
        } else {
            return this.transfer(layerActions.select, doc, diveableLayers.first());
        }
    };

    /**
     * Selects and starts dragging the layer around
     *
     * @param {Document} doc
     * @param {number} x Horizontal location of click
     * @param {number} y Vertical location of click
     * @param {{shift: boolean, control: boolean, alt: boolean, command: boolean}} modifiers Drag modifiers
     * @return {Promise}           
     */
    var dragCommand = function (doc, x, y, modifiers) {
        var eventKind = adapterOS.eventKind.LEFT_MOUSE_DOWN,
            coordinates = [x, y],
            dragModifiers = keyUtil.modifiersToBits(modifiers),
            diveIn = system.isMac ? modifiers.command : modifiers.control;

        return this.transfer(clickAction, doc, x, y, diveIn, modifiers.shift)
            .then(function (anySelected) {
                if (anySelected) {
                    // Add a temporary listener for move
                    descriptor.addListener("toolModalStateChanged", function (event) {
                        if (event.tool.value.title === "Move Tool" &&
                            event.state.value === "exit") {
                            descriptor.removeListener("toolModalStateChanged");
                            return this.transfer(layerActions.resetLayers, doc, doc.layers.allSelected);
                        }
                    }.bind(this));
                    return adapterOS.postEvent({eventKind: eventKind, location: coordinates, modifiers: dragModifiers});
                } else {
                    return Promise.resolve();
                }
            })
            .catch(function () {}); // Move fails if there are no selected layers, this prevents error from showing
    };

    /**
     * SuperSelect click action.
     * @type {Action}
     */
    var clickAction = {
        command: clickCommand,
        reads: [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * SuperSelect double click action
     * @type {Action}
     */
    var doubleClickAction = {
        command: doubleClickCommand,
        reads: locks.ALL_LOCKS,
        writes: locks.ALL_LOCKS
    };

    /**
     * SuperSelect backout action - escape key
     * @type {Action}
     */
    var backOutAction = {
        command: backOutCommand,
        reads: [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * SuperSelect next Sibling action - Tab key
     * @type {Action}
     */
    var nextSiblingAction = {
        command: nextSiblingCommand,
        reads: [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * Superselect dive in action - Enter key
     * @type {Action}
     */
    var diveInAction = {
        command: diveInCommand,
        reads: locks.ALL_LOCKS,
        writes: locks.ALL_LOCKS
    };

    /**
     * Superselect drag action
     * @type {Action}
     */
    var dragAction = {
        command: dragCommand,
        reads: [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    exports.click = clickAction;
    exports.doubleClick = doubleClickAction;
    exports.backOut = backOutAction;
    exports.nextSibling = nextSiblingAction;
    exports.diveIn = diveInAction;
    exports.drag = dragAction;
});
