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
        OS = require("adapter/os");

    var descriptor = require("adapter/ps/descriptor"),
        hitTestLib = require("adapter/lib/hitTest"),
        locks = require("js/locks"),
        layerActions = require("./layers"),
        documentActions = require("./documents");


    /**
     * Helper function for super select single click
     * For one layer, adds all siblings of it's parents, all the way up the tree
     * 
     * @private
     * @param  {Layer} layer Starting layer
     * @param  {Array.<Layer>} selectableLayers Collection of selectable layers so far 
     * @param  {Object.<{number: Layer}>} visitedParents Already processed parents
     * @return {Array.<Layer>} Siblings of this layer
     */
    var _replaceAncestorWithSiblingsOf = function (layer, selectableLayers, visitedParents) {
        var layerAncestor = layer.parent;

        // If we were already at root, we don't need to do anything for this layer
        if (!layerAncestor) {
            return selectableLayers;
        }
        
        // Traverse up to root
        while (layerAncestor && !visitedParents.hasOwnProperty(layerAncestor.id)) {
            // Remove the current parent because we're already below it
            _.pull(selectableLayers, layerAncestor);

            // So we don't process this parent again
            visitedParents[layerAncestor.id] = layerAncestor;
            
            // Add the siblings of this layer to accepted layers
            selectableLayers = selectableLayers.concat(layerAncestor.children);
        
            layerAncestor = layerAncestor.parent;
        }

        return selectableLayers;
    };

    /**
     * Returns all selectable layers in the current selection state
     * Selectable means either a direct sibling of any of the selected layers
     * Or a first seen parent of an unrelated group
     * We achieve this by getting all root layers
     * Then for each selected layer, removing the root layer it belongs to and replacing it with the layer's siblings
     *
     * @private
     * @param {LayerTree} layerTree
     * @return {Array.<Layer>} All selectable layers given the current selection
     */
    var _getSelectableLayers = function (layerTree) {
        var layerArray = layerTree.layerArray,
            selectedLayers = _.where(_.rest(layerArray), {selected: true}),
            selectableLayers = _.clone(layerTree.topLayers),
            visitedParents = [];

        return _.chain(selectedLayers)
            .reduce(function (validLayers, layer) {
                return _replaceAncestorWithSiblingsOf(layer, validLayers, visitedParents);
            }, selectableLayers)
            .difference(visitedParents)
            .filter(function (layer) {
                return layer.kind !== layer.layerKinds.GROUPEND && !layer.locked;
            })
            .value()
    };

    /**
     * Returns all leaf layers we can directly dive into
     * 
     * @private
     * @param  {LayerTree} layerTree
     * @return {Array.<Layer>}
     */
    var _getDiveableLayers = function (layerTree) {
        return _.chain(layerTree.layerArray)
            .rest() // Get rid of undefined first layer, only time it's defined is flat documents
            .where({selected: true}) // Only selected layers
            .pluck("children") // Grab their children
            .flatten() // Flatten all children to one array
            .where({locked: false}) // Only allow for unlocked layers
            .filter(function (layer) {
                return layer.kind !== layer.layerKinds.GROUPEND;
            })
            .value();
    };

    /**
     * Helper for backOut function
     * Gets all parents of selected layers
     * 
     * @param  {LayerTree} layerTree
     * @param  {boolean} noDeselect Does not deselect root layers
     * @return {Array.<Layer>} parents of all selected layers
     */
    var _getSelectedLayerParents = function (layerTree, noDeselect) {
        return _.chain(layerTree.layerArray)
            .rest() // Get rid of undefined first layer
            .where({selected: true}) // Only selected layers
            .map(function (layer) {
                // Don't get rid of root layers if noDeselect is passed
                if (noDeselect && !layer.parent) {
                    return layer;
                } else {
                    return layer.parent;
                }
            }) // Grab their parents
            .unique() // Filter out duplicates
            .remove(null) // Remove null parents (so we deselect if necessary)
            .value();
    };

    /**
     * For every selected layer, returns the next sibling in it's group
     * For now, we only return one sibling
     *
     * @private
     * @param  {LayerTree} layerTree
     * @return {Array.<Layer>}
     */
    var _getNextSiblingsForSelectedLayers = function (layerTree) {
        if (_.isEmpty(layerTree.layerArray)) {
            return [];
        }

        var selectedLayers = _.chain(layerTree.layerArray)
            .rest() // Get rid of undefined first layer
            .where({selected: true}) // Grab selected layers
            .value();

        if (_.isEmpty(selectedLayers)) {
            selectedLayers = layerTree.topLayers;
        }

        // Should we want to return next sibling of all selected layers, delete this line
        selectedLayers = [_.last(selectedLayers)];
        
        var layerSiblings = selectedLayers.map(function (layer) {
            var siblings = layer.parent ? layer.parent.children : layerTree.topLayers,
                cleanSiblings = _.filter(siblings, function (layer) {
                    return layer.kind !== layer.layerKinds.GROUPEND && !layer.locked;
                }),
                layerIndex = _.indexOf(cleanSiblings, layer),
                nextIndex = (layerIndex + 1) % cleanSiblings.length;

            return cleanSiblings[nextIndex];
        });

        return _.chain(layerSiblings)
            .unique()
            .value();
    };

    /**
     * Get all the layers and layer groups underneath x,y, including layer groups
     * 
     * This would only work with rectangular layers because bounds are boxes
     * @private
     * @param  {LayerTree} layerTree
     * @param  {number} x
     * @param  {number} y
     * @return {Array.<Layer>} All bounding boxes of layers/groups under the point
     */
    var _getHitLayerBounds = function (layerTree, x, y) {
        return layerTree.layerArray.filter(function (layer) {
            var bounds = layer.bounds;

            return bounds.top <= y && y <= bounds.bottom &&
                bounds.left <= x && x <= bounds.right;
        });
    };

    /**
     * Gets the non group layers that have one of the passed in IDs
     * 
     * @param  {LayerTree} layerTree
     * @param  {Object.<{number: boolean}>} layerMap       
     * @return {Array.<Layer>}
     */
    var _getLeafLayersWithID = function (layerTree, layerMap) {
        return layerTree.layerArray.filter(function (layer) {
            return layerMap.hasOwnProperty(layer.id) &&
                layer.kind !== layer.layerKinds.GROUPEND &&
                layer.kind !== layer.layerKinds.GROUP &&
                !layer.locked;
        });
    };

    /**
     * Checks to see if the layer is the only selected layer
     *
     * @private
     * @param  {LayerTree}  layerTree
     * @param  {Layer}  layer
     * @return {Boolean}
     */
    var _isOnlySelectedLayer = function (layerTree, layer) {
        return _.chain(layerTree.layerArray)
            .rest()
            .without(layer)
            .all({selected: false})
            .value();
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
            layerTree = doc.layerTree,
            hitPlayObj = hitTestLib.layerIDsAtPoint(coords.x, coords.y);

        return descriptor.playObject(hitPlayObj)
            .bind(this)
            .get("layersHit")
            .catch(function () {
                return [];
            })
            .then(function (hitLayerIDs) {
                var clickedSelectableLayerIDs;

                if (deep) {
                    // Select any non-group layer
                    var hitLayerMap = hitLayerIDs.reduce(function (layerMap, id) {
                            layerMap[id] = true;
                            return layerMap;
                        }, {}),
                        clickedSelectableLayers = _getLeafLayersWithID(layerTree, hitLayerMap);

                    clickedSelectableLayerIDs = _.pluck(clickedSelectableLayers, "id");
                } else {
                    var coveredLayers = _getHitLayerBounds(layerTree, coords.x, coords.y),
                        selectableLayers = _getSelectableLayers(layerTree),
                        clickableLayers = _.intersection(selectableLayers, coveredLayers),
                        clickableLayerIDs = _.pluck(clickableLayers, "id");
                    
                    clickedSelectableLayerIDs = _.intersection(hitLayerIDs, clickableLayerIDs);
                }
                
                if (clickedSelectableLayerIDs.length > 0) {
                    // due to way hitTest works, the top z-order layer is the last one in the list
                    var topLayerID = _.last(clickedSelectableLayerIDs),
                        topLayer = layerTree.layerSet[topLayerID],
                        modifier = "select";

                    if (add && topLayer.selected) {
                        // If we hold shift, and this is the only layer selected, we deselect all
                        if (_isOnlySelectedLayer(layerTree, topLayer)) {
                            return this.transfer(layerActions.deselectAll, doc.id)
                                .catch(function () {})
                                .return(false);
                        }
                        modifier = "deselect";
                    } else if (add) {
                        modifier = "add";
                    }
                    
                    return this.transfer(layerActions.select, doc.id, topLayerID, modifier)
                        .return(true);
                } else {
                    return this.transfer(layerActions.deselectAll, doc.id)
                        .catch(function () {}) // Deselect fails if there were no layers selected, so we ignore those
                        .return(false);
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
            layerTree = doc.layerTree,
            hitPlayObj = hitTestLib.layerIDsAtPoint(coords.x, coords.y);

        return descriptor.playObject(hitPlayObj)
            .bind(this)
            .get("layersHit")
            .catch(function () {
                return [];
            })
            .then(function (hitLayerIDs) {
                var selectableLayers = _getDiveableLayers(layerTree), // Child layers of selected layers
                    coveredLayers = _getHitLayerBounds(layerTree, coords.x, coords.y), // Layers/Groups under the mouse
                    diveableLayers = _.intersection(selectableLayers, coveredLayers), // Valid children of selected under the mouse
                    diveableLayerIDs = _.pluck(diveableLayers, "id"), // Grab their ids...
                    targetLayerIDs = _.intersection(hitLayerIDs, diveableLayerIDs), // Find the ones user actually clicked on
                    topTargetID = _.last(targetLayerIDs); // Get the top z-order one

                if (targetLayerIDs.length > 0) {
                    return this.transfer(layerActions.select, doc.id, topTargetID);
                }
            });
    };

    /**
     * Backs out of the selected layers to their parents
     * 
     * @param  {Document} doc
     * @param  {boolean} noDeselect If true, top level layers will not be removed from selection
     * @return {Promise}
     */
    var backOutCommand = function (doc, noDeselect) {
        var layerTree = doc.layerTree,
            backOutParents = _getSelectedLayerParents(layerTree, noDeselect),
            backOutParentIDs = _.pluck(backOutParents, "id");

        if (backOutParentIDs.length > 0) {
            return this.transfer(layerActions.select, doc.id, backOutParentIDs);
        } else if (!noDeselect) {
            return this.transfer(layerActions.deselectAll, doc.id).catch(function () {});
        } else {
            return Promise.resolve();
        }
    };

    /**
     * Skips to the next unlocked sibling layer of the first selected layer
     * 
     * @param  {Document} doc
     * @return {Promise}
     */
    var nextSiblingCommand = function (doc) {
        var layerTree = doc.layerTree,
            nextSiblings = _getNextSiblingsForSelectedLayers(layerTree),
            nextSiblingIDs = _.pluck(nextSiblings, "id");

        return this.transfer(layerActions.select, doc.id, nextSiblingIDs);
    };

    /**
     * Dives in one level to the selected layer, no op if it's not a group layer
     * 
     * @param  {Document} doc
     * @return {Promise}
     */
    var diveInCommand = function (doc) {
        var layerTree = doc.layerTree,
            diveableLayers = _getDiveableLayers(layerTree),
            diveLayer = _.first(diveableLayers);

        if (diveLayer) {
            return this.transfer(layerActions.select, doc.id, diveLayer.id);
        } else {
            return Promise.resolve();
        }
    };

    /**
     * Selects and starts dragging the layer around
     * @param  {Document} doc       
     * @param  {number} x         Horizontal location of click
     * @param  {number} y         Vertical location of click
     * @param  {{alt: boolean, command: boolean, shift: boolean}} modifiers Keyboard modifiers with the drag
     * @return {Promise}           
     */
    var dragCommand = function (doc, x, y, modifiers) {
        var eventKind = OS.eventKind.LEFT_MOUSE_DOWN,
            coordinates = [x, y],
            dragModifiers = modifiers.alt ? OS.eventModifiers.ALT : OS.eventModifiers.NONE;

        return this.transfer(clickAction, doc, x, y, modifiers.command, modifiers.shift)
            .then(function (anySelected) {
                if (anySelected) {
                    // Add a temporary listener for move
                    descriptor.once("move", function () {
                        return this.transfer(documentActions.updateDocument, doc.id);
                    }.bind(this));
                    
                    return OS.postEvent({eventKind: eventKind, location: coordinates, modifiers: dragModifiers});
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
        reads: [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_DOC, locks.JS_DOC]
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
        reads: [locks.PS_DOC, locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_DOC, locks.JS_DOC]
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
