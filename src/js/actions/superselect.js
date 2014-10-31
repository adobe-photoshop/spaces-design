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
        Promise = require("bluebird");

    var descriptor = require("adapter/ps/descriptor"),
        hitTestLib = require("adapter/lib/hitTest"),
        locks = require("js/locks"),
        layerActions = require("./layers");


    /**
     * Helper function for super select single click
     * For one layer, adds all siblings of it's parents, all the way to the top
     * If a parent has been visited before, we avoid going down that path again to save time
     * 
     * @private
     * @param  {Layer} layer Starting layer
     * @param  {Array.<Layer>} selectableLayers Collection of selectable layers so far 
     * @param  {Array.<Layer>} visitedParents Already processed parents
     * @return {Array.<Layer>} Siblings of this layer
     */
    var _replaceAncestorWithSiblingsOf = function (layer, selectableLayers, visitedParents) {
        var layerAncestor = layer.parent;

        // If we were already at root, we don't need to do anything for this layer
        if (!layerAncestor) {
            return selectableLayers;
        }
        
        // Traverse up to root
        while (layerAncestor && !_.contains(visitedParents, layerAncestor)) {
            // Remove the current parent because we're already below it
            _.pull(selectableLayers, layerAncestor);

            // So we don't process this parent again
            visitedParents.push(layerAncestor);
            
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

        selectedLayers.forEach(function (layer) {
            selectableLayers = _replaceAncestorWithSiblingsOf(layer, selectableLayers, visitedParents);
        });

        selectableLayers = _.difference(selectableLayers, visitedParents);
        selectableLayers = _.filter(selectableLayers, function (layer) {
            return layer.kind !== layer.layerKinds.GROUPEND && !layer.locked;
        });

        return selectableLayers;
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
            .rest() //Get rid of undefined first layer
            .where({selected: true}) //Only selected layers
            .pluck("children") //Grab their children
            .flatten() //Flatten all children to one array
            .where({locked: false}) //Only allow for unlocked layers
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
            .rest() //Get rid of undefined first layer
            .where({selected: true}) //Only selected layers
            .map(function (layer) {
                // Don't get rid of root layers if noDeselect is passed
                if (noDeselect && !layer.parent) {
                    return layer;
                } else {
                    return layer.parent;
                }
            }) //Grab their parents
            .unique() //Filter out duplicates
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
            .rest() //Get rid of undefined first layer
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
     * This would only work with rectangular layers because bounds are bounding boxes
     * @private
     * @param  {LayerTree} layerTree
     * @param  {number} x
     * @param  {number} y
     * @return {Array.<Layer>} All bounding boxes of layers/groups under the point
     */
    var _getHitLayers = function (layerTree, x, y) {
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
     * @param  {Array.<number>} ids       
     * @return {Array.<Layer>}
     */
    var _getLeafLayersWithID = function (layerTree, ids) {
        return layerTree.layerArray.filter(function (layer) {
            return _.contains(ids, layer.id) &&
                layer.kind !== layer.layerKinds.GROUPEND &&
                layer.kind !== layer.layerKinds.GROUP &&
                !layer.locked;
        });
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
     * @return {Promise}
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
                    var clickedSelectableLayers = _getLeafLayersWithID(layerTree, hitLayerIDs);

                    clickedSelectableLayerIDs = _.pluck(clickedSelectableLayers, "id");
                } else {
                    var coveredLayers = _getHitLayers(layerTree, coords.x, coords.y),
                        selectableLayers = _getSelectableLayers(layerTree),
                        clickableLayers = _.intersection(selectableLayers, coveredLayers),
                        clickableLayerIDs = _.pluck(clickableLayers, "id");
                    
                    clickedSelectableLayerIDs = _.intersection(hitLayerIDs, clickableLayerIDs);
                }
                
                if (clickedSelectableLayerIDs.length > 0) {
                    // due to hitTest works, the top z-order layer is the last one in the list
                    var topLayerID = _.last(clickedSelectableLayerIDs),
                        topLayerSelected = layerTree.layerSet[topLayerID].selected,
                        modifier = "select";

                    if (add && topLayerSelected) {
                        modifier = "deselect";
                    } else if (add) {
                        modifier = "add";
                    }
                    
                    return this.transfer(layerActions.select, doc.id, topLayerID, modifier);
                } else {
                    return this.transfer(layerActions.deselectAll, doc.id).catch(function () {});
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
                var selectableLayers = _getDiveableLayers(layerTree),
                    coveredLayers = _getHitLayers(layerTree, coords.x, coords.y),
                    diveableLayers = _.intersection(selectableLayers, coveredLayers),
                    diveableLayerIDs = _.pluck(diveableLayers, "id"),
                    targetLayerIDs = _.intersection(hitLayerIDs, diveableLayerIDs),
                    topTargetID = _.last(targetLayerIDs);

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

    exports.click = clickAction;
    exports.doubleClick = doubleClickAction;
    exports.backOut = backOutAction;
    exports.nextSibling = nextSiblingAction;
    exports.diveIn = diveInAction;
});
