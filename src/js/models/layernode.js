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

define(function (require, exports, module) {
    "use strict";

    var Immutable = require("immutable");

    var layerLib = require("adapter/lib/layer");

    /**
     * A node in the layer tree structure.
     * 
     * @constructor
     */
    var LayerNode = Immutable.Record({
        /**
         * Layer ID
         *
         * @type {number}
         */
        id: null,

        /**
         * Layer IDs of immediate children
         *
         * @type {Immutable.Iterable<number>}
         */
        children: null,

        /**
         * Layer ID of parent
         *
         * @type {Immutable.Iterable<number>}
         */
        parent: null,

        /**
         * Depth of the layer in the layer hierarchy
         *
         * @type {number}
         */
        depth: null
    });

    /**
     * Create a tree of layer nodes from an order list of Layer models. Returns
     * a Map of all layer IDs to their corresponding LayerNode, as well as an
     * ordered list of tree roots.
     * 
     * @param {Immutable.Iterable<Layer>} layers
     * @return {{roots: Immutable.List<LayerNode>, nodes: Immutable.Map.<number, LayerNode>}}
     */
    LayerNode.fromLayers = function (layers) {
        var nodes = new Map();

        var makeLayerNodes = function (parent, index, depth) {
            var roots = [],
                node,
                layer,
                layerID,
                layerKind,
                children,
                previousSize;

            while (index >= 0) {
                layer = layers.get(index--);
                layerID = layer.id;
                layerKind = layer.kind;

                if (layerKind === layerLib.layerKinds.GROUP) {
                    previousSize = nodes.size;
                    children = makeLayerNodes(layerID, index, depth + 1);
                    index -= (nodes.size - previousSize);
                } else {
                    children = null;
                }

                node = new LayerNode({
                    id: layerID,
                    children: children,
                    parent: parent,
                    depth: depth
                });

                nodes.set(layerID, node);
                roots.push(node);

                if (layerKind === layerLib.layerKinds.GROUPEND) {
                    break;
                }
            }

            return Immutable.List(roots);
        };

        var roots = makeLayerNodes(null, layers.size - 1, 0);
        return {
            roots: roots,
            nodes: Immutable.Map(nodes)
        };
    };

    module.exports = LayerNode;
});
