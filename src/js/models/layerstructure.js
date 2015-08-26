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

    var Layer = require("./layer"),
        LayerNode = require("./layernode"),
        Bounds = require("./bounds"),
        Radii = require("./radii");

    var objUtil = require("js/util/object"),
        collection = require("js/util/collection");

    /**
     * A model of the Photoshop layer structure.
     *
     * @constructor
     */
    var LayerStructure = Immutable.Record({
        /**
         * All Layer objects indexed by layer ID.
         *
         * @type {Immutable.Map.<number, Layer>}
         */
        layers: null,

        /**
         * Index-ordered layer IDs.
         *
         * @type {Immutable.List.<number>}
         */
        index: null
    });

    /**
     * Construct a LayerStructure model from Photoshop document and layer descriptors.
     *
     * @param {object} documentDescriptor
     * @param {object} layerDescriptors
     * @return {LayerStructure}
     */
    LayerStructure.fromDescriptors = function (documentDescriptor, layerDescriptors) {
        var targetLayers = documentDescriptor.targetLayers || [],
            selectedIndices = targetLayers.reduce(function (indices, obj) {
                indices[obj._index + 1] = true;
                return indices;
            }, {});

        var layers = layerDescriptors.reduce(function (layers, layerDescriptor) {
            var layerID = layerDescriptor.layerID,
                itemIndex = layerDescriptor.itemIndex,
                selected = !!selectedIndices[itemIndex];

            layers.set(layerID, Layer.fromDescriptor(documentDescriptor, layerDescriptor, selected));
            return layers;
        }, new Map());
        layers = Immutable.Map(layers);

        var index = layerDescriptors.reverse().map(function (layerDescriptor) {
            return layerDescriptor.layerID;
        });
        index = Immutable.List(index);

        return new LayerStructure({
            layers: layers,
            index: index
        });
    };

    /**
     * Helper function for getSelectableLayers
     * For one layer, adds all siblings of it's parents, all the way up the tree
     *
     * @private
     * @param {Layer} layer Starting layer
     * @param {Immutable.Iterable.<Layer>} selectableLayers Collection of selectable layers so far
     * @param {Object.<{number: Layer}>} visitedParents Already processed parents
     * @return {Immutable.Iterable.<Layer>} Siblings of this layer
     */
    LayerStructure.prototype._replaceAncestorWithSiblingsOf = function (layer, selectableLayers, visitedParents) {
        var layerAncestor = this.parent(layer);

        // If we were already at root, we don't need to do anything for this layer
        if (!layerAncestor) {
            return selectableLayers;
        }

        var pull = function (layers, parent) {
            return layers.filter(function (layer) {
                return layer !== parent;
            });
        };

        // Updates selectable layers by moving the child to the end of it
        var moveToEnd = function (child) {
            selectableLayers = pull(selectableLayers, child).push(child);
        };

        // Traverse up to root
        while (layerAncestor && !visitedParents.hasOwnProperty(layerAncestor.id)) {
            // Remove the current parent because we're already below it
            selectableLayers = pull(selectableLayers, layerAncestor);

            // So we don't process this parent again
            visitedParents[layerAncestor.id] = layerAncestor;

            // Add the siblings of this layer to accepted layers
            // if we encounter a layer that was in "topBelowArtboards", we replace it at the end here
            // so it doesn't break z-order
            this.children(layerAncestor).forEach(moveToEnd);
            
            layerAncestor = this.parent(layerAncestor);
        }

        return selectableLayers;
    };

    Object.defineProperties(LayerStructure.prototype, objUtil.cachedGetSpecs({
        /**
         * @private
         * @type {{nodes: Immutable.Map.<number, LayerNode>, roots: Immutable.List.<LayerNode>}}
         */
        "_nodeInfo": function () {
            return LayerNode.fromLayers(this.all);
        },

        /**
         * All LayerNode objects index by layer ID.
         *
         * @type {Immutable.Map.<number, LayerNode>}
         */
        "nodes": function () {
            return this._nodeInfo.nodes;
        },

        /**
         * Index-ordered root LayerNode objects.
         *
         * @type {Immutable.List.<LayerNode>}
         */
        "roots": function () {
            return this._nodeInfo.roots;
        },

        /**
         * Indicates whether there are features in the document
         *  that are currently unsupported.
         *
         * @type {boolean}
         */
        "unsupported": function () {
            return this.layers.some(function (layer) {
                return layer.unsupported;
            });
        },

        /**
         * Mapping from layer IDs to indices.
         * @type {Immutable.Map.<number, number>}
         */
        "reverseIndex": function () {
            var reverseIndex = this.index.reduce(function (reverseIndex, layerID, i) {
                return reverseIndex.set(layerID, i + 1);
            }, new Map());

            return Immutable.Map(reverseIndex);
        },

        /**
         * Index-ordered list of all layer models.
         * @type {Immutable.List.<Layer>}
         */
        "all": function () {
            return this.index.map(this.byID, this);
        },

        /**
         * All non-endgroup layers
         * @type {Immutable.List.<Layer>}
         */
        "allVisible": function () {
            return this.all
                .filterNot(function (layer) {
                    return layer.kind === layer.layerKinds.GROUPEND;
                });
        },

        /**
        * All non-endgroup layers, in reverse order
        * @type {Immutable.List.<Layer>}
        */
        "allVisibleReversed": function () {
            return this.allVisible.reverse();
        },

        /**
         * Root Layer models of the layer forest.
         * @type {Immutable.List.<Layer>}
         */
        "top": function () {
            return this.roots
                .toSeq()
                .map(function (node) {
                    return this.byID(node.id);
                }, this)
                .filter(function (layer) {
                    return layer.kind !== layer.layerKinds.GROUPEND;
                })
                .toList();
        },

        /**
         * All the root layers of the document + first level children
         * of artboards
         * @type {Immutable.List.<Layer>}
         */
        "topBelowArtboards": function () {
            return this.top
                .flatMap(function (layer) {
                    if (layer.isArtboard) {
                        return this.children(layer)
                            .filter(function (layer) {
                                return layer.kind !== layer.layerKinds.GROUPEND;
                            })
                            .push(layer);
                    } else {
                        return Immutable.List.of(layer);
                    }
                }, this)
                .sort(function (layerA, layerB) {
                    var valueA = layerA.isArtboard ? 1 : 0,
                        valueB = layerB.isArtboard ? 1 : 0;

                    return valueA - valueB;
                })
                .toList();
        },

        /**
         * The subset of Layer models that correspond to currently selected layers.
         * @type {Immutable.List.<Layer>}
         */
        "selected": function () {
            return this.all.filter(function (layer) {
                return layer.selected;
            }, this);
        },

        /**
         * Child-encompassing bounds objects for all the selected layers.
         * @type {Immutable.List.<Bounds>}
         */
        "selectedChildBounds": function () {
            return this.selected
                .toSeq()
                .map(function (layer) {
                    return this.childBounds(layer);
                }, this)
                .filter(function (bounds) {
                    return bounds && bounds.area > 0;
                })
                .toList();
        },

        /**
         * Overall bounds of selection
         * @type {Bounds}
         */
        "selectedAreaBounds": function () {
            return Bounds.union(this.selectedChildBounds);
        },

        /**
         * The set of artboards in the document
         * @type {Immutable.List.<Layer>}
         */
        "artboards": function () {
            return this.top.filter(function (layer) {
                return layer.isArtboard;
            });
        },

        /**
         * The set of top level ancestors of all selected layers
         * @type {Immutable.Set.<Layer>}
         */
        "selectedTopAncestors": function () {
            return this.selected.map(function (layer) {
                return this.topAncestor(layer);
            }, this).toSet();
        },

        /**
         * The subset of Layer models that correspond to leaves of the layer forest.
         * @type {Immutable.List.<Layer>}
         */
        "leaves": function () {
            return this.all.filter(function (layer) {
                return layer.kind !== layer.layerKinds.GROUPEND &&
                    layer.kind !== layer.layerKinds.GROUP &&
                    layer.visible &&
                    !this.hasLockedAncestor(layer);
            }, this);
        },

        /**
         * The subset of Layer models that can currently be directly selected.
         * @type {Immutable.List.<Layer>}
         */
        "selectable": function () {
            var visitedParents = {};

            return this.selected
                .toSeq()
                .reduce(function (validLayers, layer) {
                    return this._replaceAncestorWithSiblingsOf(layer, validLayers, visitedParents);
                }, this.topBelowArtboards, this)
                .filter(function (layer) {
                    return layer.superSelectable &&
                        this.hasVisibleDescendant(layer) &&
                        !this.hasInvisibleAncestor(layer) &&
                        !this.hasLockedAncestor(layer) &&
                        !visitedParents.hasOwnProperty(layer.id);
                }, this)
                .toList();
        },

        /**
         * The subset of Layer models that are all selected or are descendants of selected
         *
         * @return {Immutable.List.<Layer>}
         */
        "allSelected": function () {
            return this.selected.flatMap(this.descendants, this).toOrderedSet();
        },

        /**
         * True if there are any artboards in the layer tree
         *
         * @return {boolean} if any layers in an artboard
         */
        "hasArtboard": function () {
            return this.top.some(function (layer) {
                return layer.isArtboard;
            });
        },

        /**
         * True if the background layer is selected.
         *
         * @return {boolean}
         */
        "backgroundSelected": function () {
            var firstLayer = this.byIndex(1);

            return firstLayer && firstLayer.isBackground && firstLayer.selected;
        },

        /**
         * True if there are any linked smart objects
         *
         * @return {boolean} if any layers are a linked smart object
         */
        "hasLinkedSmartObjects": function () {
            return this.all.some(function (layer) {
                return layer.isLinked;
            });
        },

        /**
         * The subset of Layer models that are all selected, with their descendants removed
         * from selection
         *
         * @return {Immutable.List.<Layer>}
         */
        "selectedNormalized": function () {
            // For each layer, remove all it's descendants from the group
            var selected = this.selected;
            return selected.filterNot(function (layer) {
                return this.strictAncestors(layer)
                    .some(function (ancestor) {
                        return selected.contains(ancestor);
                    });
            }, this);
        },

        /**
         * Determine if selected layers are "locked"
         * Currently true for any of the following:
         * 1) The background layer is selected
         * 2) Any selected layers are locked
         * 3) No layers are selected
         *
         * @return {boolean} If any selected layers are locked, or if none are selected
         */
        "selectedLocked": function () {
            var selectedLayers = this.selected;
            return selectedLayers.isEmpty() || selectedLayers.some(function (layer) {
                return layer.isBackground || layer.locked;
            });
        },

        /**
         * Determine if selected layers are deletable
         * PS logic is that there will be at least one graphic layer left
         *
         * @return {boolean} If any of the layers outside overall selection are graphic layers
         */
        "selectedLayersDeletable": function () {
            var allSelectedLayers = this.allSelected,
                notSelectedLayers = collection.difference(this.all, allSelectedLayers);

            return !allSelectedLayers.isEmpty() &&
                !notSelectedLayers.isEmpty() &&
                notSelectedLayers.some(function (layer) {
                    return layer.kind !== layer.layerKinds.GROUPEND &&
                        layer.kind !== layer.layerKinds.GROUP;
                });
        }
    }));

    /**
     * Get a Layer model by layer ID.
     *
     * @param {number} id
     * @return {?Layer}
     */
    LayerStructure.prototype.byID = function (id) {
        return this.layers.get(id, null);
    };

    /**
     * Get a Layer model by layer index.
     *
     * @param {number} index
     * @return {?Layer}
     */
    LayerStructure.prototype.byIndex = function (index) {
        var layerID = this.index.get(index - 1, null);
        if (layerID === null) {
            return null;
        } else {
            return this.byID(layerID);
        }
    };

    /**
     * Find the index of the given layer.
     *
     * @param {Layer} layer
     * @return {?number}
     */
    LayerStructure.prototype.indexOf = function (layer) {
        return this.reverseIndex.get(layer.id, null);
    };

    /**
     * Find the parent of the given layer.
     *
     * @param {Layer} layer
     * @return {?Layer}
     */
    LayerStructure.prototype.parent = function (layer) {
        var node = this.nodes.get(layer.id, null);

        if (!node || node.parent === null) {
            return null;
        } else {
            return this.byID(node.parent);
        }
    };

    /**
     * Get the depth of the given layer in the layer hierarchy.
     *
     * @param {Layer} layer
     * @return {?number}
     */
    LayerStructure.prototype.depth = function (layer) {
        var node = this.nodes.get(layer.id, null);

        if (!node) {
            return null;
        } else {
            return node.depth;
        }
    };

    /**
     * Calculates the depth of the lowest descendant of the given layer
     *
     * @param {Layer} layer
     * @return {number}
     */
    Object.defineProperty(LayerStructure.prototype, "maxDescendantDepth", objUtil.cachedLookupSpec(function (layer) {
        return this.descendants(layer).map(this.depth, this).max();
    }));

    /**
     * Find the children of the given layer.
     *
     * @param {Layer} layer
     * @return {?Immutable.List.<Layer>}
     */
    Object.defineProperty(LayerStructure.prototype, "children", objUtil.cachedLookupSpec(function (layer) {
        var node = this.nodes.get(layer.id, null);

        if (node && node.children) {
            return node.children.map(function (child) {
                return this.byID(child.id);
            }, this);
        } else {
            return Immutable.List();
        }
    }));

    /**
     * Find all siblings of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(LayerStructure.prototype, "siblings", objUtil.cachedLookupSpec(function (layer) {
        var parent = this.parent(layer);

        if (parent) {
            return this.children(parent);
        } else {
            return this.top;
        }
    }));

    /**
     * Find all ancestors of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {?Immutable.List.<Layer>}
     */
    Object.defineProperty(LayerStructure.prototype, "ancestors", objUtil.cachedLookupSpec(function (layer) {
        return this.strictAncestors(layer)
            .push(layer);
    }));

    /**
     * Find the top ancestor of the given layer.
     *
     * @param {Layer} layer
     * @return {Layer}
     */
    Object.defineProperty(LayerStructure.prototype, "topAncestor", objUtil.cachedLookupSpec(function (layer) {
        var ancestor = layer;

        while (this.parent(ancestor)) {
            ancestor = this.parent(ancestor);
        }

        return ancestor;
    }));

    /**
     * Find all ancestors of the given layer, excluding itself.
     *
     * @param {Layer} layer
     *
     * @return {?Immutable.List.<Layer>}
     */
    Object.defineProperty(LayerStructure.prototype, "strictAncestors", objUtil.cachedLookupSpec(function (layer) {
        var parent = this.parent(layer);

        if (parent) {
            return this.ancestors(parent);
        } else {
            return Immutable.List();
        }
    }));

    /**
     * Find all locked ancestors of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(LayerStructure.prototype, "lockedAncestors", objUtil.cachedLookupSpec(function (layer) {
        return this.ancestors(layer).filter(function (layer) {
            return layer.locked;
        });
    }));

    /**
     * Determine whether the given layer has a collapsed ancestor, and hence
     * should be hidden in the layers panel.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(LayerStructure.prototype, "hasCollapsedAncestor", objUtil.cachedLookupSpec(function (layer) {
        return this.strictAncestors(layer).some(function (layer) {
            return !layer.expanded;
        });
    }));

    /**
     * Find all descendants of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(LayerStructure.prototype, "descendants", objUtil.cachedLookupSpec(function (layer) {
        return this.strictDescendants(layer)
            .push(layer);
    }));

    /**
     * Find all descendants of the given layer, excluding itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(LayerStructure.prototype, "strictDescendants", objUtil.cachedLookupSpec(function (layer) {
        return this.children(layer)
            .toSeq()
            .reverse()
            .map(this.descendants, this)
            .flatten(true)
            .toList();
    }));
    /**
     * Find all locked descendants of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(LayerStructure.prototype, "lockedDescendants", objUtil.cachedLookupSpec(function (layer) {
        return this.descendants(layer).filter(function (layer) {
            return layer.locked;
        });
    }));

    /**
     * Determine whether some ancestors of the given layer are locked.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(LayerStructure.prototype, "hasLockedAncestor", objUtil.cachedLookupSpec(function (layer) {
        return this.ancestors(layer).some(function (layer) {
            return layer.locked;
        });
    }));

    /**
     * Determine whether some descendants of the given layer are locked.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(LayerStructure.prototype, "hasLockedDescendant", objUtil.cachedLookupSpec(function (layer) {
        return this.descendants(layer).some(function (descendant) {
            return descendant.locked;
        }, this);
    }));

    /**
     * Determine whether some ancestors of the given layer are selected.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(LayerStructure.prototype,
        "hasStrictSelectedAncestor", objUtil.cachedLookupSpec(function (layer) {
        var parent = this.parent(layer);

        if (parent) {
            return this.hasSelectedAncestor(parent);
        } else {
            return false;
        }
    }));

    /**
     * Determine whether some ancestors of the given layer are selected.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(LayerStructure.prototype, "hasSelectedAncestor", objUtil.cachedLookupSpec(function (layer) {
        return layer.selected || this.hasStrictSelectedAncestor(layer);
    }));

    /**
     * Determine whether some ancestors of the given layer are invisible.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(LayerStructure.prototype, "hasInvisibleAncestor", objUtil.cachedLookupSpec(function (layer) {
        return this.ancestors(layer).some(function (layer) {
            return !layer.visible;
        });
    }));

    /**
     * Determine whether any of the non group descendants of this layer (besides itself) is visible.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(LayerStructure.prototype, "hasVisibleDescendant", objUtil.cachedLookupSpec(function (layer) {
        return this.descendants(layer)
            .filterNot(function (layer) {
                return (layer.kind === layer.layerKinds.GROUP || layer.kind === layer.layerKinds.GROUPEND) &&
                    !layer.isArtboard;
            })
            .some(function (layer) {
                return layer.visible;
            });
    }));

    /**
     * Determine whether a layer is an empty group or contains only adjustment layers
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(LayerStructure.prototype, "isEmptyGroup", objUtil.cachedLookupSpec(function (layer) {
        return layer.kind === layer.layerKinds.GROUP &&
            this.children(layer)
            .filterNot(function (layer) {
                return layer.kind === layer.layerKinds.ADJUSTMENT || this.isEmptyGroup(layer);
            }, this)
            .size === 1; // only contains groupend
    }));

    /**
     * Calculate the child-encompassing bounds of the given layer. Returns null
     * for end-group layers and otherwise-empty groups. If layer is artboard, returns the bounds of it
     *
     * @param {Layer} layer
     * @return {?Bounds}
     */
    Object.defineProperty(LayerStructure.prototype, "childBounds", objUtil.cachedLookupSpec(function (layer) {
        switch (layer.kind) {
            case layer.layerKinds.GROUP:
                if (layer.isArtboard) {
                    return layer.bounds;
                }

                var childBounds = this.children(layer)
                    .map(this.childBounds, this)
                    .filter(function (bounds) {
                        return bounds && bounds.area > 0;
                    });

                return Bounds.union(childBounds);
            case layer.layerKinds.GROUPEND:
                return null;
            default:
                return layer.bounds;
        }
    }));

    /**
     * Calculate the bounds of a layer visible within it's parent artboard,
     * layer's own bounds if it's not in an artboard
     *
     * @param {Layer} layer
     * @return {?Bounds}
     */
    Object.defineProperty(LayerStructure.prototype, "boundsWithinArtboard", objUtil.cachedLookupSpec(function (layer) {
        var bounds = this.childBounds(layer),
            topAncestor = this.topAncestor(layer);

        if (topAncestor.isArtboard) {
            bounds = Bounds.intersection(this.childBounds(topAncestor), bounds);
        }

        return bounds;
    }));

    /**
     * Create a new non-group layer model from a Photoshop layer descriptor and
     * add it to the structure.
     *
     * @param {Array.<number>} layerIDs
     * @param {Array.<object>} descriptors Photoshop layer descriptors
     * @param {boolean} selected Whether the new layer should be selected. If
     *  so, the existing selection is cleared.
     * @param {boolean= | number=} replace can be explicitly false, undefined, or a layer ID
     * @param {Document} document
     * @return {LayerStructure}
     */
    LayerStructure.prototype.addLayers = function (layerIDs, descriptors, selected, replace, document) {
        var nextStructure = selected ? this.updateSelection(Immutable.Set()) : this,
            replaceLayer;

        // Default replacement logic is to replace a single, empty, non-background, selected layer
        // Allow explicit opt-in or opt-out via the replace param
        if (replace !== false && layerIDs.length === 1) {
            if (Number.isInteger(replace)) {
                // if explicitly replacing, then replace by current ID
                replaceLayer = this.byID(replace);
            } else {
                // otherwise, replace the selected layer
                var selectedLayers = document.layers.selected;
                replaceLayer = selectedLayers && selectedLayers.size === 1 && selectedLayers.first();
            }

            // The selected layer should be empty and a non-background layer unless replace is explicitly provided true
            replace = replaceLayer &&
                (replace ||
                (!replaceLayer.isBackground && replaceLayer.kind === replaceLayer.layerKinds.PIXEL &&
                replaceLayer.bounds && !replaceLayer.bounds.area));
        }

        // Update the layers and index for each layerID
        var structureToMerge = layerIDs.reduce(function (layerStructure, layerID, i) {
            var nextLayers = layerStructure.layers,
                nextIndex = layerStructure.index,
                descriptor = descriptors[i],
                layerIndex = descriptor.itemIndex - 1,
                isNewSelected = selected && i + 1 === layerIDs.length,
                newLayer = Layer.fromDescriptor(document, descriptor, isNewSelected);

            if (i === 0 && replace) {
                // Replace the single selected layer (derived above)
                var replaceIndex = this.indexOf(replaceLayer) - 1; // FFS
                nextLayers = nextLayers.delete(replaceLayer.id);

                if (layerIndex === replaceIndex) {
                    nextIndex = nextIndex.splice(layerIndex, 1, layerID);
                } else if (layerIndex < nextIndex.size) {
                    nextIndex = nextIndex.delete(replaceIndex).splice(layerIndex, 0, layerID);
                } else {
                    throw new Error ("Replacing a layer but the new layer's index seems out of bounds");
                }
            } else {
                nextIndex = nextIndex.splice(layerIndex, 0, layerID);
            }

            nextLayers = nextLayers.set(layerID, newLayer);

            return {
                layers: nextLayers,
                index: nextIndex
            };
        }.bind(this),
        {
            layers: nextStructure.layers,
            index: nextStructure.index
        });

        return nextStructure.merge(structureToMerge);
    };

    /**
     * Reset the given layers from Photoshop layer descriptors.
     *
     * @param {Immutable.Iterable.<{layerID: number, descriptor: object}>} layerObjs
     * @param {Document} previousDocument
     * @return {LayerStructure}
     */
    LayerStructure.prototype.resetLayers = function (layerObjs, previousDocument) {
        var nextLayers = this.layers.withMutations(function (layers) {
            layerObjs.forEach(function (layerObj) {
                var layerID = layerObj.layerID,
                    descriptor = layerObj.descriptor,
                    layer = this.byID(layerID),
                    nextLayer = layer.resetFromDescriptor(descriptor, previousDocument);

                layers.set(layerID, nextLayer);
            }, this);
        }.bind(this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Update layers based on a given set of Photoshop layer descriptors,
     * using the descriptor's itemIndex to choose which existing layer to replace
     *
     * @param {Document} document
     * @param {Array.<ActionDescriptor>} descriptors Array of layer descriptors
     * @return {LayerStructure}
     */
    LayerStructure.prototype.replaceLayersByIndex = function (document, descriptors) {
        var nextIndex = this.index;

        var nextLayers = this.layers.withMutations(function (layers) {
            descriptors.forEach(function (descriptor) {
                var i = descriptor.itemIndex,
                    previousLayer = this.byIndex(i),
                    nextLayer = Layer.fromDescriptor(document, descriptor, previousLayer.selected);

                // update layers map
                layers.delete(previousLayer.id);
                layers.set(nextLayer.id, nextLayer);

                // replace the layer ID in the index
                nextIndex = nextIndex.set(i - 1, nextLayer.id);
            }, this);
        }.bind(this));

        return this.merge({
            layers: nextLayers,
            index: nextIndex
        });
    };

    /**
     * Reset the given layer bounds from Photoshop bounds descriptors.
     *
     * @param {Immutable.Iterable.<{layerID: number, descriptor: object}>} boundsObj
     * @return {LayerStructure}
     */
    LayerStructure.prototype.resetBounds = function (boundsObj) {
        var nextLayers = this.layers.withMutations(function (layers) {
            boundsObj.forEach(function (boundObj) {
                var layerID = boundObj.layerID,
                    descriptor = boundObj.descriptor,
                    layer = this.byID(layerID),
                    layerBounds = layer.bounds;

                // Ignore updates to layers that don't have bounds like groups and groupends
                if (!layerBounds) {
                    return;
                }

                // Inject layer kind in here for bound reset function
                descriptor.layerKind = layer.kind;

                // Also inject the artboard flag so we read the correct property
                descriptor.artboardEnabled = layer.isArtboard;

                var nextBounds = layer.bounds.resetFromDescriptor(descriptor),
                    nextLayer = layer.set("bounds", nextBounds);

                layers.set(layerID, nextLayer);
            }, this);
        }.bind(this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Update basic properties of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} properties
     * @return {LayerStructure}
     */
    LayerStructure.prototype.setProperties = function (layerIDs, properties) {
        var nextProperties = Immutable.Map(properties),
            updatedLayers = Immutable.Map(layerIDs.reduce(function (layers, layerID) {
                layers.set(layerID, nextProperties);
                return layers;
            }.bind(this), new Map()));

        return this.mergeDeep({
            layers: updatedLayers
        });
    };

    /**
     * Update the bounds of the given layers.
     *
     * @private
     * @param {Immutable.Map.<number, Bounds>} allBounds The keys of the Map are layer IDs.
     * @return {LayerStructure}
     */
    LayerStructure.prototype._updateBounds = function (allBounds) {
        var nextBounds = allBounds.map(function (bounds) {
            return Immutable.Map({
                bounds: bounds
            });
        });

        return this.mergeDeep({
            layers: nextBounds
        });
    };

    /**
     * Resizes the given layers, setting their width and height to be passed in values.
     *
     * @param {Array.<{layer: Layer, w: number, h: number, x: number, y: number}>} layerSizes
     * @return {LayerStructure}
     */
    LayerStructure.prototype.resizeLayers = function (layerSizes) {
        var allBounds = Immutable.Map(layerSizes.reduce(function (allBounds, layerData) {
            var layer = this.byID(layerData.layer.id);
            if (layer.bounds) {
                allBounds.set(layer.id,
                    layer.bounds.updateSizeAndPosition(layerData.x, layerData.y, layerData.w, layerData.h)
                );
            }

            return allBounds;
        }.bind(this), new Map()));

        return this._updateBounds(allBounds);
    };

    /**
     * set the Proportional flag of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {boolean} proportional
     * @return {LayerStructure}
     */
    LayerStructure.prototype.setLayersProportional = function (layerIDs, proportional) {
        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
                return map.set(layerID, Immutable.Map({
                    proportionalScaling: proportional
                }));
            }, new Map()));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Repositions the given layers, setting their top and left to be passed in values.
     *
     * @param {Array.<{layer: Layer, x: number, y: number}>} layerPositions
     * @return {LayerStructure}
     */
    LayerStructure.prototype.repositionLayers = function (layerPositions) {
        var allBounds = Immutable.Map(layerPositions.reduce(function (allBounds, layerData) {
            var layer = this.byID(layerData.layer.id);
            if (layer.bounds) {
                allBounds.set(layer.id, layer.bounds.updatePosition(layerData.x, layerData.y));
            }

            return allBounds;
        }.bind(this), new Map()));

        return this._updateBounds(allBounds);
    };

    /**
     * Repositions and resizes the given layers, setting both their positions and dimensions to be passed in values.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number=} top
     * @param {number=} left
     * @param {number=} width
     * @param {number=} height
     * @return {LayerStructure}
     */
    LayerStructure.prototype.updateBounds = function (layerIDs, top, left, width, height) {
        var allBounds = Immutable.Map(layerIDs.reduce(function (allBounds, layerID) {
            var layer = this.byID(layerID);

            if (layer.bounds) {
                allBounds.set(layerID, layer.bounds.updateSizeAndPosition(top, left, width, height));
            }

            return allBounds;
        }.bind(this), new Map()));

        return this._updateBounds(allBounds);
    };

    /**
     * Translate the given layers, updating their top and left by passed in values.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number=} x
     * @param {number=} y
     * @return {LayerStructure}
     */
    LayerStructure.prototype.translateLayers = function (layerIDs, x, y) {
        var allBounds = Immutable.Map(layerIDs.reduce(function (allBounds, layerID) {
            var layer = this.byID(layerID);
            if (layer.bounds) {
                var newX = layer.bounds.left + x,
                    newY = layer.bounds.top + y;
                allBounds.set(layerID, layer.bounds.updatePosition(newX, newY));
            }

            return allBounds;
        }.bind(this), new Map()));

        return this._updateBounds(allBounds);
    };

    /**
     * Update the selection property to be select iff the layer ID is contained
     * in the given set.
     *
     * @param {Immutable.Set.<number>} selectedIDs
     * @return {LayerStructure}
     */
    LayerStructure.prototype.updateSelection = function (selectedIDs) {
        var updatedLayers = this.layers.map(function (layer) {
            var selected = selectedIDs.has(layer.id);
            return layer.set("selected", selected);
        });

        return this.set("layers", updatedLayers);
    };

    /**
     * Reorder the layers in the given order.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @return {LayerStructure}
     */
    LayerStructure.prototype.updateOrder = function (layerIDs) {
        var updatedIndex = Immutable.List(layerIDs).reverse();
        if (updatedIndex.size > this.layers.size) {
            throw new Error("Too many layers in layer index");
        }

        var updatedLayers;
        if (updatedIndex.size < this.index.size) {
            var deletedLayerIDs = collection.difference(this.index, updatedIndex);
            updatedLayers = this.layers.withMutations(function (layers) {
                deletedLayerIDs.forEach(function (layerID) {
                    layers.delete(layerID);
                });
            });
        } else {
            updatedLayers = this.layers;
        }

        return this.merge({
            index: updatedIndex,
            layers: updatedLayers
        });
    };

    /**
     * Delete the given layer IDs (and reorder the rest)
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @return {LayerStructure}
     */
    LayerStructure.prototype.deleteLayers = function (layerIDs) {
        var remainingLayerIDs = collection.difference(this.index, layerIDs).reverse(),
            remainingLayerStructure = this.updateOrder(remainingLayerIDs);

        var updatedLayers = remainingLayerStructure.layers.withMutations(function (layers) {
            layerIDs.forEach(function (layerID) {
                layers.delete(layerID);
            });
        });

        return remainingLayerStructure.merge({
            layers: updatedLayers
        });
    };

    /**
     * Given IDs of group start and end, and group name, creates a new group.
     * If the group is NOT an artboard, puts all selected layers in the new
     * group. Emulates PS behavior - group gets created at the top most selected layer
     * index. NOTE: If the group IS an artboard then the caller is responsible
     * for correctly reordering the layers after this operation!
     *
     * @param {number} documentID ID of owner document
     * @param {number} groupID ID of group head layer
     * @param {number} groupEndID ID of group end layer
     * @param {string} groupName Name of the group, assigned by Photoshop
     * @param {boolean=} isArtboard
     * @param {object=} boundsDescriptor If creating an artboard, a bounds descriptor is required
     *
     * @return {LayerStructure} Updated layer tree with group added
     */
    LayerStructure.prototype.createGroup = function (documentID, groupID, groupEndID, groupName,
        isArtboard, boundsDescriptor) {
        // Creates the group head and end, needed for any type of group 
        var groupHead = Layer.fromGroupDescriptor(documentID, groupID, groupName, false,
                isArtboard, boundsDescriptor),
            groupEnd = Layer.fromGroupDescriptor(documentID, groupEndID, "", true),
            groupHeadIndex,
            newIDs;
        
        if (isArtboard) {
            groupHeadIndex = this.layers.size - 1;
        } else {
            var layersToMove = this.selectedNormalized.flatMap(this.descendants, this).toOrderedSet(),
                layersToMoveIndices = layersToMove.map(this.indexOf, this),
                layersToMoveIDs = collection.pluck(layersToMove, "id");
            
            groupHeadIndex = this.layers.size - layersToMoveIndices.last();
            
            var newGroupIDs = Immutable.Seq([groupEndID, layersToMoveIDs, groupID]).flatten().reverse(),
                removedIDs = collection
                    .difference(this.index, layersToMoveIDs) // Remove layers being moved
                    .reverse(); // Reverse because we want to slice from the end
            newIDs = removedIDs
                .slice(0, groupHeadIndex) // First chunk is all layers up to top most selected one
                .concat(newGroupIDs) // Then our new group
                 .concat(removedIDs.slice(groupHeadIndex)); // Then the rest
        }

        var updatedLayers = this.layers.withMutations(function (layers) {
                layers.set(groupID, groupHead);
                layers.set(groupEndID, groupEnd);
            }),
            newLayerStructure = this.merge({
                layers: updatedLayers
            });
            
        newLayerStructure = newLayerStructure
            .updateSelection(Immutable.Set.of(groupID));

        if (!isArtboard) {
            newLayerStructure = newLayerStructure.updateOrder(newIDs);
        }

        return newLayerStructure;
    };

    /**
     * Set the border radii of the given layers.
     *
     * @param {Immutable.Iteralble.<number>} layerIDs
     * @param {Radii} radii
     * @return {LayerStructure}
     */
    LayerStructure.prototype.setBorderRadii = function (layerIDs, radii) {
        var nextRadii = new Radii(radii),
            nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
                return map.set(layerID, Immutable.Map({
                    radii: nextRadii
                }));
            }, new Map()));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Set basic properties of the fill of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} fillProperties
     * @return {LayerStructure}
     */
    LayerStructure.prototype.setFillProperties = function (layerIDs, fillProperties) {
        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
            var layer = this.byID(layerID),
                fill = layer.fill;

            if (!fill) {
                throw new Error("Unable to set fill properties: no fill for layer " + layer.name);
            }

            var nextFill = fill.setFillProperties(fillProperties),
                nextLayer = layer.set("fill", nextFill);

            return map.set(layerID, nextLayer);
        }, new Map(), this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Set basic properties of the stroke  of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} strokeProperties
     * @return {LayerStructure}
     */
    LayerStructure.prototype.setStrokeProperties = function (layerIDs, strokeProperties) {
        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
            var layer = this.byID(layerID),
                stroke = layer.stroke;

            if (!stroke) {
                throw new Error("Unable to set stroke properties of layer: " + layer.name);
            }

            var nextStroke = stroke.setStrokeProperties(strokeProperties),
                nextLayer = layer.set("stroke", nextStroke);

            return map.set(layerID, nextLayer);
        }, new Map(), this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Set basic properties of the layerEffect at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number | Immutable.List.<number>} layerEffectIndex index of effect, or per-layer List thereof
     * @param {string} layerEffectType type of layer effect
     * @param {object | Immutable.List.<object>} layerEffectProperties properties to merge, or per-layer List thereof
     * @return {LayerStructure}
     */
    LayerStructure.prototype.setLayerEffectProperties = function (layerIDs,
        layerEffectIndex, layerEffectType, layerEffectProperties) {
        // validate layerEffectType
        if (!Layer.layerEffectTypes.has(layerEffectType)) {
            throw new Error("Invalid layerEffectType supplied");
        }

        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID, index) {
            var layer = this.byID(layerID),
                layerEffects = layer.getLayerEffectsByType(layerEffectType) || Immutable.List(),
                _layerEffectIndex,
                layerEffect,
                nextLayerEffect,
                newProps,
                nextLayer;

            _layerEffectIndex = Immutable.List.isList(layerEffectIndex) ?
                layerEffectIndex.get(index) : layerEffectIndex;
            _layerEffectIndex = Number.isFinite(_layerEffectIndex) ? _layerEffectIndex : layerEffects.size;

            newProps = Immutable.List.isList(layerEffectProperties) ?
                layerEffectProperties.get(index) : layerEffectProperties;
            layerEffect = layerEffects.get(_layerEffectIndex) || Layer.newLayerEffectByType(layerEffectType);
            nextLayerEffect = layerEffect.merge(newProps);
            nextLayer = layer.setLayerEffectByType(layerEffectType, _layerEffectIndex, nextLayerEffect)
                .set("usedToHaveLayerEffect", true);

            return map.set(layerID, nextLayer);
        }.bind(this), new Map()));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Delete properties of the layerEffect at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number} deletedIndex index of effect
     * @param {string} layerEffectType type of layer effect
     * @return {LayerStructure}
     */
    LayerStructure.prototype.deleteLayerEffectProperties = function (layerIDs, deletedIndex, layerEffectType) {
        if (!Layer.layerEffectTypes.has(layerEffectType)) {
            throw new Error("Invalid layerEffectType supplied");
        }

        var nextLayers = this.layers.map(function (layer) {
            var layerEffects = layer.getLayerEffectsByType(layerEffectType);
            var nextLayer = layer;
            var isSelectedLayer = layerIDs.indexOf(layer.id) !== -1;

            if (isSelectedLayer && layerEffects) {
                var nextLayerEffects = layerEffects.filter(function (layerEffect, layerEffectIndex) {
                    return layerEffectIndex !== deletedIndex;
                });
                nextLayer = layer.setLayerEffectsByType(layerEffectType, nextLayerEffects);
            }
            return nextLayer;
        });

        return this.set("layers", nextLayers);
    };

    /**
     * Deletes all the effects of given type in the layers
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {string} layerEffectType
     * @return {LayerStructure} [description]
     */
    LayerStructure.prototype.deleteAllLayerEffects = function (layerIDs, layerEffectType) {
        if (!Layer.layerEffectTypes.has(layerEffectType)) {
            throw new Error("Invalid layerEffectType supplied");
        }

        var nextLayers = this.layers.map(function (layer) {
            var layerEffects = layer.getLayerEffectsByType(layerEffectType);
            var nextLayer = layer;
            var isSelectedLayer = layerIDs.indexOf(layer.id) !== -1;

            if (isSelectedLayer && layerEffects) {
                var nextLayerEffects = Immutable.List();
                nextLayer = layer.setLayerEffectsByType(layerEffectType, nextLayerEffects);
            }
            return nextLayer;
        });

        return this.set("layers", nextLayers);
    };

    /**
     * Set basic text style properties at the given index of the given layers.
     *
     * @private
     * @param {string} styleProperty Either "characterStyle" or "paragraphStyle"
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} properties
     * @return {LayerStructure}
     */
    LayerStructure.prototype._setTextStyleProperties = function (styleProperty, layerIDs, properties) {
        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
            var layer = this.byID(layerID),
                style = layer.text[styleProperty],
                nextStyle = style.merge(properties);

            // .set is used here instead of merge to eliminate the other styles
            var nextText = layer.text.set(styleProperty, nextStyle),
                nextLayer = layer.set("text", nextText);

            return map.set(layerID, nextLayer);
        }, new Map(), this));

        return this.set("layers", this.layers.merge(nextLayers));
    };

    /**
     * Set basic properties of the character style at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} properties
     * @return {LayerStructure}
     */
    LayerStructure.prototype.setCharacterStyleProperties = function (layerIDs, properties) {
        return this._setTextStyleProperties("characterStyle", layerIDs, properties);
    };

    /**
     * Set basic properties of the paragraph style at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} properties
     * @return {LayerStructure}
     */
    LayerStructure.prototype.setParagraphStyleProperties = function (layerIDs, properties) {
        return this._setTextStyleProperties("paragraphStyle", layerIDs, properties);
    };

    module.exports = LayerStructure;
});
