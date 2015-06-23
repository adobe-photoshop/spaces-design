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
        Immutable = require("immutable"),
        _ = require("lodash");
        
    var photoshopEvent = require("adapter/lib/photoshopEvent"),
        artboardLib = require("adapter/lib/artboard"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer"),
        OS = require("adapter/os");

    var Layer = require("js/models/layer"),
        collection = require("js/util/collection"),
        documentActions = require("js/actions/documents"),
        log = require("js/util/log"),
        events = require("../events"),
        shortcuts = require("./shortcuts"),
        layerActionsUtil = require("js/util/layeractions"),
        locks = require("js/locks"),
        locking = require("js/util/locking"),
        headlights = require("js/util/headlights"),
        strings = require("i18n!nls/strings");

    var PS_MAX_NEST_DEPTH = 9;

    /**
     * @private
     * @type {Array.<string>} Properties to be included when requesting layer
     * descriptors from Photoshop.
     */
    var _layerProperties = [
        "layerID",
        "name",
        "visible",
        "layerLocking",
        "itemIndex",
        "background",
        "boundsNoEffects",
        "opacity",
        "layerFXVisible",
        "mode"
    ];

    /**
     * @private
     * @type {Array.<string>} Properties to be included if present when requesting
     * layer descriptors from Photoshop.
     */
    var _optionalLayerProperties = [
        "adjustment",
        "AGMStrokeStyleInfo",
        "textKey",
        "layerKind",
        "keyOriginType",
        "fillEnabled",
        "fillOpacity",
        "layerEffects",
        "proportionalScaling",
        "artboard",
        "artboardEnabled",
        "pathBounds",
        "smartObject",
        "globalAngle"
    ];

    /**
     * Get layer descriptors for the given layer references. Only the
     * properties listed in the arrays above will be included for performance
     * reasons. NOTE: All layer references must reference the same document.
     * 
     * @private
     * @param {Array.<object>} references
     * @return {Promise.<Array.<object>>}
     */
    var _getLayersByRef = function (references) {
        var layerPropertiesPromise = descriptor.batchMultiGetProperties(references, _layerProperties),
            optionalPropertiesPromise = descriptor.batchMultiGetProperties(references, _optionalLayerProperties,
                { continueOnError: true });

        return Promise.join(layerPropertiesPromise, optionalPropertiesPromise,
            function (required, optional) {
                return _.zipWith(required, optional, _.merge);
            });
    };

    /**
     * Get all layer descriptors for the given document reference. Only the
     * properties listed in the arrays above will be included for performance
     * reasons.
     * 
     * @private
     * @param {object} docRef A document reference
     * @param {number} startIndex 
     * @return {Promise.<Array.<object>>}
     */
    var _getLayersForDocumentRef = function (docRef, startIndex) {
        var rangeOpts = {
            range: "layer",
            index: startIndex,
            count: -1
        };

        var requiredPropertiesPromise = descriptor.getPropertiesRange(docRef, rangeOpts, _layerProperties, {
            failOnMissingProperty: true
        });

        var optionalPropertiesPromise = descriptor.getPropertiesRange(docRef, rangeOpts, _optionalLayerProperties, {
            failOnMissingProperty: false
        });

        return Promise.join(requiredPropertiesPromise, optionalPropertiesPromise, function (required, optional) {
            return _.chain(required).zipWith(optional, _.merge).reverse().value();
        });
    };

    /**
     * Get the ordered list of layer IDs for the given Document ID.
     *
     * @private
     * @param {number} documentID
     * @return {Promise.<{documentID: number, layerIDs: Array.<number>}>}
     */
    var _getLayerIDsForDocumentID = function (documentID) {
        var _getLayerIDs = function (doc) {
            var docRef = documentLib.referenceBy.id(documentID),
                startIndex = (doc.hasBackgroundLayer ? 0 : 1),
                rangeOpts = {
                    range: "layer",
                    index: startIndex,
                    count: -1
                };
            
            return descriptor.getPropertyRange(docRef, rangeOpts, "layerID");
        };

        var documentRef = documentLib.referenceBy.id(documentID);
        return documentActions._getDocumentByRef(documentRef, ["hasBackgroundLayer"], [])
            .bind(this)
            .then(_getLayerIDs)
            .then(function (layerIDs) {
                return {
                    documentID: documentID,
                    layerIDs: layerIDs.reverse()
                };
            });
    };

    /**
     * Verify the correctness of the list of layer IDs.
     *
     * @private
     * @return {Promise} Rejects if the number or order of layer IDs in the
     *  active document differs from Photoshop.
     */
    var _verifyLayerIndex = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        return _getLayerIDsForDocumentID(currentDocument.id)
            .bind(this)
            .then(function (payload) {
                var layerIDs = payload.layerIDs;

                if (currentDocument.layers.all.size !== layerIDs.length) {
                    throw new Error("Incorrect layer count: " + currentDocument.layers.all.size +
                        " instead of " + layerIDs.length);
                } else {
                    layerIDs.reverse();
                    currentDocument.layers.index.forEach(function (layerID, index) {
                        if (layerID !== layerIDs[index]) {
                            throw new Error("Incorrect layer ID at index " + index + ": " + layerID +
                                " instead of " + layerIDs[index]);
                        }
                    });
                }
            });
    };

    /**
     * Verify the correctness of the layer selection.
     *
     * @private
     * @return {Promise} Rejects if set of selected layer IDs differs from
     *  Photoshop.
     */
    var _verifyLayerSelection = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }
        
        var documentRef = documentLib.referenceBy.current;
        return documentActions._getDocumentByRef(documentRef, ["targetLayers"], [])
            .bind(this)
            .then(function (payload) {
                var targetLayers = payload.targetLayers.map(function (targetLayer) {
                    return targetLayer._index;
                });

                if (currentDocument.layers.selected.size !== targetLayers.length) {
                    throw new Error("Incorrect selected layer count: " + currentDocument.layers.selected.size +
                        " instead of " + targetLayers.length);
                } else {
                    targetLayers.forEach(function (targetLayerIndex) {
                        var layer = currentDocument.layers.byIndex(targetLayerIndex + 1);
                        if (!layer.selected) {
                            throw new Error("Missing layer selection at index " + targetLayerIndex);
                        }
                    });
                }
            }, function () {
                if (currentDocument.layers.selected.size > 0) {
                    throw new Error("Incorrect selected layer count: " + currentDocument.layers.selected.size +
                        " instead of " + 0);
                }
            });
    };

    /**
     * Emit an ADD_LAYER event with the layer ID, descriptor, index, whether
     * it should be selected, and whether the existing layer should be replaced.
     *
     * If `replace` is  unspecified, an existing single selected layer will only be replaced if it is an empty
     * non-background layer.  If a number is specified, that layer ID will be replaced.
     * If false, no replacement will take place.
     *
     * @param {Document} document
     * @param {number|Array.<number>} layerSpec
     * @param {boolean=} selected Default is true
     * @param {boolean= || number=} replace replace the layer with this ID, or use default logic if undefined
     * @return {Promise}
     */
    var addLayersCommand = function (document, layerSpec, selected, replace) {
        if (typeof layerSpec === "number") {
            layerSpec = [layerSpec];
        }

        if (selected === undefined) {
            selected = true;
        }

        var layerRefs = layerSpec.map(function (layerID) {
            return [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.id(layerID)
            ];
        });

        return _getLayersByRef(layerRefs)
            .bind(this)
            .then(function (descriptors) {
                var payload = {
                    documentID: document.id,
                    layerIDs: layerSpec,
                    descriptors: descriptors,
                    selected: selected,
                    replace: replace
                };

                this.dispatch(events.document.history.nonOptimistic.ADD_LAYERS, payload);
            });
    };


    /**
     * Get a list of selected layer indexes from photoshop, based on the provided document
     *
     * @private
     * @param {Document} document
     * @return {Promise.<Array.<number>>} A promised array of layer indexes
     */
    var _getSelectedLayerIndices = function (document) {
        return descriptor.getProperty(documentLib.referenceBy.id(document.id), "targetLayers")
            .catch(function () {
                // no targetLayers property means no document is open
                return [];
            })
            .then(function (targetLayers) {
                return _.pluck(targetLayers, "_index");
            });
    };

    /**
     * Resets the list of selected layers by asking photoshop for targetLayers
     *
     * @param {Document} document document of which to reset layers
     * @return {Promise}
     */
    var resetSelectionCommand = function (document) {
        var payload = {
            documentID: document.id
        };

        return _getSelectedLayerIndices(document)
            .bind(this)
            .then(function (selectedLayerIndices) {
                payload.selectedIndices = selectedLayerIndices;
                this.dispatch(events.document.SELECT_LAYERS_BY_INDEX, payload);
            });
    };

    /**
     * Emit RESET_LAYERS with layer descriptors for all given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {Promise}
     */
    var resetLayersCommand = function (document, layers) {
        var layerRefs = layers.map(function (layer) {
            return [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.id(layer.id)
            ];
        }).toArray();

        return _getLayersByRef(layerRefs)
            .bind(this)
            .then(function (descriptors) {
                var index = 0, // annoyingly, Immutable.Set.prototype.forEach does not provide an index
                    payload = {
                        documentID: document.id
                    };

                payload.layers = layers.map(function (layer) {
                    return {
                        layerID: layer.id,
                        descriptor: descriptors[index++]
                    };
                });
                this.dispatch(events.document.RESET_LAYERS, payload);
            });
    };

    /**
     * Calls reset on all smart object layers of the document
     * Depending on speed we can improve this by only resetting 
     * linked smart objects, or only resetting their boundaries
     *
     * @param {Document} document [description]
     * @return {Promise}
     */
    var resetLinkedLayersCommand = function (document) {
        if (!document) {
            return Promise.resolve();
        }

        var linkedLayers = document.layers.all.filter(function (layer) {
            return layer.kind === layer.layerKinds.SMARTOBJECT;
        });

        if (linkedLayers.isEmpty()) {
            return Promise.resolve();
        }
        return this.transfer(resetBounds, document, linkedLayers, true);
    };

    /**
     * Emit RESET_LAYERS_BY_INDEX with layer descriptors for all given layer indexes.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<number> | number} layerIndexes
     */
    var resetLayersByIndexCommand = function (document, layerIndexes) {
        var indexList = Immutable.Iterable.isIterable(layerIndexes) ? layerIndexes : Immutable.List.of(layerIndexes);

        var layerRefs = indexList.map(function (idx) {
            // adjust the index based on the existence of a background layer in the document
            var index = document.hasBackgroundLayer ? (idx - 1) : idx;

            return [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.index(index)
            ];
        }).toArray();

        return _getLayersByRef(layerRefs)
            .bind(this)
            .then(function (descriptors) {
                var payload = {
                        documentID: document.id,
                        descriptors: descriptors
                    };
                this.dispatch(events.document.RESET_LAYERS_BY_INDEX, payload);
            });
    };

    /**
     * Emit a RESET_BOUNDS with bounds descriptors for the given layers.
     * Based on noHistory, emit the correct flavor of event
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {boolean=} noHistory Optional. If true, emit an event that does NOT change history
     * @return {Promise}
     */
    var resetBoundsCommand = function (document, layers, noHistory) {
        var propertyRefs = layers.map(function (layer) {
            var property;
            if (layer.isArtboard) {
                property = "artboard";
            } else if (layer.kind === layer.layerKinds.VECTOR) {
                property = "pathBounds";
            } else {
                property = "boundsNoEffects";
            }
            return [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.id(layer.id),
                {
                    _ref: "property",
                    _property: property
                }
            ];
        }).toArray();

        return descriptor.batchGet(propertyRefs)
            .bind(this)
            .then(function (bounds) {
                var index = 0, // annoyingly, Immutable.Set.prototype.forEach does not provide an index
                    payload = {
                        documentID: document.id
                    };

                payload.bounds = layers.map(function (layer) {
                    return {
                        layerID: layer.id,
                        descriptor: bounds[index++]
                    };
                });

                if (noHistory) {
                    this.dispatch(events.document.RESET_BOUNDS, payload);
                } else {
                    this.dispatch(events.document.history.nonOptimistic.RESET_BOUNDS, payload);
                }
            });
    };

    /**
     * Selects the given layer with given modifiers
     *
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a single layer that
     *  the selection is based on, or an array of such layers
     * @param {string} modifier Way of modifying the selection. Possible values
     *  are defined in `adapter/lib/layer.js` under `select.vals`
     *
     * @returns {Promise}
     */
    var selectLayerCommand = function (document, layerSpec, modifier) {
        if (layerSpec instanceof Layer) {
            layerSpec = Immutable.List.of(layerSpec);
        }

        if (document.unsupported) {
            return Promise.resolve();
        }

        var payload = {
            documentID: document.id
        };

        // TODO: Dispatch optimistically here for the other modifiers, and
        // eventually remove SELECT_LAYERS_BY_INDEX.
        var dispatchPromise = Promise.resolve();
        if (!modifier || modifier === "select") {
            payload.selectedIDs = collection.pluck(layerSpec, "id");
            dispatchPromise = this.dispatchAsync(events.document.SELECT_LAYERS_BY_ID, payload);
        }

        var layerRef = layerSpec
            .map(function (layer) {
                return layerLib.referenceBy.id(layer.id);
            })
            .unshift(documentLib.referenceBy.id(document.id))
            .toArray();

        var selectObj = layerLib.select(layerRef, false, modifier),
            selectPromise = descriptor.playObject(selectObj)
                .bind(this)
                .then(function () {
                    if (modifier && modifier !== "select") {
                        return this.transfer(resetSelection, document);
                    }
                });

        return Promise.join(dispatchPromise, selectPromise);
    };

    /**
     * Renames the given layer
     *
     * @param {Document} document Owner document
     * @param {Layer} layer Layer to be renamed
     * @param {string} newName What to rename the layer
     * 
     * @returns {Promise}
     */
    var renameLayerCommand = function (document, layer, newName) {
        var payload = {
            documentID: document.id,
            layerID: layer.id,
            name: newName
        };

        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.RENAME_LAYER, payload),
            layerRef = [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.id(layer.id)
            ],
            renameObj = layerLib.rename(layerRef, newName),
            renamePromise = descriptor.playObject(renameObj);

        return Promise.join(dispatchPromise, renamePromise);
    };

    /**
     * Deselects all layers in the given document, or in the current document if none is provided.
     * 
     * @param {document=} document
     * @returns {Promise}
     */
    var deselectAllLayersCommand = function (document) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        // If document doesn't exist, or is a flat document
        if (!document || document.unsupported || document.layers.all.size === 1 &&
            document.layers.all.first().isBackground) {
            return Promise.resolve();
        }

        var payload = {
            documentID: document.id,
            selectedIDs: []
        };

        // FIXME: The descriptor below should be specific to the document ID
        var deselectPromise = descriptor.playObject(layerLib.deselectAll()),
            dispatchPromise = this.dispatchAsync(events.document.SELECT_LAYERS_BY_ID, payload);

        return Promise.join(dispatchPromise, deselectPromise);
    };

    /**
     * Selects all layers in the given document, or in the current document if none is provided.
     * 
     * @param {document=} document
     * @returns {Promise}
     */
    var selectAllLayersCommand = function (document) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        // If document doesn't exist, or is a flat document
        if (!document || document.unsupported || document.layers.all.isEmpty()) {
            return Promise.resolve();
        }

        return this.transfer(selectLayer, document, document.layers.allVisible);
    };

    /**
     * Deletes the selected layers in the given document, or in the current document if none is provided
     *
     * @param {?document} document
     * @return {Promise}
     */
    var deleteSelectedLayersCommand = function (document) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }
        
        // If there is no doc, a flat doc, or all layers are going to be deleted, cancel
        if (!document || document.unsupported || document.layers.all.isEmpty() ||
            !document.layers.selectedLayersDeletable) {
            return Promise.resolve();
        }

        var documentID = document.id,
            layers = document.layers.allSelected,
            layerIDs = collection.pluck(layers, "id"),
            deletePlayObject = layerLib.delete(layerLib.referenceBy.current),
            payload = {
                documentID: documentID,
                layerIDs: layerIDs
            },
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.DELETE_LAYERS,
                    target: documentLib.referenceBy.id(documentID)
                }
            };

        return locking.playWithLockOverride(document, layers, deletePlayObject, options, true)
            .bind(this)
            .then(_.wrap(document, _getSelectedLayerIndices))
            .then(function (selectedLayerIndices) {
                payload.selectedIndices = selectedLayerIndices;
                return this.dispatchAsync(events.document.history.nonOptimistic.DELETE_LAYERS, payload);
            });
    };

    /**
     * Groups the currently active layers
     * 
     * @param {Document} document 
     * @return {Promise}
     */
    var groupSelectedLayersCommand = function (document) {
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
                    groupname: groupResult.name
                };

                this.dispatch(events.document.history.optimistic.GROUP_SELECTED, payload);
            });
    };

    /**
     * Groups the selected layers in the currently active document
     * 
     * @return {Promise}
     */
    var groupSelectedLayersInCurrentDocumentCommand = function () {
        var flux = this.flux,
            applicationStore = flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        return this.transfer(groupSelected, currentDocument);
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
    var ungroupSelectedCommand = function (document) {
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
                case layer.layerKinds.GROUP:
                case layer.layerKinds.GROUPEND:
                    return false;
                default:
                    return true;
                }
            });

        // Traverse layers from the top of the z-index to the bottom so that
        // reordering higher layers doesn't affect the z-index of lower layers
        var playObjRec = layers.reverse().reduce(function (playObjRec, layer) {
            var parent = document.layers.parent(layer),
                group = layer.kind === layer.layerKinds.GROUP,
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
                    name: strings.ACTIONS.UNGROUP_LAYERS,
                    target: documentLib.referenceBy.id(document.id)
                }
            };

        var deletedDescendants = Immutable.List(playObjRec.deleted)
            .flatMap(function (group) {
                return document.layers.strictDescendants(group);
            })
            .filterNot(function (layer) {
                return layer.kind === layer.layerKinds.GROUPEND;
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
            .then(_getLayerIDsForDocumentID.bind(this, document.id))
            .then(function (payload) {
                payload.selectedIDs = collection.pluck(nextSelected, "id");

                this.dispatch(events.document.history.nonOptimistic.UNGROUP_SELECTED, payload);
            })
            .then(function () {
                if (selectionNeedsReset) {
                    this.transfer(resetSelection, document);
                }
            });
    };

    /**
     * Changes the visibility of layer
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {boolean} visible Whether to show or hide the layer

     * @returns {Promise}
     */
    var setVisibilityCommand = function (document, layer, visible) {
        var payload = {
                documentID: document.id,
                layerID: layer.id,
                visible: visible
            },
            command = visible ? layerLib.show : layerLib.hide,
            layerRef = [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.id(layer.id)
            ];

        var dispatchPromise = this.dispatchAsync(events.document.VISIBILITY_CHANGED, payload),
            visibilityPromise = descriptor.playObject(command.apply(this, [layerRef]));

        return Promise.join(dispatchPromise, visibilityPromise);
    };

    /**
     * Unlocks the background layer of the document
     * FIXME: Does not care about the document reference
     *
     * @param {Document} document
     * @param {Layer} layer
     * @returns {Promise}
     */
    var _unlockBackgroundLayer = function (document, layer) {
        return descriptor.playObject(layerLib.unlockBackground(layer.id))
            .bind(this)
            .then(function (event) {
                var layerID = event.layerID;
                return this.transfer(addLayers, document, layerID, true, layer.id);
            });
    };

    /**
     * Changes the lock state of layer
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {boolean} locked Whether all properties of layer is to be locked
     *
     * @returns {Promise}
     */
    var setLockingCommand = function (document, layer, locked) {
        var payload = {
                documentID: document.id,
                layerID: layer.id,
                locked: locked
            },
            layerRef = [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.id(layer.id)
            ];

        if (layer.isBackground) {
            return _unlockBackgroundLayer.call(this, document, layer);
        } else {
            var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.LOCK_CHANGED, payload),
                lockPromise = descriptor.playObject(layerLib.setLocking(layerRef, locked));

            return Promise.join(dispatchPromise, lockPromise);
        }
    };

    /**
     * Set the opacity of the given layers.
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {number} opacity Opacity as a percentage
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var setOpacityCommand = function (document, layers, opacity, coalesce) {
        var payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                opacity: opacity,
                coalesce: !!coalesce
            },
            playObjects = layers.map(function (layer) {
                var layerRef = [
                    documentLib.referenceBy.id(document.id),
                    layerLib.referenceBy.id(layer.id)
                ];

                return layerLib.setOpacity(layerRef, opacity);
            }),
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.CHANGE_LAYER_OPACITY,
                    target: documentLib.referenceBy.id(document.id),
                    coalesce: !!coalesce,
                    suppressHistoryStateNotification: !!coalesce
                },
                paintOptions: {
                    immediateUpdate: true,
                    quality: "draft"
                }
            };

        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.OPACITY_CHANGED, payload),
            opacityPromise = locking.playWithLockOverride(document, layers, playObjects.toArray(), options);

        return Promise.join(dispatchPromise, opacityPromise);
    };

    /**
     * Set the lock status of the selected layers in the current document as
     * specified.
     * 
     * @param {boolean} locked Whether to lock or unlock the selected layers
     * @return {Promise}
     */
    var _setLockingInCurrentDocument = function (locked) {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        var lockPromises = currentDocument.layers.selected.map(function (layer) {
            return this.transfer(setLocking, currentDocument, layer, locked);
        }, this).toArray();

        return Promise.all(lockPromises);
    };

    /**
     * Lock the selected layers in the current document.
     * 
     * @return {Promise}
     */
    var lockSelectedInCurrentDocumentCommand = function () {
        return _setLockingInCurrentDocument.call(this, true);
    };

    /**
     * Unlock the selected layers in the current document.
     * 
     * @return {Promise}
     */
    var unlockSelectedInCurrentDocumentCommand = function () {
        return _setLockingInCurrentDocument.call(this, false);
    };

    /**
     * Moves the given layers to their given position
     * In Photoshop images, targetIndex 0 means bottom of the document, and will throw if
     * it is a background layer, targetIndex n, where n is the number of layers, means top of the 
     * document. Hidden endGroup layers also count in the index, and are used to tell between whether
     * to put next to the group, or inside the group as last element
     *
     * @param {Document} document Document for which layers should be reordered
     * @param {number|Immutable.Iterable.<number>} layerSpec Either an ID of single layer that
     *  the selection is based on, or an array of such layer IDs
     * @param {number} targetIndex Target index where to drop the layers
     *
     * @return {Promise} Resolves to the new ordered IDs of layers as well as what layers should be selected
     *, or rejects if targetIndex is invalid, as example when it is a child of one of the layers in layer spec
     **/
    var reorderLayersCommand = function (document, layerSpec, targetIndex) {
        if (!Immutable.Iterable.isIterable(layerSpec)) {
            layerSpec = Immutable.List.of(layerSpec);
        }

        var documentRef = documentLib.referenceBy.id(document.id),
            layerRef = layerSpec
                .map(function (layerID) {
                    return layerLib.referenceBy.id(layerID);
                })
                .unshift(documentRef)
                .toArray();

        var targetRef = layerLib.referenceBy.index(targetIndex),
            reorderObj = layerLib.reorder(layerRef, targetRef),
            reorderPromise = descriptor.playObject(reorderObj);
      
        return reorderPromise
            .then(this.transfer.bind(this, getLayerOrder, document));
    };

    /**
     * Updates our layer information based on the current document 
     *
     * @param {Document} document Document for which layers should be reordered
     * @param {boolean=} suppressHistory if truthy, dispatch a non-history-changing event.
     * @return {Promise} Resolves to the new ordered IDs of layers as well as what layers should be selected
     **/
    var getLayerOrderCommand = function (document, suppressHistory) {
        return _getLayerIDsForDocumentID.call(this, document.id)
            .then(function (payload) {
                return _getSelectedLayerIndices(document).then(function (selectedIndices) {
                        payload.selectedIndices = selectedIndices;
                        return payload;
                    });
            })
            .then(function (payload) {
                if (suppressHistory) {
                    return this.dispatchAsync(events.document.REORDER_LAYERS, payload);
                } else {
                    return this.dispatchAsync(events.document.history.optimistic.REORDER_LAYERS, payload);
                }
            });
    };

    /**
     * Set the blend mode of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {string} mode Blend mode ID
     * @return {Promise}
     */
    var setBlendModeCommand = function (document, layers, mode) {
        var documentRef = documentLib.referenceBy.id(document.id),
            layerIDs = collection.pluck(layers, "id"),
            layerRef = layerIDs
                .map(function (layerID) {
                    return layerLib.referenceBy.id(layerID);
                })
                .unshift(documentRef)
                .toArray(),
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.SET_BLEND_MODE,
                    target: documentLib.referenceBy.id(document.id)
                }
            };

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            mode: mode
        };

        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.BLEND_MODE_CHANGED, payload),
            blendPromise = locking.playWithLockOverride(document, layers,
                layerLib.setBlendMode(layerRef, mode), options);

        return Promise.join(dispatchPromise, blendPromise);
    };

    /**
     * Sets the given layers' proportional flag
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {boolean=} proportional make the size change proportionally 
     *
     * @returns {Promise}
     */
    var setProportionalCommand = function (document, layerSpec, proportional) {
        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.kind === layer.layerKinds.GROUPEND;
        });

        var layerIDs = collection.pluck(layerSpec, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                proportional: proportional
            },
            options = {
                paintOptions: {
                    immediateUpdate: true,
                    quality: "draft"
                },
                historyStateInfo: {
                    name: strings.ACTIONS.SET_PROPORTIONAL_SCALE,
                    target: documentLib.referenceBy.id(document.id)
                }
            };

        var dispatchPromise = Promise.bind(this).then(function () {
            this.dispatch(events.document.history.optimistic.SET_LAYERS_PROPORTIONAL, payload);
        });

        var layerPlayObjects = layerSpec.map(function (layer) {
            var layerRef = layerLib.referenceBy.id(layer.id),
            proportionalObj = layerLib.setProportionalScaling(layerRef, proportional);

            return {
                layer: layer,
                playObject: proportionalObj
            };
        }, this);

        var sizePromise = layerActionsUtil.playLayerActions(document, layerPlayObjects, true, options);

        return Promise.join(dispatchPromise, sizePromise);
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
     * Create a new Artboard on the PS doc
     * if no bounds are provided we place this 100 px to the right of selected artboard 
     * or we add a default sized "iphone" artboard 
     * otherwise passed in bounds are used
     *
     * @param {Bounds?} artboardBounds where to place the new artboard
     * @return {Promise}
     */
    var createArtboardCommand = function (artboardBounds) {
        var document = this.flux.store("application").getCurrentDocument(),
            artboards = document.layers.all.filter(function (layer) {
                return layer.isArtboard;
            }),
            layerRef = layerLib.referenceBy.none,
            finalBounds;

        if (artboardBounds !== undefined) {
            finalBounds = artboardBounds.toJS();
        } else if (artboards.isEmpty()) {
            // If there are no artboards selected, use current selection
            layerRef = layerLib.referenceBy.current;
            finalBounds = DEFAULT_ARTBOARD_BOUNDS;
        } else {
            var layer = artboards.reduce(function (selectedLayer, currentLayer) {
                if (currentLayer.bounds.right > selectedLayer.bounds.right) {
                    return currentLayer;
                } else {
                    return selectedLayer;
                }
            }, artboards.first());

            var offset = layer.bounds.width + 100;
            
            finalBounds = {
                    top: layer.bounds.top,
                    bottom: layer.bounds.bottom,
                    left: layer.bounds.left + offset,
                    right: layer.bounds.right + offset
                };
        }

        var createObj = artboardLib.make(layerRef, finalBounds);
        
        return descriptor.playObject(createObj)
            .bind(this)
            .then(function () {
                log.debug("Warning: calling updateDocument to add a single artboard is very slow!");
                return this.transfer(documentActions.updateDocument);
            });
    };

    /**
     * Copy into the given document a set of layers, possibly from another document.
     *
     * @param {Document} document
     * @param {Document} fromDocument
     * @param {Immutable.Iterable.<Layer>} fromLayers
     * @return {Promise}
     */
    var duplicateCommand = function (document, fromDocument, fromLayers) {
        if (fromLayers.isEmpty()) {
            return Promise.resolve();
        }

        var fromDocumentRef = documentLib.referenceBy.id(fromDocument.id),
            allLayerRefs = fromLayers.map(function (layer) {
                return layerLib.referenceBy.id(layer.id);
            }).unshift(fromDocumentRef).toArray(),
            duplicatePlayObjects = fromLayers.map(function (fromLayer) {
                var toRef = documentLib.referenceBy.id(document.id),
                    fromLayerRef = layerLib.referenceBy.id(fromLayer.id),
                    fromRef = [
                        fromLayerRef,
                        fromDocumentRef
                    ];

                return layerLib.duplicate(fromRef, toRef);
            });

        // HACK: #1387 - If the source and target document are the same, selecting the 
        // source layer guarantees that Photoshop will paste the layer into the top of the document
        // This should be removed once we fix the core issue
        // https://github.com/adobe-photoshop/spaces-design/pull/1454#issue-78266529
        if (document === fromDocument) {
            duplicatePlayObjects = duplicatePlayObjects.unshift(layerLib.select(allLayerRefs));
        }

        var duplicateOptions = {
            historyStateInfo: {
                name: strings.ACTIONS.DUPLICATE_LAYERS,
                target: documentLib.referenceBy.id(document.id)
            }
        };

        return descriptor.batchPlayObjects(duplicatePlayObjects.toArray(), duplicateOptions)
            .bind(this)
            .then(function (results) {
                if (document === fromDocument) {
                    // Take out the select play result
                    results.shift();
                }

                // NOTE: If just the background layer is duplicated then the event
                // does NOT contain the ID of the duplicated layer, and instead just
                // contains the ID of the background layer.
                if (results.length === 1 && typeof results[0].layerID === "number") {
                    return this.transfer(documentActions.updateDocument);
                }

                // NOTE: The following update could be implemented completely optimistically if
                // we leveraged information in the from-layer models and the results of the
                // duplicate call, which contains information about the new layer names.
                var allLayerIDs = collection.pluck(results, "ID")
                    .reduce(function (allLayerIDs, layerIDs) {
                        return allLayerIDs.concat(layerIDs);
                    }, []);

                return this.transfer(addLayers, document, allLayerIDs, undefined, false);
            });
    };

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _makeHandler,
        _setHandler,
        _selectedLayerHandler,
        _autoCanvasResizeShiftHandler,
        _updateShapeHandler,
        _pathOperationHandler,
        _deleteHandler;

    /**
     * Listen for Photohop layer events.
     *
     * @return {Promise}
     */
    var beforeStartupCommand = function () {
        var applicationStore = this.flux.store("application"),
            toolStore = this.flux.store("tool");

        _makeHandler = function (event) {
            var target = photoshopEvent.targetOf(event),
                currentDocument;

            switch (target) {
            case "layer":
            case "contentLayer":
            case "textLayer":
                // A layer was added
                currentDocument = applicationStore.getCurrentDocument();
                if (!currentDocument) {
                    log.warn("Received layer make event without a current document", event);
                    return;
                }

                if (typeof event.layerID === "number") {
                    this.flux.actions.layers.addLayers(currentDocument, event.layerID);
                } else {
                    this.flux.actions.documents.updateDocument();
                }

                var currentTool = toolStore.getCurrentTool();

                // Log the tool used to make this layer
                if (currentTool) {
                    var toolID = currentTool.id;
                    headlights.logEvent("tools", "create", toolID);
                }

                break;
            }
        }.bind(this);
        descriptor.addListener("make", _makeHandler);

        _setHandler = function (event) {
            var target = photoshopEvent.targetOf(event),
                currentDocument;

            switch (target) {
            case "textLayer":
                // A layer was added
                currentDocument = applicationStore.getCurrentDocument();
                if (!currentDocument) {
                    log.warn("Received layer set event without a current document", event);
                    return;
                }

                this.flux.actions.layers.resetLayers(currentDocument, currentDocument.layers.selected);
                break;
            }
        }.bind(this);
        descriptor.addListener("set", _setHandler);

        _selectedLayerHandler = function (event) {
            var applicationStore = this.flux.store("application");

            var payload = {
                documentID: applicationStore.getCurrentDocumentID(),
                selectedIDs: [event.layerID]
            };

            this.dispatch(events.document.SELECT_LAYERS_BY_ID, payload);
        }.bind(this);
        descriptor.addListener("selectedLayer", _selectedLayerHandler);

        // Listens to layer shift events caused by auto canvas resize feature of artboards
        // and shifts all the layers correctly
        _autoCanvasResizeShiftHandler = function (event) {
            var applicationStore = this.flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();
            
            if (currentDocument !== null) {
                var payload = {
                    documentID: applicationStore.getCurrentDocumentID(),
                    layerIDs: collection.pluck(currentDocument.layers.all, "id"),
                    position: {
                        x: event.to.horizontal,
                        y: event.to.vertical
                    }
                };

                this.dispatch(events.document.TRANSLATE_LAYERS, payload);
            }
        }.bind(this);
        descriptor.addListener("autoCanvasResizeShift", _autoCanvasResizeShiftHandler);

        // Listeners for shift / option shape drawing
        _updateShapeHandler = function () {
            var applicationStore = this.flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();

            if (currentDocument !== null) {
                var layers = currentDocument.layers.selected;
                
                this.flux.actions.layers.resetBounds(currentDocument, layers);
            }
        }.bind(this);

        descriptor.addListener("addTo", _updateShapeHandler);
        descriptor.addListener("subtractFrom", _updateShapeHandler);
        // Supposed to be intersectWith, but it's defined twice and interfaceWhite is defined before
        descriptor.addListener("interfaceWhite", _updateShapeHandler);

        // Listener for path changes
        _pathOperationHandler = function (event) {
            // We don't reset the bounds after newPath commands because those
            // also trigger a layer "make" event, and so the new layer model
            // will be initialized with the correct bounds.
            if (event.command === "pathChange") {
                var applicationStore = this.flux.store("application"),
                    currentDocument = applicationStore.getCurrentDocument(),
                    currentLayers = currentDocument.layers,
                    layerIDs = _.pluck(_.rest(event.null._ref), "_id"),
                    layers = Immutable.List(layerIDs.map(currentLayers.byID, currentLayers));

                this.flux.actions.layers.resetBounds(currentDocument, layers);
            }
        }.bind(this);
        descriptor.addListener("pathOperation", _pathOperationHandler);

        // During path edit operations, deleting the last vector of a path
        // will delete the layer, and emit us a delete event
        // We listen to this and update the selection
        _deleteHandler = function (event) {
            var applicationStore = this.flux.store("application"),
                toolStore = this.flux.store("tool"),
                target = photoshopEvent.targetOf(event),
                currentDocument = applicationStore.getCurrentDocument();

            if (!currentDocument) {
                return;
            }

            if (target === "layer") {
                var payload = {
                    documentID: currentDocument.id,
                    // layerID is an array of IDs, despite the parameter name
                    layerIDs: Immutable.List(event.layerID) || Immutable.List()
                };
                
                this.dispatch(events.document.history.nonOptimistic.DELETE_LAYERS, payload);

                return this.flux.actions.layers.resetSelection(currentDocument).then(function () {
                    var currentTool = toolStore.getCurrentTool();
                    if (currentTool && currentTool.id === "pen") {
                        // Hide the path since we can't edit the selection dropped layer
                        descriptor.playObject(documentLib.setTargetPathVisible(documentLib.referenceBy.current, false));
                    }
                });
            } else if (target === null) {
                // If a path node is deleted, we get a simple delete notification with no info,
                // so we update shape bounds here
                _updateShapeHandler();
            }
        }.bind(this);
        descriptor.addListener("delete", _deleteHandler);

        var deleteFn = function () {
            // Note: shortcuts are executed iff some CEF element does not have focus.
            // In particular, this means that if is no active element but there _is_
            // selected text (e.g., in a disabled text input), the shortcut is executed.
            // But it is surprising to the user to have a layer deleted when text is
            // selected, so we decline the delete layers in this particular case.
            var selection = window.getSelection();
            if (selection.type !== "Range") {
                this.flux.actions.layers.deleteSelected();
            }
        }.bind(this);

        var backspacePromise = this.transfer(shortcuts.addShortcut, OS.eventKeyCode.BACKSPACE, {}, deleteFn),
            deletePromise = this.transfer(shortcuts.addShortcut, OS.eventKeyCode.DELETE, {}, deleteFn);

        return Promise.join(backspacePromise, deletePromise);
    };

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onResetCommand = function () {
        descriptor.removeListener("make", _makeHandler);
        descriptor.removeListener("set", _setHandler);
        descriptor.removeListener("selectedLayer", _selectedLayerHandler);
        descriptor.removeListener("autoCanvasResizeShift", _autoCanvasResizeShiftHandler);
        descriptor.removeListener("addTo", _updateShapeHandler);
        descriptor.removeListener("subtractFrom", _updateShapeHandler);
        descriptor.removeListener("interfaceWhite", _updateShapeHandler);
        descriptor.removeListener("pathOperation", _pathOperationHandler);
        descriptor.removeListener("delete", _deleteHandler);

        return Promise.resolve();
    };

    var selectLayer = {
        command: selectLayerCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerSelection]
    };

    var rename = {
        command: renameLayerCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var selectAll = {
        command: selectAllLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerSelection]
    };

    var deselectAll = {
        command: deselectAllLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerSelection]
    };

    var deleteSelected = {
        command: deleteSelectedLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerIndex, _verifyLayerSelection]
    };

    var groupSelected = {
        command: groupSelectedLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerIndex, _verifyLayerSelection]
    };

    var groupSelectedInCurrentDocument = {
        command: groupSelectedLayersInCurrentDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var ungroupSelected = {
        command: ungroupSelectedCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerIndex, _verifyLayerSelection]
    };

    var setVisibility = {
        command: setVisibilityCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setLocking = {
        command: setLockingCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerIndex, _verifyLayerSelection]
    };

    var setOpacity = {
        command: setOpacityCommand,
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var lockSelectedInCurrentDocument = {
        command: lockSelectedInCurrentDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var unlockSelectedInCurrentDocument = {
        command: unlockSelectedInCurrentDocumentCommand,
        reads: [locks.PS_DOC, locks.JS_DOC, locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var reorderLayers = {
        command: reorderLayersCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerIndex, _verifyLayerSelection]
    };

    var getLayerOrder = {
        command: getLayerOrderCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerIndex, _verifyLayerSelection]
    };

    var setBlendMode = {
        command: setBlendModeCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var addLayers = {
        command: addLayersCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        post: [_verifyLayerIndex, _verifyLayerSelection]
    };

    var resetSelection = {
        command: resetSelectionCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.JS_DOC]
    };

    var resetLayers = {
        command: resetLayersCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var resetLayersByIndex = {
        command: resetLayersByIndexCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var resetBounds = {
        command: resetBoundsCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var setProportional = {
        command: setProportionalCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var resetLinkedLayers = {
        command: resetLinkedLayersCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var createArtboard = {
        command: createArtboardCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: [_verifyLayerIndex, _verifyLayerSelection]
    };

    var duplicate = {
        command: duplicateCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        reads: [],
        writes: [locks.JS_SHORTCUT, locks.JS_POLICY, locks.PS_APP]
    };

    var onReset = {
        command: onResetCommand,
        reads: [],
        writes: []
    };

    exports.select = selectLayer;
    exports.rename = rename;
    exports.selectAll = selectAll;
    exports.deselectAll = deselectAll;
    exports.deleteSelected = deleteSelected;
    exports.groupSelected = groupSelected;
    exports.groupSelectedInCurrentDocument = groupSelectedInCurrentDocument;
    exports.ungroupSelected = ungroupSelected;
    exports.setVisibility = setVisibility;
    exports.setLocking = setLocking;
    exports.setOpacity = setOpacity;
    exports.lockSelectedInCurrentDocument = lockSelectedInCurrentDocument;
    exports.unlockSelectedInCurrentDocument = unlockSelectedInCurrentDocument;
    exports.reorder = reorderLayers;
    exports.setBlendMode = setBlendMode;
    exports.addLayers = addLayers;
    exports.resetSelection = resetSelection;
    exports.resetLayers = resetLayers;
    exports.resetLayersByIndex = resetLayersByIndex;
    exports.resetBounds = resetBounds;
    exports.setProportional = setProportional;
    exports.createArtboard = createArtboard;
    exports.resetLinkedLayers = resetLinkedLayers;
    exports.duplicate = duplicate;
    exports.getLayerOrder = getLayerOrder;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;

    exports._getLayersForDocumentRef = _getLayersForDocumentRef;
    exports._verifyLayerSelection = _verifyLayerSelection;
    exports._verifyLayerIndex = _verifyLayerIndex;
});
