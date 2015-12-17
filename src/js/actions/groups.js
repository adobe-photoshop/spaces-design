/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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
        Immutable = require("immutable"),
        _ = require("lodash");
        
    var artboardLib = require("adapter").lib.artboard,
        descriptor = require("adapter").ps.descriptor,
        documentLib = require("adapter").lib.document,
        layerLib = require("adapter").lib.layer;

    var Layer = require("js/models/layer"),
        collection = require("js/util/collection"),
        layerActions = require("./layers"),
        events = require("../events"),
        locks = require("js/locks"),
        locking = require("js/util/locking"),
        nls = require("js/util/nls"),
        Bounds = require("js/models/bounds");

    var templates = require("static/templates.json");

    var PS_MAX_NEST_DEPTH = 9;

    /**
     * Expand or collapse the given group layers in the layers panel.
     *
     * @param {Document} document
     * @param {Layer|Immutable.Iterable.<Layer>} layers
     * @param {boolean} expand If true, expand the groups. Otherwise, collapse them.
     * @param {boolean=} descendants Whether to expand all descendants of the given layers.
     * @return {Promise}
     */
    var setGroupExpansion = function (document, layers, expand, descendants) {
        if (layers instanceof Layer) {
            layers = Immutable.List.of(layers);
        }

        layers = layers
            .filter(function (layer) {
                return layer.isGroup;
            });

        if (layers.isEmpty()) {
            return Promise.resolve();
        }

        if (descendants) {
            layers = layers.flatMap(document.layers.descendants, document.layers);
        }

        // When collapsing layers, if a visible descendent is selected then the selection
        // is removed and moved up to the collapsing group.
        var layersToSelect = [],
            layersToDeselect = [],
            playObjects = [];

        if (!expand) {
            layers.forEach(function (parent) {
                var selectedDescendants = document.layers.strictDescendants(parent)
                    .filter(function (child) {
                        return child.selected && !document.layers.hasCollapsedAncestor(child);
                    });

                // If there are any selected hidden descendants, deselect the
                // children and select the parent if necessary.
                if (!selectedDescendants.isEmpty()) {
                    layersToDeselect = layersToDeselect.concat(selectedDescendants.toArray());
                    if (!parent.selected) {
                        layersToSelect.push(parent);
                    }
                }
            });

            if (layersToSelect.length > 0) {
                var selectRef = layersToSelect
                    .map(function (layer) {
                        return layerLib.referenceBy.id(layer.id);
                    });

                selectRef.unshift(documentLib.referenceBy.id(document.id));

                var selectObj = layerLib.select(selectRef, false);
                playObjects.push(selectObj);
            }

            if (layersToDeselect.length > 0) {
                var deselectRef = layersToDeselect
                    .map(function (layer) {
                        return layerLib.referenceBy.id(layer.id);
                    });

                deselectRef.unshift(documentLib.referenceBy.id(document.id));

                var deselectObj = layerLib.select(deselectRef, false, "deselect");
                playObjects.push(deselectObj);
            }
        }

        var documentRef = documentLib.referenceBy.id(document.id),
            layerRefs = layers
                .map(function (layer) {
                    return layerLib.referenceBy.id(layer.id);
                })
                .unshift(documentRef)
                .toArray();

        var expandPlayObject = layerLib.setGroupExpansion(layerRefs, !!expand);

        playObjects.push(expandPlayObject);

        var expansionPromise = descriptor.batchPlayObjects(playObjects),
            dispatchPromise = this.dispatchAsync(events.document.SET_GROUP_EXPANSION, {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                selected: collection.pluck(layersToSelect, "id"),
                deselected: collection.pluck(layersToDeselect, "id"),
                expanded: expand
            });

        return Promise.join(expansionPromise, dispatchPromise, function () {
            if (layersToSelect.length > 0) {
                var nextDocument = this.flux.store("document").getDocument(document.id),
                    nextSelected = nextDocument.layers.selected;

                return this.transfer("layers.initializeLayers", nextDocument, nextSelected);
            }
        }.bind(this));
    };
    setGroupExpansion.action = {
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: ["layers.initializeLayers"]
    };

    /**
     * Groups the currently active layers
     * 
     * @param {Document} document 
     * @return {Promise}
     */
    var groupSelected = function (document) {
        var selectedLayers = document.layers.selected;

        // plugin hangs on call with no selection, so for now, we avoid calling it
        if (selectedLayers.size === 0) {
            return Promise.resolve();
        }

        var artboardSelected = selectedLayers.some(function (layer) {
            return layer.isArtboard;
        });
        if (artboardSelected) {
            return Promise.resolve();
        }

        // FIXME: This should just unlock the background layer before proceeding
        if (document.layers.backgroundSelected) {
            return Promise.resolve();
        }

        // Don't let group deeper than 10 levels
        var nestingLimitExceeded = selectedLayers.some(function (layer) {
            return document.layers.maxDescendantDepth(layer) > PS_MAX_NEST_DEPTH;
        });

        if (nestingLimitExceeded) {
            return Promise.resolve();
        }

        return descriptor.playObject(layerLib.groupSelected())
            .bind(this)
            .then(function (groupResult) {
                var payload = {
                    documentID: document.id,
                    groupID: groupResult.layerSectionStart,
                    groupEndID: groupResult.layerSectionEnd,
                    groupname: groupResult.name,
                    history: {
                        newState: true,
                        name: nls.localize("strings.ACTIONS.GROUP_LAYERS")
                    }
                };

                this.dispatch(events.document.history.GROUP_SELECTED, payload);
            });
    };
    groupSelected.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [layerActions._verifyLayerIndex, layerActions._verifyLayerSelection]
    };

    /**
     * Groups the selected layers in the currently active document
     * 
     * @return {Promise}
     */
    var groupSelectedInCurrentDocument = function () {
        var flux = this.flux,
            applicationStore = flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        return this.transfer(groupSelected, currentDocument);
    };
    groupSelectedInCurrentDocument.action = {
        reads: [locks.JS_APP],
        writes: [],
        transfers: [groupSelected]
    };

    /**
     * Ungroups the selected layers in the current document. If only groups are selected,
     * all of their immediate children are moved out and the groups are deleted. Otherwise,
     * if a grouped layer is selected, it is moved out of its parent group, but the parent
     * group is not deleted.
     *
     * @private
     * @param {Document=} document The model of the currently active document
     * @return {Promise}
     */
    var ungroupSelected = function (document) {
        if (!document) {
            var applicationStore = this.flux.store("application");
            document = applicationStore.getCurrentDocument();
        }

        if (!document) {
            return Promise.resolve();
        }

        var documentRef = documentLib.referenceBy.id(document.id),
            layers = document.layers.selectedNormalized,
            hasLeaf = layers.some(function (layer) {
                switch (layer.kind) {
                case Layer.KINDS.GROUP:
                case Layer.KINDS.GROUPEND:
                    return false;
                default:
                    return true;
                }
            });

        // Traverse layers from the top of the z-index to the bottom so that
        // reordering higher layers doesn't affect the z-index of lower layers
        var playObjRec = layers.reverse().reduce(function (playObjRec, layer) {
            var parent = document.layers.parent(layer),
                group = layer.isGroup,
                childLayerRef,
                layerTargetRef,
                targetIndex,
                reorderObj;

            if (group && !hasLeaf) {
                // Move all the children out and then delete the parent group.
                playObjRec.groups.push(layer);

                var children = document.layers.children(layer);
                if (children.size > 1) { // group is non-empty
                    childLayerRef = children
                        .toSeq()
                        .butLast() // omit the groupend
                        .map(function (layer) {
                            return layerLib.referenceBy.id(layer.id);
                        })
                        .toList()
                        .unshift(documentRef)
                        .toArray();

                    targetIndex = document.layers.indexOf(layer);
                    layerTargetRef = layerLib.referenceBy.index(targetIndex);
                    reorderObj = layerLib.reorder(childLayerRef, layerTargetRef);
                    playObjRec.reorderObjects.push(reorderObj);
                }

                var deleteTargetRef = layerLib.referenceBy.id(layer.id),
                    deleteObj = layerLib.delete(deleteTargetRef);

                playObjRec.deleted.add(layer);
                playObjRec.deleteObjects.push(deleteObj);
            } else if (parent) {
                // Move this layer out but leave parent group.
                childLayerRef = [
                    documentRef,
                    layerLib.referenceBy.id(layer.id)
                ];

                targetIndex = document.layers.indexOf(parent);
                layerTargetRef = layerLib.referenceBy.index(targetIndex);
                reorderObj = layerLib.reorder(childLayerRef, layerTargetRef);

                playObjRec.reorderObjects.push(reorderObj);
            }

            return playObjRec;
        }, { reorderObjects: [], deleteObjects: [], deleted: new Set(), groups: [] });

        var playObjects = playObjRec.reorderObjects
                .reverse() // preserves current order when layers are moved to same index
                .concat(playObjRec.deleteObjects),
            options = {
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.UNGROUP_LAYERS"),
                    target: documentLib.referenceBy.id(document.id)
                }
            };

        var deletedDescendants = Immutable.List(playObjRec.deleted)
            .flatMap(function (group) {
                return document.layers.strictDescendants(group);
            })
            .filterNot(function (layer) {
                return layer.isGroupEnd;
            });

        // Restore and augment selection after ungrouping
        var nextSelected = document.layers.selected
            .toSeq()
            .filterNot(playObjRec.deleted.has, playObjRec.deleted)
            .concat(deletedDescendants)
            .toSet();

        var selectionNeedsReset = false;

        if (nextSelected.size > 0) {
            var selectRef = nextSelected
                .map(function (layer) {
                    return layerLib.referenceBy.id(layer.id);
                })
                .toArray();

            selectRef.unshift(documentLib.referenceBy.id(document.id));

            var selectObj = layerLib.select(selectRef, false, "select");
            playObjects.push(selectObj);
        } else {
            selectionNeedsReset = true;
            // TODO: Add smart selection reset here, after we figure out
            // what Photoshop does, and remove the last link of the return chain below
        }

        var lockList = Immutable.List(playObjRec.groups);
        return locking.playWithLockOverride(document, lockList, playObjects, options, true)
            .bind(this)
            .then(function () {
                return this.transfer("layers.getLayerIDsForDocumentID", document.id);
            })
            .then(function (payload) {
                payload.selectedIDs = collection.pluck(nextSelected, "id");
                payload.history = {
                    newState: true,
                    amendRogue: true
                };

                this.dispatch(events.document.history.UNGROUP_SELECTED, payload);
            })
            .then(function () {
                if (selectionNeedsReset) {
                    return this.transfer("layers.resetSelection", document);
                } else {
                    var nextDocument = this.flux.store("document").getDocument(document.id),
                        selected = nextDocument.layers.selected;

                    return this.transfer("layers.initializeLayers", nextDocument, selected);
                }
            });
    };
    ungroupSelected.action = {
        reads: [locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: ["layers.resetSelection", "layers.initializeLayers", "layers.getLayerIDsForDocumentID"],
        post: [layerActions._verifyLayerIndex, layerActions._verifyLayerSelection]
    };

    /**
     * Default Artboard size 
     * @const 
     *
     * @type {object} 
     */
    var DEFAULT_ARTBOARD_BOUNDS = {
        bottom: 1960,
        top: 0,
        right: 1080,
        left: 0
    };

    /**
     * Helper function to find the right most artboard. It assumes a non-empty list of artboards. 
     * 
     * @private 
     * @param {Immutable.List.<Layer>} artboards
     * @return {Layer}
     */
    var _findRightMostArtboard = function (artboards) {
        var layer = artboards.reduce(function (selectedLayer, currentLayer) {
            if (currentLayer.bounds.right > selectedLayer.bounds.right) {
                return currentLayer;
            } else {
                return selectedLayer;
            }
        }, artboards.first());
        return layer;
    };

    /**
     * Helper function to get Bounds from specs (template preset)
     *
     * @private
     * @param {object} specs 
     * @param {Immutable.List.<Layer>} artboards
     * @return {{finalBounds: Bounds, changeLayerRef: boolean}}
     */
    var _getBoundsFromTemplate = function (specs, artboards) {
        var preset = specs.preset,
            index = _.findIndex(templates, function (obj) {
                return obj.preset === preset;
            });

        var height = templates[index].height,
            width = templates[index].width,
            changeLayerRef = false,
            finalBounds;

        // if artboards are empty, insert template at first position 
        if (artboards.isEmpty()) {
            changeLayerRef = true;
            finalBounds = new Bounds({
                top: DEFAULT_ARTBOARD_BOUNDS.top,
                bottom: height,
                left: DEFAULT_ARTBOARD_BOUNDS.left,
                right: width
            });
        } else {
            // find the rightmost artboard and insert the template after this 
            var rightMostLayer = _findRightMostArtboard(artboards),
                offset = 100;
            finalBounds = rightMostLayer.bounds.merge({
                bottom: rightMostLayer.bounds.top + height,
                left: rightMostLayer.bounds.left + offset + rightMostLayer.bounds.width,
                right: rightMostLayer.bounds.right + offset + width
            });
        }

        return {
            finalBounds: finalBounds,
            changeLayerRef: changeLayerRef
        };
    };

    /**
     * Helper function to get the bounds of an artboard with no prior input
     * 
     * @private
     * @param {Immutable.List.<Layer>} artboards
     * @param {Immutable.List.<Layer>} selectedArtboards 
     * @return {{finalBounds: Bounds, changeLayerRef: boolean}}
     */
    var _getBoundsFromNoInput = function (artboards, selectedArtboards) {
        var changeLayerRef = false,
            finalBounds;

        // if there are no artboards in the document, the new artboard should have dimensions of default
        if (artboards.isEmpty()) {
            changeLayerRef = true;
            finalBounds = new Bounds({
                top: DEFAULT_ARTBOARD_BOUNDS.top,
                bottom: DEFAULT_ARTBOARD_BOUNDS.bottom,
                left: DEFAULT_ARTBOARD_BOUNDS.left,
                right: DEFAULT_ARTBOARD_BOUNDS.right
            });
        } else {
            // else we want to get the right most artboard 
            var rightMostLayer = _findRightMostArtboard(artboards),
                offset = 100;
            // if there is a selected artboard, we want the new one to inherit the size of the selected
            if (selectedArtboards.size === 1) {
                var selectedbounds = selectedArtboards.first().bounds;
                finalBounds = rightMostLayer.bounds.merge({
                    bottom: rightMostLayer.bounds.top + selectedbounds.height,
                    left: rightMostLayer.bounds.left + rightMostLayer.bounds.width + offset,
                    right: rightMostLayer.bounds.right + offset + selectedbounds.width
                });
            } else {
                // else we want it to insert after the right most artboard with default size 
                finalBounds = rightMostLayer.bounds.merge({
                    bottom: rightMostLayer.bounds.top + DEFAULT_ARTBOARD_BOUNDS.bottom,
                    left: rightMostLayer.bounds.left + rightMostLayer.bounds.width + offset,
                    right: rightMostLayer.bounds.right + offset + DEFAULT_ARTBOARD_BOUNDS.right
                });
            }
        }

        return {
            finalBounds: finalBounds,
            changeLayerRef: changeLayerRef
        };
    };

    /**
     * Create a new Artboard on the PS doc
     * if no bounds are provided we place this 100 px to the right of selected artboard 
     * or we add a default sized "iphone" artboard otherwise passed in bounds are used
     *
     * @param {Bounds=|object=} boundsOrSpecs
     * @return {Promise}
     */
    var createArtboard = function (boundsOrSpecs) {
        var document = this.flux.store("application").getCurrentDocument(),
            artboards = document.layers.all.filter(function (layer) {
                return layer.isArtboard;
            }),
            selectedArtboards = document.layers.selected.filter(function (layer) {
                return layer.isArtboard;
            }),
            layerRef = layerLib.referenceBy.none,
            boundsAndLayerRef,
            finalBounds,
            artboardLayerId;

        if (boundsOrSpecs instanceof Bounds) {
            finalBounds = boundsOrSpecs.toJS();
        } else if (boundsOrSpecs === undefined) {
            boundsAndLayerRef = _getBoundsFromNoInput(artboards, selectedArtboards);
            finalBounds = boundsAndLayerRef.finalBounds.toJS();
            if (boundsAndLayerRef.changeLayerRef) {
                layerRef = layerLib.referenceBy.current;
            }
        } else {
            boundsAndLayerRef = _getBoundsFromTemplate(boundsOrSpecs, artboards);
            finalBounds = boundsAndLayerRef.finalBounds.toJS();
            if (boundsAndLayerRef.changeLayerRef) {
                layerRef = layerLib.referenceBy.current;
            }
        }

        var backgroundLayer = document.layers.all.find(function (layer) {
            return layer.isBackground;
        });

        var unlockBackgroundPromise = backgroundLayer ?
            this.transfer("layers.unlockBackgroundLayer", document, backgroundLayer) :
            Promise.resolve();

        return unlockBackgroundPromise
            .bind(this)
            .then(function () {
                var createObj = artboardLib.make(layerRef, finalBounds);

                return descriptor.playObject(createObj);
            })
            .then(function (result) {
                // Photoshop may have used different bounds for the artboard
                if (result.artboardRect) {
                    finalBounds = result.artboardRect;
                }

                artboardLayerId = result.layerSectionStart;

                var payload = {
                    documentID: document.id,
                    groupID: result.layerSectionStart,
                    groupEndID: result.layerSectionEnd,
                    groupname: result.name,
                    isArtboard: true,
                    bounds: finalBounds,
                    // don't redraw UI until after resetting the index
                    suppressChange: true,
                    history: {
                        newState: true,
                        name: nls.localize("strings.ACTIONS.CREATE_ARTBOARD")
                    }
                };

                return this.dispatchAsync(events.document.history.GROUP_SELECTED, payload);
            })
            .then(function () {
                return this.transfer("layers.resetIndex", document);
            })
            .then(function () {
                return this.transfer("export.addDefaultAsset", document.id, artboardLayerId);
            });
    };
    createArtboard.action = {
        reads: [locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: ["layers.resetIndex", "export.addDefaultAsset", "layers.unlockBackgroundLayer"],
        post: [layerActions._verifyLayerIndex, layerActions._verifyLayerSelection,
            layerActions._verifySelectedBounds]
    };

    exports.groupSelected = groupSelected;
    exports.groupSelectedInCurrentDocument = groupSelectedInCurrentDocument;
    exports.ungroupSelected = ungroupSelected;
    exports.createArtboard = createArtboard;
    exports.setGroupExpansion = setGroupExpansion;
});
