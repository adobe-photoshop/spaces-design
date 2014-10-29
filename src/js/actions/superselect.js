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

    var _ = require("lodash");

    var descriptor = require("adapter/ps/descriptor"),
        hitTestLib = require("adapter/lib/hitTest"),
        locks = require("js/locks"),
        layerActions = require("./layers");


    var _replaceTopLayerWithSiblingsOf = function (layer, topLayers, visitedParents) {
        var layerAncestor = layer.parent;

        // If we were already at root, we don't need to do anything for this layer
        if (!layerAncestor) {
            return;
        }

        
        // As we traverse up to the owning root layer, add the parents to visitedParents
        // So we don't add them later on
        while (layerAncestor) {
            if (!_.contains(visitedParents, layerAncestor)) {
                _.pull(topLayers, layerAncestor);
                visitedParents.push(layerAncestor);
                // Add the siblings of this layer to accepted layers
                topLayers = topLayers.concat(layerAncestor.children);
            }
            layerAncestor = layerAncestor.parent;
        }

        return topLayers;


    };

    /**
     * Returns all selectable layers in the current selection state
     * Selectable means either a direct sibling of any of the selected layers
     * Or a first seen parent of an unrelated group
     * We achieve this by getting all root layers
     * Then for each selected layer, removing the root layer it belongs to and replacing it with the layer's siblings
     * @param {LayerTree} layerTree
     * @return {Array.<Layer>} All selectable layers given the current selection
     */
    var _getSelectableLayers = function (layerTree) {
        var layerArray = layerTree.layerArray,
            selectedLayers = layerArray.filter(function (layer) {
                return layer.selected;
            }),
            selectableLayers = _.clone(layerTree.topLayers),
            visitedParents = [];

        selectedLayers.forEach(function (layer) {
            selectableLayers = _replaceTopLayerWithSiblingsOf(layer, selectableLayers, visitedParents);
        });

        selectableLayers = _.difference(selectableLayers, visitedParents);
        selectableLayers = _.filter(selectableLayers, function (layer) { 
            return layer.kind !== layer.layerKinds.GROUPEND;
        });

        return selectableLayers;
    };

    /**
     * This would only work with rectangular layers because bounds are bounding boxes
     * @private
     * @param  {LayerTree} layerTree
     * @param  {number} x
     * @param  {number} y
     * @return {Array.<Layer>} All bounding boxes of layers/groups under the point
     */
    var _getHitLayers = function(layerTree, x, y) {
        return layerTree.layerArray.filter(function (layer) {
            var bounds = layer.bounds;

            return bounds.top <= y && y <= bounds.bottom &&
                bounds.left <= x && x <= bounds.right;
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
     * @return {Promise}
     */
    var clickCommand = function (doc, x, y) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerTree = doc.layerTree,
            hitPlayObj = hitTestLib.layerIDsAtPoint(coords.x, coords.y),
            coveredLayers = _getHitLayers(layerTree, coords.x, coords.y),
            selectableLayers = _.intersection(_getSelectableLayers(layerTree), coveredLayers);

        return descriptor.playObject(hitPlayObj)
            .bind(this)
            .get("layersHit")
            .catch(function () {
                return [];
            })
            .then(function (hitLayerIDs) {
                var selectableLayerIDs = _.pluck(selectableLayers, "id"), 
                    clickedSelectableLayerIDs = _.intersection(hitLayerIDs, selectableLayerIDs),
                    // due to hitTest works, the top z-order layer is the last one in the list
                    topLayerID = _.last(clickedSelectableLayerIDs);

                if (clickedSelectableLayerIDs.length > 0) {
                    return this.transfer(layerActions.select, doc.id, topLayerID);
                } else {
                    return this.transfer(layerActions.deselectAll, doc.id);
                }
            });
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

    exports.click = clickAction;
});
