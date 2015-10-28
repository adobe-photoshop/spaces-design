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
        boundsLib = require("adapter/lib/bounds"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer"),
        vectorMaskLib = require("adapter/lib/vectorMask"),
        OS = require("adapter/os");

    var Layer = require("js/models/layer"),
        collection = require("js/util/collection"),
        documentActions = require("./documents"),
        historyActions = require("./history"),
        searchActions = require("./search/layers"),
        exportActions = require("./export"),
        log = require("js/util/log"),
        events = require("../events"),
        shortcuts = require("./shortcuts"),
        guides = require("./guides"),
        tools = require("./tools"),
        layerActionsUtil = require("js/util/layeractions"),
        locks = require("js/locks"),
        locking = require("js/util/locking"),
        headlights = require("js/util/headlights"),
        strings = require("i18n!nls/strings"),
        global = require("js/util/global"),
        Bounds = require("js/models/bounds");

    var templatesJSON = require("text!static/templates.json"),
        templates = JSON.parse(templatesJSON);

    var PS_MAX_NEST_DEPTH = 9;

    /**
     * Properties to be included when requesting layer
     * descriptors from Photoshop.
     * @private
     * @type {Array.<string>} 
     */
    var _layerProperties = [
        "layerID",
        "name",
        "visible",
        "layerLocking",
        "itemIndex",
        "background",
        "boundsNoMask",
        "boundsNoEffects",
        "mode"
    ];

    /**
     * Basic optional properties to request of layer descriptors from Photoshop.
     * When initializing documents, these are the only properties requested for
     * non-selected layers.
     * 
     * @private
     * @type {Array.<string>} 
     */
    var _optionalLayerProperties = [
        "boundingBox",
        "layerKind",
        "artboard",
        "artboardEnabled",
        "smartObject",
        "layerSectionExpanded",
        "vectorMaskEnabled",
        "vectorMaskEmpty",
        "textWarningLevel"
    ];

    /**
     * Inessential optional properties to request of layer descriptors from Photoshop.
     * When initializing documents, these properties are NOT requested for non-selected
     * layers.
     *
     * @private
     * @type {Array.<string>}
     */
    var _lazyLayerProperties = [
        "layerID", // redundant but useful for matching results
        "globalAngle",
        "pathBounds",
        "proportionalScaling",
        "adjustment",
        "AGMStrokeStyleInfo",
        "textKey",
        "fillEnabled",
        "fillOpacity",
        "keyOriginType",
        "layerEffects",
        "layerFXVisible", // the following are required but this is not enforced
        "opacity"
    ];

    /**
     * All optional properties to request of layer descriptors from Photoshop.
     * When resetting any layer(s), these properties are requested. This is the
     * union of _optionalLayerProperties and _lazyLayerProperties.
     *
     * @private
     * @type {Array.<string>}
     */
    var _allOptionalLayerProperties = _lazyLayerProperties
        .slice(1)
        .concat(_optionalLayerProperties);

    /**
     * Get layer descriptors for the given layer references. Only the
     * properties listed in the arrays above will be included for performance
     * reasons. NOTE: All layer references must reference the same document.
     * 
     * @private
     * @param {Array.<object>} references
     * @param {boolean=} lazy If true, only fetch non-lazy layer properties.
     *  Otherwise, fetch all properties.
     * @return {Promise.<Array.<object>>}
     */
    var _getLayersByRef = function (references, lazy) {
        var layerPropertiesPromise = descriptor.batchMultiGetProperties(references, _layerProperties),
            optionalProperties = lazy ? _optionalLayerProperties : _allOptionalLayerProperties,
            optionalPropertiesPromise = descriptor.batchMultiGetProperties(references, optionalProperties,
                { continueOnError: true });

        var nameSpace = global.EXTENSION_DATA_NAMESPACE,
            extensionPlayObjects = references.map(function (ref) {
                return layerLib.getExtensionData(ref[0], ref[1], nameSpace);
            }),
            extensionPromise = descriptor.batchPlayObjects(extensionPlayObjects)
                .map(function (extensionData) {
                    var extensionDataRoot = extensionData[nameSpace];
                    return (extensionDataRoot && extensionDataRoot.exportsMetadata) || {};
                });

        return Promise.join(layerPropertiesPromise, optionalPropertiesPromise, extensionPromise,
            function (required, optional, extension) {
                return _.zipWith(required, optional, extension, _.merge);
            });
    };

    /**
     * Get all layer descriptors for the given document reference. Only the
     * properties listed in the arrays above will be included for performance
     * reasons.
     * 
     * @private
     * @param {object} doc A document descriptor
     * @return {Promise.<Array.<object>>}
     */
    var _getLayersForDocument = function (doc) {
        var documentID = doc.documentID,
            startIndex = doc.hasBackgroundLayer ? 0 : 1,
            docRef = documentLib.referenceBy.id(documentID),
            rangeOpts = {
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

        var targetLayers = doc.targetLayers || [],
            targetRefs = targetLayers.map(function (target) {
                return [
                    documentLib.referenceBy.id(documentID),
                    layerLib.referenceBy.index(startIndex + target._index)
                ];
            });

        var lazyPropertiesPromise = descriptor.batchMultiGetProperties(targetRefs, _lazyLayerProperties, {
            continueOnError: true
        });

        // Fetch extension data by a range of layer indexes.
        // Always start with index 1 because when a document consists only of a background layer (index 0), 
        // the photoshop action will fail.
        // And it is safe to ignore ALL bg layers because we don't use extension data on them
        var nameSpace = global.EXTENSION_DATA_NAMESPACE,
            numberOfLayers = doc.hasBackgroundLayer ? doc.numberOfLayers + 1 : doc.numberOfLayers,
            indexRange = _.range(1, startIndex + numberOfLayers),
            extensionPlayObjects = indexRange.map(function (i) {
                var layerRef = layerLib.referenceBy.index(i);
                return layerLib.getExtensionData(docRef, layerRef, nameSpace);
            }),
            extensionPromise = descriptor.batchPlayObjects(extensionPlayObjects)
                .map(function (extensionData) {
                    var extensionDataRoot = extensionData[nameSpace];
                    return (extensionDataRoot && extensionDataRoot.exportsMetadata) || {};
                })
                .then(function (extensionDataArray) {
                    // add an empty object associated with the background layer (see note above)
                    if (startIndex === 0) {
                        extensionDataArray.unshift({});
                    }
                    return extensionDataArray;
                });

        return Promise.join(requiredPropertiesPromise, optionalPropertiesPromise, extensionPromise,
            function (required, optional, extension) {
                return _.chain(required)
                    .zipWith(optional, _.merge)
                    .zipWith(extension, _.merge)
                    .reverse()
                    .value();
            })
            .tap(function (properties) {
                var propertiesByID = _.indexBy(properties, "layerID");
                return lazyPropertiesPromise.each(function (lazyProperties) {
                    if (!lazyProperties) {
                        // A background will not have a layer ID
                        return;
                    }
                    
                    var lazyLayerID = lazyProperties.layerID;

                    _.merge(propertiesByID[lazyLayerID], lazyProperties);
                });
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
     * @param {boolean= | number=} replace replace the layer with this ID, or use default logic if undefined
     * @return {Promise.<boolean>} Resolves with true if some layers were replaced, and false otherwise.
     */
    var addLayers = function (document, layerSpec, selected, replace) {
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

                var nextDocument = this.flux.store("document").getDocument(document.id),
                    nextLayerCount = nextDocument.layers.all.size,
                    naiveLayerCount = document.layers.all.size + layerSpec.length;

                return nextLayerCount !== naiveLayerCount;
            })
            .tap(function () {
                return this.transfer(tools.resetBorderPolicies);
            });
    };
    addLayers.modal = true;
    addLayers.reads = [locks.PS_DOC];
    addLayers.writes = [locks.JS_DOC];
    addLayers.transfers = [tools.resetBorderPolicies];
    addLayers.post = [_verifyLayerIndex, _verifyLayerSelection];

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
     * Emit RESET_LAYERS with layer descriptors for all given layers.
     *
     * @param {Document} document
     * @param {Layer|Immutable.Iterable.<Layer>} layers
     * @param {boolean=} amendHistory If truthy, update the current history state
     *  with latest document, and also do NOT dirty the document.
     * @param {boolean=} lazy If true, non-selected layers will only have their
     *  non-lazy properties updated, and will be returned to an uninitialized
     *  state. This is a performance optimization. NOTE: the selection state
     *  of the layer models passed in must be accurate for this to work correctly!
     * @return {Promise}
     */
    var resetLayers = function (document, layers, amendHistory, lazy) {
        if (layers instanceof Layer) {
            layers = Immutable.List.of(layers);
        } else if (layers.isEmpty()) {
            return this.transfer(tools.resetBorderPolicies);
        }

        var layersPromise;
        if (lazy) {
            var selectedLayerRefs = layers
                .filter(function (layer) {
                    return layer.selected;
                })
                .map(function (layer) {
                    return [
                        documentLib.referenceBy.id(document.id),
                        layerLib.referenceBy.id(layer.id)
                    ];
                })
                .toArray(),
                selectedLayersPromise = _getLayersByRef(selectedLayerRefs);

            var unselectedLayerRefs = layers
                .filterNot(function (layer) {
                    return layer.selected;
                })
                .map(function (layer) {
                    return [
                        documentLib.referenceBy.id(document.id),
                        layerLib.referenceBy.id(layer.id)
                    ];
                })
                .toArray(),
                unselectedLayersPromise = _getLayersByRef(unselectedLayerRefs, true);

            layersPromise = Promise.join(selectedLayersPromise, unselectedLayersPromise,
                function (selected, unselected) {
                    var selectedIndex = 0,
                        unselectedIndex = 0;

                    return layers
                        .map(function (layer) {
                            if (layer.selected) {
                                return selected[selectedIndex++];
                            } else {
                                return unselected[unselectedIndex++];
                            }
                        })
                        .toArray();
                }.bind(this));
        } else {
            var layerRefs = layers.map(function (layer) {
                return [
                    documentLib.referenceBy.id(document.id),
                    layerLib.referenceBy.id(layer.id)
                ];
            }).toArray();

            layersPromise = _getLayersByRef(layerRefs);
        }

        return layersPromise
            .bind(this)
            .then(function (descriptors) {
                var index = 0, // annoyingly, Immutable.Set.prototype.forEach does not provide an index
                    payload = {
                        documentID: document.id,
                        lazy: lazy
                    };

                payload.layers = layers.map(function (layer) {
                    return {
                        layerID: layer.id,
                        descriptor: descriptors[index++]
                    };
                });
                if (amendHistory) {
                    payload.suppressDirty = true;
                    this.dispatch(events.document.history.amendment.RESET_LAYERS, payload);
                } else {
                    this.dispatch(events.document.RESET_LAYERS, payload);
                }
            })
            .then(function () {
                return this.transfer(tools.resetBorderPolicies);
            });
    };
    resetLayers.reads = [locks.PS_DOC];
    resetLayers.writes = [locks.JS_DOC];
    resetLayers.transfers = [tools.resetBorderPolicies];

    /**
     * Emit a RESET_BOUNDS with bounds descriptors for the given layers.
     * Based on noHistory, emit the correct flavor of event
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {boolean=} suppressHistory Optional. If true, emit an event that does NOT add a new history state
     * @param {boolean=} amendHistory Optional. If true, update the current state (requires suppressHistory)
     * @return {Promise}
     */
    var resetBounds = function (document, layers, suppressHistory, amendHistory) {
        if (layers.isEmpty()) {
            return Promise.resolve();
        }

        var propertyRefs = layers.map(function (layer) {
            var property;
            if (layer.isArtboard) {
                property = "artboard";
            } else if (layer.kind === layer.layerKinds.VECTOR) {
                property = "pathBounds";
            } else if (layer.kind === layer.layerKinds.TEXT) {
                property = "boundingBox";
            } else {
                property = "boundsNoMask";
            }
            return [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.id(layer.id),
                {
                    _ref: "property",
                    _property: property
                }
            ];
        }).toArray(),
            maskPropertyRefs = layers.map(function (layer) {
                var property;
                if (layer.vectorMaskEnabled && layer.kind !== layer.layerKinds.VECTOR) {
                    property = "boundsNoEffects";
                    
                    return [
                        documentLib.referenceBy.id(document.id),
                        layerLib.referenceBy.id(layer.id),
                        {
                            _ref: "property",
                            _property: property
                        }
                    ];
                } else {
                    return undefined;
                }
            }).filter(function (refs) {
                return refs;
            }).toArray();
        propertyRefs = propertyRefs.concat(maskPropertyRefs);

        return descriptor.batchGet(propertyRefs)
            .bind(this)
            .then(function (bounds) {
                var index = 0, // annoyingly, Immutable.Set.prototype.forEach does not provide an index
                    maskIndex = 0,
                    payload = {
                        documentID: document.id
                    };

                payload.bounds = layers.map(function (layer) {
                    var descriptor = bounds[index++];

                    if (layer.vectorMaskEnabled && layer.kind !== layer.layerKinds.VECTOR)
                    {  
                        var maskDescriptor =bounds[layers.size + maskIndex ++];
                        descriptor.boundsNoEffects = maskDescriptor.boundsNoEffects
                    }
                    return {
                        layerID: layer.id,
                        descriptor: descriptor
                    };
                });

                if (suppressHistory) {
                    if (amendHistory) {
                        this.dispatch(events.document.history.amendment.RESET_BOUNDS, payload);
                    } else {
                        this.dispatch(events.document.RESET_BOUNDS, payload);
                    }
                } else {
                    this.dispatch(events.document.history.nonOptimistic.RESET_BOUNDS, payload);
                }
            })
            .then(function () {
                return this.transfer(guides.queryCurrentGuides);
            })
            .then(function () {
                return this.transfer(tools.resetBorderPolicies);
            });
    };
    resetBounds.reads = [locks.PS_DOC];
    resetBounds.writes = [locks.JS_DOC];
    resetBounds.transfers = [tools.resetBorderPolicies, guides.queryCurrentGuides];

    /** 
     * Transfers to reset bounds, but if there is a failure, quietly fails instead of 
     * causing a reset. We use this for pathOperation notifications
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {boolean=} noHistory Optional. If true, emit an event that does NOT change history
     * @return {Promise}
     */
    var resetBoundsQuietly = function (document, layers, noHistory) {
        return this.transfer(resetBounds, document, layers, noHistory)
            .catch(function () {});
    };
    resetBoundsQuietly.reads = [];
    resetBoundsQuietly.writes = [];
    resetBoundsQuietly.transfers = [resetBounds];

    /**
     * Calls reset on all smart object layers of the document
     * Depending on speed we can improve this by only resetting 
     * linked smart objects, or only resetting their boundaries
     *
     * @param {Document} document [description]
     * @return {Promise}
     */
    var resetLinkedLayers = function (document) {
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
    resetLinkedLayers.reads = [locks.JS_DOC];
    resetLinkedLayers.writes = [];
    resetLinkedLayers.transfers = [resetBounds];

    /**
     * Emit RESET_LAYERS_BY_INDEX with layer descriptors for all given layer indexes.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<number> | number} layerIndexes
     */
    var resetLayersByIndex = function (document, layerIndexes) {
        var indexList = Immutable.Iterable.isIterable(layerIndexes) ?
            layerIndexes :
            Immutable.List.of(layerIndexes);

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
    resetLayersByIndex.reads = [locks.PS_DOC];
    resetLayersByIndex.writes = [locks.JS_DOC];

    /**
     * Fetch the visibility property for all layers, or given layer(s), and emit VISIBILITY_CHANGED
     *
     * @param {Document} document
     * @param {Layer|Immutable.Iterable.<Layer>=} layers
     * @return {Promise}
     */
    var resetLayerVisibility = function (document, layers) {
        if (!layers) {
            layers = document.layers.all;
        } else if (layers instanceof Layer) {
            layers = Immutable.List.of(layers);
        } else if (layers.isEmpty()) {
            return Promise.resolve();
        }

        var docRef = documentLib.referenceBy.id(document.id),
            layerRefs = layers.map(function (layer) {
            return [
                docRef,
                layerLib.referenceBy.id(layer.id)
            ];
        }).toArray();

        // convert to range fetch in case of all-layers?
        return descriptor.batchMultiGetProperties(layerRefs, ["layerID", "visible"])
            .bind(this)
            .then(function (descriptors) {
                var payload = {
                    documentID: document.id
                };

                payload.layerProps = Immutable.Map(descriptors.map(function (descriptor) {
                    return [descriptor.layerID, descriptor.visible];
                }));

                return this.dispatchAsync(events.document.VISIBILITY_CHANGED, payload);
            });
    };
    resetLayerVisibility.reads = [locks.PS_DOC];
    resetLayerVisibility.writes = [locks.JS_DOC];
    resetLayerVisibility.modal = true;

    /**
     * Initialize the uninitialized subset of the given layers by loading their lazy properties.
     *
     * @param {Document} document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec
     * @return {Promise}
     */
    var initializeLayers = function (document, layerSpec) {
        if (layerSpec instanceof Layer) {
            layerSpec = Immutable.List.of(layerSpec);
        }

        var uninitializedLayers = layerSpec.filterNot(function (layer) {
            return layer.initialized;
        });

        return this.transfer(resetLayers, document, uninitializedLayers, true);
    };
    initializeLayers.reads = [];
    initializeLayers.writes = [];
    initializeLayers.transfers = [resetLayers];

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
                return layer.kind === layer.layerKinds.GROUP;
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

                return this.transfer(initializeLayers, nextDocument, nextSelected);
            }
        }.bind(this));
    };
    setGroupExpansion.reads = [];
    setGroupExpansion.writes = [locks.PS_DOC, locks.JS_DOC];
    setGroupExpansion.transfers = [initializeLayers];

    /**
     * Reveal the given layers in the layers panel by ensuring their ancestors
     * are expanded.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {Promise}
     */
    var revealLayers = function (document, layers) {
        if (layers instanceof Layer) {
            layers = Immutable.List.of(layers);
        }

        var collapsedAncestorSet = layers.reduce(function (collapsedAncestors, layer) {
            if (document.layers.hasCollapsedAncestor(layer)) {
                document.layers.strictAncestors(layer).forEach(function (ancestor) {
                    if (!ancestor.expanded) {
                        collapsedAncestors.add(ancestor);
                    }
                });
            }
            return collapsedAncestors;
        }, new Set(), this),
        collapsedAncestors = Immutable.Set(collapsedAncestorSet).toList();

        return this.transfer(setGroupExpansion, document, collapsedAncestors, true);
    };
    revealLayers.reads = [locks.JS_DOC];
    revealLayers.writes = [];
    revealLayers.transfers = [setGroupExpansion];

    /**
     * Resets the list of selected layers by asking photoshop for targetLayers
     *
     * @param {Document} document document of which to reset layers
     * @return {Promise}
     */
    var resetSelection = function (document) {
        var payload = {
            documentID: document.id
        };

        return _getSelectedLayerIndices(document)
            .bind(this)
            .then(function (selectedLayerIndices) {
                payload.selectedIndices = selectedLayerIndices;
                this.dispatch(events.document.SELECT_LAYERS_BY_INDEX, payload);
            })
            .then(function () {
                var nextDocument = this.flux.store("document").getDocument(document.id),
                    selected = nextDocument.layers.selected;

                return this.transfer(initializeLayers, nextDocument, selected);
            });
    };
    resetSelection.reads = [locks.PS_DOC, locks.JS_DOC];
    resetSelection.writes = [locks.JS_DOC];
    resetSelection.transfers = [initializeLayers];

    /**
     * Selects the given layer with given modifiers
     *
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a single layer that
     *  the selection is based on, or a list of such layers.
     * @param {string=} modifier Way of modifying the selection. Possible values
     *  are defined in `adapter/src/lib/layer.js` under `select.vals`.
     *  Default is similar to "select", but the pivot layer will always be cleared.
     *
     * @returns {Promise}
     */
    var select = function (document, layerSpec, modifier) {
        if (layerSpec instanceof Layer) {
            layerSpec = Immutable.List.of(layerSpec);
        }

        if (document.unsupported) {
            return Promise.resolve();
        }

        var setPivot = layerSpec.size === 1,
            selected = document.layers.selected,
            pivot = document.layers.pivot,
            nextSelected,
            nextPivot;

        switch (modifier) {
        case "select":
            nextSelected = layerSpec;
            nextPivot = setPivot ? layerSpec.first() : null;
            break;
        case "deselect":
            nextSelected = selected.filterNot(function (layer) {
                return layerSpec.first().id === layer.id;
            });
            if (setPivot) {
                if (pivot) {
                    if (pivot.id === layerSpec.first().id) {
                        nextPivot = selected.first();
                    } else {
                        nextPivot = pivot;
                    }
                }
            } else {
                nextPivot = null;
            }
            break;
        case "add":
            nextSelected = selected.concat(layerSpec);
            nextPivot = setPivot ? pivot : null;
            break;
        case "addUpTo":
            if (!setPivot) {
                throw new Error("Select with modifier addUpTo does not support multiple layers.");
            }

            if (selected.isEmpty()) {
                nextSelected = layerSpec;
                nextPivot = layerSpec.first();
            } else {
                nextPivot = pivot || selected.first();

                var pivotIndex = document.layers.indexOf(nextPivot),
                    targetIndex = document.layers.indexOf(layerSpec.first()),
                    firstIndex = Math.min(pivotIndex, targetIndex),
                    lastIndex = Math.max(pivotIndex, targetIndex);

                nextSelected = document.layers.exposed.filter(function (layer) {
                    var index = document.layers.indexOf(layer);

                    return firstIndex <= index && index <= lastIndex;
                });
            }
            break;
        default:
            nextSelected = layerSpec;
            nextPivot = null;
        }

        var payload = {
            documentID: document.id,
            selectedIDs: collection.pluck(nextSelected, "id"),
            pivotID: nextPivot && nextPivot.id
        };

        var dispatchPromise = this.dispatchAsync(events.document.SELECT_LAYERS_BY_ID, payload)
                .bind(this)
                .then(function () {
                    return this.transfer(initializeLayers, document, nextSelected);
                }),
            revealPromise = this.transfer(revealLayers, document, nextSelected);

        var layerRef = (modifier === "deselect" ? layerSpec : nextSelected)
            .map(function (layer) {
                return layerLib.referenceBy.id(layer.id);
            })
            .unshift(documentLib.referenceBy.id(document.id))
            .toArray();

        var selectObj = layerLib.select(layerRef, false, modifier === "deselect" ? modifier : undefined),
            selectPromise = descriptor.playObject(selectObj)
                .bind(this)
                .then(function () {
                    return this.transfer(tools.changeVectorMaskMode, false);
                });

        return Promise.join(dispatchPromise, revealPromise, selectPromise);
    };
    select.reads = [];
    select.writes = [locks.PS_DOC, locks.JS_DOC];
    select.transfers = [revealLayers, resetSelection, initializeLayers, tools.changeVectorMaskMode];
    select.post = [_verifyLayerSelection];

    /**
     * Renames the given layer
     *
     * @param {Document} document Owner document
     * @param {Layer} layer Layer to be renamed
     * @param {string} newName What to rename the layer
     * 
     * @returns {Promise}
     */
    var rename = function (document, layer, newName) {
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
    rename.reads = [locks.PS_DOC, locks.JS_DOC];
    rename.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Deselects all layers in the given document, or in the current document if none is provided.
     * 
     * @param {document=} document
     * @returns {Promise}
     */
    var deselectAll = function (document) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        // If document doesn't exist, or is a flat document
        if (!document || document.layers.all.size === 1 &&
            document.layers.all.first().isBackground) {
            return Promise.resolve();
        }

        var payload = {
            documentID: document.id,
            selectedIDs: []
        };

        // FIXME: The descriptor below should be specific to the document ID
        var deselectPromise = descriptor.playObject(layerLib.deselectAll()),
            dispatchPromise = this.dispatchAsync(events.document.SELECT_LAYERS_BY_ID, payload)
                .bind(this)
                .then(function () {
                    return this.transfer(tools.resetBorderPolicies);
                });

        return Promise.join(dispatchPromise, deselectPromise);
    };
    deselectAll.reads = [locks.JS_APP];
    deselectAll.writes = [locks.PS_DOC, locks.JS_DOC];
    deselectAll.transfers = [tools.resetBorderPolicies];
    deselectAll.post = [_verifyLayerSelection];

    /**
     * Selects all layers in the given document, or in the current document if none is provided.
     * 
     * @param {document=} document
     * @returns {Promise}
     */
    var selectAll = function (document) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        // If document doesn't exist, or is a flat document
        if (!document || document.unsupported || document.layers.all.isEmpty()) {
            return Promise.resolve();
        }

        return this.transfer(select, document, document.layers.allVisible);
    };
    selectAll.reads = [locks.JS_DOC, locks.JS_APP];
    selectAll.writes = [];
    selectAll.transfers = [select];
    selectAll.post = [_verifyLayerSelection];

    /**
     * Remove the given layers from the JavaScript model. This is useful from
     * event handlers that tell us about layers which have already been removed
     * from the model. To delete layers from a Photoshop document, use the
     * deleteSelected action.
     *
     * @param {Document} document
     * @param {Layer|Immutable.Iterable.<Layer>} layers
     * @param {boolean=} resetHistory
     * @return {Promise}
     */
    var removeLayers = function (document, layers, resetHistory) {
        if (layers instanceof Layer) {
            layers = Immutable.List.of(layers);
        }

        return _getSelectedLayerIndices(document)
            .bind(this)
            .then(function (selectedLayerIndices) {
                var payload = {
                    documentID: document.id,
                    layerIDs: collection.pluck(layers, "id"),
                    selectedIndices: selectedLayerIndices
                };

                this.dispatch(events.document.history.nonOptimistic.DELETE_LAYERS, payload);

                if (resetHistory) {
                    this.transfer(historyActions.queryCurrentHistory, document.id);
                }
            })
            .then(function () {
                var nextDocument = this.flux.store("document").getDocument(document.id),
                    selected = nextDocument.layers.selected;

                return this.transfer(initializeLayers, nextDocument, selected);
            });
    };
    removeLayers.reads = [locks.PS_DOC];
    removeLayers.writes = [locks.JS_DOC];
    removeLayers.transfers = ["history.queryCurrentHistory", initializeLayers];
    removeLayers.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Deletes the selected layers in the given document, or in the current document if none is provided
     *
     * @param {?Document} document
     * @return {Promise}
     */
    var deleteSelected = function (document) {
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
            deletePlayObject = layerLib.delete(layerLib.referenceBy.current),
            options = {
                historyStateInfo: {
                    name: strings.ACTIONS.DELETE_LAYERS,
                    target: documentLib.referenceBy.id(documentID)
                }
            };

        return locking.playWithLockOverride(document, layers, deletePlayObject, options, true)
            .bind(this)
            .then(function () {
                return this.transfer(removeLayers, document, layers);
            });
    };
    deleteSelected.reads = [locks.JS_APP, locks.JS_DOC];
    deleteSelected.writes = [locks.PS_DOC];
    deleteSelected.transfers = [removeLayers];
    deleteSelected.post = [_verifyLayerIndex, _verifyLayerSelection];

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
                    groupname: groupResult.name
                };

                this.dispatch(events.document.history.optimistic.GROUP_SELECTED, payload);
            });
    };
    groupSelected.reads = [locks.PS_DOC, locks.JS_DOC];
    groupSelected.writes = [locks.PS_DOC, locks.JS_DOC];
    groupSelected.post = [_verifyLayerIndex, _verifyLayerSelection];

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
    groupSelectedInCurrentDocument.reads = [locks.JS_APP];
    groupSelectedInCurrentDocument.writes = [];
    groupSelectedInCurrentDocument.transfers = [groupSelected];

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
                    return this.transfer(resetSelection, document);
                } else {
                    var nextDocument = this.flux.store("document").getDocument(document.id),
                        selected = nextDocument.layers.selected;

                    return this.transfer(initializeLayers, nextDocument, selected);
                }
            });
    };
    ungroupSelected.reads = [locks.JS_APP];
    ungroupSelected.writes = [locks.PS_DOC, locks.JS_DOC];
    ungroupSelected.transfers = [resetSelection, initializeLayers];
    ungroupSelected.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Changes the visibility of layer
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {boolean} visible Whether to show or hide the layer

     * @returns {Promise}
     */
    var setVisibility = function (document, layer, visible) {
        var payload = {
                documentID: document.id,
                layerProps: {
                    layerID: layer.id,
                    visible: visible
                }
            },
            command = visible ? layerLib.show : layerLib.hide,
            layerRef = [
                documentLib.referenceBy.id(document.id),
                layerLib.referenceBy.id(layer.id)
            ];

        var dispatchPromise = this.dispatchAsync(events.document.VISIBILITY_CHANGED, payload),
            visibilityPromise = descriptor.playObject(command.call(this, layerRef));

        return Promise.join(dispatchPromise, visibilityPromise);
    };
    setVisibility.reads = [locks.PS_DOC, locks.JS_DOC];
    setVisibility.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Used by the show/hide menu items, targets the active document active layers
     *
     * @param {boolean} visible
     * @returns {Promise}
     */
    var setVisibilitySelectedInCurrentDocument = function (visible) {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (!currentDocument) {
            return Promise.resolve();
        }

        var showPromises = currentDocument.layers.selected.map(function (layer) {
            return this.transfer(setVisibility, currentDocument, layer, visible);
        }, this).toArray();

        return Promise.all(showPromises);
    };
    setVisibilitySelectedInCurrentDocument.reads = [locks.JS_DOC];
    setVisibilitySelectedInCurrentDocument.writes = [];
    setVisibilitySelectedInCurrentDocument.transfers = [setVisibility];

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
    var setLocking = function (document, layer, locked) {
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
    setLocking.reads = [locks.PS_DOC, locks.JS_DOC];
    setLocking.writes = [locks.PS_DOC, locks.JS_DOC];
    setLocking.transfers = [addLayers];
    setLocking.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Set the opacity of the given layers.
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {number} opacity Opacity as a percentage
     * @param {object} options
     * @param {boolean=} options.coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var setOpacity = function (document, layers, opacity, options) {
        layers = layers.filterNot(function (layer) {
            return layer.isBackground;
        });
        
        options = _.merge({}, options);

        var payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                opacity: opacity,
                coalesce: !!options.coalesce
            },
            playObjects = layers.map(function (layer) {
                var layerRef = [
                    documentLib.referenceBy.id(document.id),
                    layerLib.referenceBy.id(layer.id)
                ];

                return layerLib.setOpacity(layerRef, opacity);
            });
        
        var playOptions = _.merge(options, {
            historyStateInfo: {
                name: strings.ACTIONS.CHANGE_LAYER_OPACITY,
                target: documentLib.referenceBy.id(document.id),
                coalesce: !!options.coalesce,
                suppressHistoryStateNotification: !!options.coalesce
            },
            paintOptions: {
                immediateUpdate: true,
                quality: "draft"
            }
        });

        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.OPACITY_CHANGED, payload),
            opacityPromise = locking.playWithLockOverride(document, layers, playObjects.toArray(), playOptions);

        return Promise.join(dispatchPromise, opacityPromise);
    };
    setOpacity.reads = [];
    setOpacity.writes = [locks.PS_DOC, locks.JS_DOC];

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
    var lockSelectedInCurrentDocument = function () {
        return _setLockingInCurrentDocument.call(this, true);
    };
    lockSelectedInCurrentDocument.reads = [locks.JS_DOC, locks.JS_APP];
    lockSelectedInCurrentDocument.writes = [];
    lockSelectedInCurrentDocument.transfers = [setLocking];

    /**
     * Unlock the selected layers in the current document.
     * 
     * @return {Promise}
     */
    var unlockSelectedInCurrentDocument = function () {
        return _setLockingInCurrentDocument.call(this, false);
    };
    unlockSelectedInCurrentDocument.reads = [locks.JS_DOC, locks.JS_APP];
    unlockSelectedInCurrentDocument.writes = [];
    unlockSelectedInCurrentDocument.transfers = [setLocking];

    /**
     * Reset the layer z-index. Assumes that all layers are already in the model,
     * though possibly out of order w.r.t. Photoshop's model.
     *
     * @param {Document=} document Document for which layers should be reordered, if undefined, use current document
     * @param {boolean=} suppressHistory Optional. If true, emit an event that does NOT add a new history state
     * @param {boolean=} amendHistory Optional. If true, update the current state (requires suppressHistory)
     * @return {Promise} Resolves to the new ordered IDs of layers as well as what layers should be selected
     **/
    var resetIndex = function (document, suppressHistory, amendHistory) {
        if (typeof document === "undefined") {
            document = this.flux.store("application").getCurrentDocument();

            if (!document) {
                return Promise.resolve();
            }
        }

        return _getLayerIDsForDocumentID.call(this, document.id)
            .then(function (payload) {
                return _getSelectedLayerIndices(document).then(function (selectedIndices) {
                        payload.selectedIndices = selectedIndices;
                        return payload;
                    });
            })
            .then(function (payload) {
                if (suppressHistory) {
                    if (amendHistory) {
                        return this.dispatchAsync(events.document.history.amendment.REORDER_LAYERS, payload);
                    } else {
                        return this.dispatchAsync(events.document.REORDER_LAYERS, payload);
                    }
                } else {
                    return this.dispatchAsync(events.document.history.optimistic.REORDER_LAYERS, payload);
                }
            })
            .then(function () {
                // get the document with latest selected layers, after layer reordering.
                var document = this.flux.store("application").getCurrentDocument();

                return this.transfer(initializeLayers, document, document.layers.selected);
            });
    };
    resetIndex.reads = [locks.PS_DOC];
    resetIndex.writes = [locks.JS_DOC];
    resetIndex.transfers = [initializeLayers];
    resetIndex.post = [_verifyLayerIndex, _verifyLayerSelection];

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
     * @param {number|string} target If a number, the target index to move layers to
     *                               If a string, the reference enum type ("front", "back", "previous", "next")
     *
     * @return {Promise} Resolves to the new ordered IDs of layers as well as what layers should be selected
     *, or rejects if targetIndex is invalid, as example when it is a child of one of the layers in layer spec
     **/
    var reorderLayers = function (document, layerSpec, target) {
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

        var numberRef = (typeof target === "number"),
            targetRef = numberRef ? layerLib.referenceBy.index(target) : layerLib.referenceBy[target],
            reorderObj = layerLib.reorder(layerRef, targetRef),
            reorderPromise = descriptor.playObject(reorderObj);
      
        return reorderPromise.bind(this)
            .catch(function (err) {
                // Ignore reorder errors if target was a string (called by one of the bring/send methods below)
                // since PS fails if we try to move a layer past the doc bounds
                // but we use PS enum references so we don't control the location
                if (numberRef) {
                    throw (err);
                }
            })
            .then(function () {
                return this.transfer(resetIndex, document, false, false);
            })
            .then(function () {
                // The selected layers may have changed after the reorder.
                var nextDocument = this.flux.store("document").getDocument(document.id);

                return this.transfer(resetBounds, nextDocument, nextDocument.layers.allSelected, true);
            });
    };
    reorderLayers.reads = [locks.PS_DOC, locks.JS_DOC];
    reorderLayers.writes = [locks.PS_DOC, locks.JS_DOC];
    reorderLayers.transfers = [resetIndex, resetBounds];
    reorderLayers.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Reorders all the given layers in the document to the top of the z-order
     *
     * @param {Document=} document Default is current document
     * @param {Immutable.Iterable.<Layer>=} layers Default is selected layers
     * @return {Promise}
     */
    var bringToFront = function (document, layers) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        if (document && layers === undefined) {
            layers = document.layers.selectedNormalized;
        }

        if (!document || !layers) {
            return Promise.resolve();
        }

        var layerIDs = collection.pluck(layers, "id");

        return this.transfer(reorderLayers, document, layerIDs, "front");
    };
    bringToFront.reads = [];
    bringToFront.writes = [];
    bringToFront.transfers = [reorderLayers];
    bringToFront.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Reorders all the given layers in the document, so they're one above the top-most one
     *
     * @param {Document=} document Default is current document
     * @param {Immutable.Iterable.<Layer>=} layers Default is selected layers
     * @return {Promise}
     */
    var bringForward = function (document, layers) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        if (document && layers === undefined) {
            layers = document.layers.selectedNormalized;
        }

        if (!document || !layers) {
            return Promise.resolve();
        }

        var layerIDs = collection.pluck(layers, "id");

        return this.transfer(reorderLayers, document, layerIDs, "next");
    };
    bringForward.reads = [];
    bringForward.writes = [];
    bringForward.transfers = [reorderLayers];
    bringForward.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Reorders all the given layers in the document, so they're one below the bottom-most one
     *
     * @param {Document=} document Default is current document
     * @param {Immutable.Iterable.<Layer>=} layers Default is selected layers
     * @return {Promise}
     */
    var sendBackward = function (document, layers) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        if (document && layers === undefined) {
            layers = document.layers.selectedNormalized;
        }

        if (!document || !layers) {
            return Promise.resolve();
        }
        
        var layerIDs = collection.pluck(layers, "id");
            
        return this.transfer(reorderLayers, document, layerIDs, "previous");
    };
    sendBackward.reads = [];
    sendBackward.writes = [];
    sendBackward.transfers = [reorderLayers];
    sendBackward.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Reorders all the given layers in the document to the bottom in z-order
     *
     * @param {Document=} document Default is current document
     * @param {Immutable.Iterable.<Layer>=} layers Default is selected layers
     * @return {Promise}
     */
    var sendToBack = function (document, layers) {
        if (document === undefined) {
            document = this.flux.store("application").getCurrentDocument();
        }

        if (document && layers === undefined) {
            layers = document.layers.selectedNormalized;
        }

        if (!document || !layers) {
            return Promise.resolve();
        }

        var layerIDs = collection.pluck(layers, "id");

        return this.transfer(reorderLayers, document, layerIDs, "back");
    };
    sendToBack.reads = [];
    sendToBack.writes = [];
    sendToBack.transfers = [reorderLayers];
    sendToBack.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Set the blend mode of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {string} mode Blend mode ID
     * @param {object} options
     * @return {Promise}
     */
    var setBlendMode = function (document, layers, mode, options) {
        layers = layers.filterNot(function (layer) {
            return layer.isBackground;
        });
        
        options = _.merge({}, options, {
            historyStateInfo: {
                name: strings.ACTIONS.SET_BLEND_MODE,
                target: documentLib.referenceBy.id(document.id)
            }
        });

        var documentRef = documentLib.referenceBy.id(document.id),
            layerIDs = collection.pluck(layers, "id"),
            layerRef = layerIDs
                .map(function (layerID) {
                    return layerLib.referenceBy.id(layerID);
                })
                .unshift(documentRef)
                .toArray();

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
    setBlendMode.reads = [locks.PS_DOC, locks.JS_DOC];
    setBlendMode.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Sets the given layers' proportional flag
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a Layer reference or array of Layers
     * @param {boolean=} proportional make the size change proportionally 
     *
     * @returns {Promise}
     */
    var setProportional = function (document, layerSpec, proportional) {
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

        var dispatchPromise = this.dispatchAsync(events.document.history.optimistic.SET_LAYERS_PROPORTIONAL, payload),
            layerPlayObjects = layerSpec.map(function (layer) {
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
    setProportional.reads = [locks.PS_DOC, locks.JS_DOC];
    setProportional.writes = [locks.PS_DOC, locks.JS_DOC];

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
            _unlockBackgroundLayer.call(this, document, backgroundLayer) :
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
                    suppressChange: true
                };

                return this.dispatchAsync(events.document.history.optimistic.GROUP_SELECTED, payload);
            })
            .then(function () {
                return this.transfer(resetIndex, document, true, true);
            })
            .then(function () {
                var exportPromise = this.transfer(exportActions.addDefaultAsset, document.id, artboardLayerId),
                    borderPromise = this.transfer(tools.resetBorderPolicies);

                return Promise.join(exportPromise, borderPromise);
            });
    };

    createArtboard.reads = [locks.JS_APP];
    createArtboard.writes = [locks.PS_DOC, locks.JS_DOC];
    createArtboard.transfers = [resetIndex, addLayers, exportActions.addDefaultAsset, tools.resetBorderPolicies];
    createArtboard.post = [_verifyLayerIndex, _verifyLayerSelection];

    /**
     * Copy into the given document a set of layers, possibly from another document.
     *
     * @param {Document=} document
     * @param {Document=} fromDocument
     * @param {Immutable.Iterable.<Layer>=} fromLayers
     * @return {Promise}
     */
    var duplicate = function (document, fromDocument, fromLayers) {
        var applicationStore = this.flux.store("application");
            
        if (document === undefined) {
            document = applicationStore.getCurrentDocument();
        }

        if (fromDocument === undefined) {
            fromDocument = applicationStore.getCurrentDocument();
        }

        if (fromLayers === undefined) {
            fromLayers = fromDocument.layers.selected;
        }
        
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
                    }, []),
                    allLayers = allLayerIDs.map(function (currentVal) {
                        return { id: currentVal };
                    });

                return this.transfer(addLayers, document, allLayerIDs, undefined, false)
                    .bind(this)
                    .then(function () {
                        return this.transfer(select, document, Immutable.List(allLayers));
                    });
            });
    };
    duplicate.reads = [locks.JS_DOC];
    duplicate.writes = [locks.PS_DOC];
    duplicate.transfers = ["documents.updateDocument", addLayers, select];

    /**
     * Dispatches a command to  select the VEctor mask for the currently selected layer
     *
     * @return {Promise}
     */
    var selectVectorMask = function () {
        return descriptor.playObject(vectorMaskLib.selectVectorMask());
    };

    selectVectorMask.reads = [];
    selectVectorMask.writes = [locks.PS_DOC];
    selectVectorMask.modal = true;

    /**
     * Dispatches a layer reposition for all layers in the given document model
     *
     * @return {Promise}
     */
    var handleCanvasShift = function () {
        var document = this.flux.stores.application.getCurrentDocument();

        if (!document) {
            return Promise.resolve();
        }

        // TODO this action used to translate layer bounds and dispatch events.document.REPOSITION_LAYERS,
        // but this was incompatible with undo/redo.  When stepping back into a history state we might also get
        // a canvas shift event which would cause us to shift our already-correct cached history state
        return this.transfer(resetBounds, document, document.layers.all, true, true);
    };
    handleCanvasShift.reads = [locks.JS_DOC];
    handleCanvasShift.writes = [];
    handleCanvasShift.transfers = [resetBounds];
    handleCanvasShift.modal = true;

    /**
     * Reveal and select the vector mask of the selected layer. 
     * Also switch to the vector based superselect tool.
     *
     * @return {Promise}
     */
    var editVectorMask = function () {
        var toolStore = this.flux.store("tool"),
            superselectVector = toolStore.getToolByID("superselectVector");

        return this.transfer(tools.select, superselectVector)
            .then(function () {
                // select and activate knots on Current Vector Mask
                return descriptor.playObject(vectorMaskLib.activateVectorMaskEditing());
            });
    };
    editVectorMask.reads = [locks.JS_TOOL];
    editVectorMask.writes = [locks.PS_DOC];
    editVectorMask.transfers = [tools.select];
    editVectorMask.modal = true;

    /**
     * create a vector mask on the selected layer
     *
     * @return {Promise}
     */
    var addVectorMask = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (currentDocument === null) {
            return Promise.resolve();
        }

        var layers = currentDocument.layers.selected;

        if (layers === null || layers.isEmpty()) {
            return Promise.resolve();
        }

        var layer = layers.first(),
            bounds = boundsLib.bounds(layer.bounds),
            payload = {
                documentID: currentDocument.id,
                layerIDs: Immutable.List.of(layer.id),
                vectorMaskEnabled: true
            };

        this.dispatch(events.document.history.optimistic.ADD_VECTOR_MASK_TO_LAYER, payload);

        return descriptor.batchPlayObjects([vectorMaskLib.makeBoundsWorkPath(bounds),
            vectorMaskLib.makeVectorMaskFromWorkPath(),
            vectorMaskLib.deleteWorkPath()]);
    };
    addVectorMask.reads = [locks.JS_TOOL];
    addVectorMask.writes = [locks.PS_DOC];
    addVectorMask.modal = true;

    /**
     * removes a vector mask on the selected layer
     *
     * @return {Promise}
     */
    var deleteVectorMask = function () {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument();

        if (currentDocument === null) {
            return Promise.resolve();
        }

        var layers = currentDocument.layers.selected;

        if (layers === null || layers.isEmpty()) {
            return Promise.resolve();
        }

        var currentLayer = layers.first();

        if (currentLayer.vectorMaskEnabled) {
            var deleteMaskOptions = {
                historyStateInfo: {
                    name: strings.ACTIONS.DELETE_VECTOR_MASK,
                    target: documentLib.referenceBy.id(currentDocument.id)
                }
            };
            return descriptor.playObject(vectorMaskLib.deleteVectorMask(), deleteMaskOptions)
                .bind(this)
                .then(function () {
                    var payload = {
                            documentID: currentDocument.id,
                            layerIDs: Immutable.List.of(currentLayer.id),
                            vectorMaskEnabled: false
                        },
                        event = events.document.history.optimistic.REMOVE_VECTOR_MASK_FROM_LAYER;

                    return this.dispatchAsync(event, payload);
                });
        } else {
            return Promise.resolve();
        }
    };
    deleteVectorMask.reads = [locks.JS_TOOL];
    deleteVectorMask.writes = [locks.PS_DOC, locks.JS_DOC];
    
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
    var beforeStartup = function () {
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
                    var curLayer = currentDocument.layers.byID(event.layerID);
                    if (curLayer) {
                        this.flux.actions.layers.resetLayers(currentDocument, curLayer, true);
                    } else {
                        // The `addLayers` actions is delayed because the new layer is not always avaialble 
                        // for read when we receive the `make` event. Without the delay, we may result in 
                        // "base element not found" error. For example, creating a new layer with the pen tool.
                        // 
                        // FIXME: Photoshop should make sure the new layer is ready for read before 
                        // emitting the `make` event.
                        window.setTimeout(function () {
                            this.flux.actions.layers.addLayers(currentDocument, event.layerID);
                        }.bind(this), 100);
                    }
                } else {
                    this.flux.actions.documents.updateDocument();
                }

                var currentTool = toolStore.getCurrentTool();

                // Log the tool used to make this layer
                if (currentTool) {
                    var toolID = currentTool.id;
                    headlights.logEvent("tools", "create", _.kebabCase(toolID));
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
                
                // reset layers, and AMEND history
                this.flux.actions.layers.resetLayers(currentDocument, currentDocument.layers.selected, true);
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
            this.flux.actions.layers.handleCanvasShift(event);
        }.bind(this);
        descriptor.addListener("autoCanvasResizeShift", _autoCanvasResizeShiftHandler);

        // Listeners for shift / option shape drawing
        _updateShapeHandler = function () {
            var applicationStore = this.flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();

            if (currentDocument !== null) {
                var layers = currentDocument.layers.selected;
                
                this.flux.actions.layers.resetBoundsQuietly(currentDocument, layers);
            }
        }.bind(this);

        descriptor.addListener("addTo", _updateShapeHandler);
        descriptor.addListener("subtractFrom", _updateShapeHandler);
        // Supposed to be intersectWith, but it's defined twice and interfaceWhite is defined before
        descriptor.addListener("interfaceWhite", _updateShapeHandler);
        descriptor.addListener("nudgePathPoints", _updateShapeHandler);

        // Listener for path changes
        _pathOperationHandler = function (event) {
            // We don't reset the bounds after newPath commands because those
            // also trigger a layer "make" event, and so the new layer model
            // will be initialized with the correct bounds.
            if (event.command === "pathChange") {
                var applicationStore = this.flux.store("application"),
                    currentDocument = applicationStore.getCurrentDocument();

                if (currentDocument) {
                    var currentLayers = currentDocument.layers,
                        layerIDs = _.pluck(_.rest(event.null._ref), "_id"),
                        layers = Immutable.List(layerIDs.map(currentLayers.byID, currentLayers));

                    this.flux.actions.layers.resetBoundsQuietly(currentDocument, layers);
                }
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
            // 
            // We also do not want to delete layers while a use is in vector mask editing mode
            // since they presumably want to be deleteing the vector mask instead
            var selection = window.getSelection();
            if (selection.type !== "Range" && !this.flux.store("tool").getVectorMode()) {
                this.flux.actions.layers.deleteSelected();
            }
        }.bind(this);

        var backspacePromise = this.transfer(shortcuts.addShortcut, OS.eventKeyCode.BACKSPACE, {}, deleteFn),
            deletePromise = this.transfer(shortcuts.addShortcut, OS.eventKeyCode.DELETE, {}, deleteFn);

        return Promise.join(backspacePromise, deletePromise);
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [locks.JS_SHORTCUT, locks.JS_POLICY, locks.PS_APP];
    beforeStartup.transfers = [shortcuts.addShortcut];

    /**
     * Send info about layers to search store
     *
     * @private
     * @return {Promise}
     */
    var afterStartup = function () {
        searchActions.registerAllLayerSearch.call(this);
        searchActions.registerCurrentLayerSearch.call(this);
        return Promise.resolve();
    };
    afterStartup.reads = [];
    afterStartup.writes = [];

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
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
    onReset.reads = [];
    onReset.writes = [];

    exports.select = select;
    exports.rename = rename;
    exports.selectAll = selectAll;
    exports.deselectAll = deselectAll;
    exports.removeLayers = removeLayers;
    exports.deleteSelected = deleteSelected;
    exports.groupSelected = groupSelected;
    exports.groupSelectedInCurrentDocument = groupSelectedInCurrentDocument;
    exports.ungroupSelected = ungroupSelected;
    exports.setVisibility = setVisibility;
    exports.setVisibilitySelectedInCurrentDocument = setVisibilitySelectedInCurrentDocument;
    exports.setLocking = setLocking;
    exports.setOpacity = setOpacity;
    exports.lockSelectedInCurrentDocument = lockSelectedInCurrentDocument;
    exports.unlockSelectedInCurrentDocument = unlockSelectedInCurrentDocument;
    exports.reorder = reorderLayers;
    exports.bringToFront = bringToFront;
    exports.bringForward = bringForward;
    exports.sendBackward = sendBackward;
    exports.sendToBack = sendToBack;
    exports.setBlendMode = setBlendMode;
    exports.addLayers = addLayers;
    exports.resetSelection = resetSelection;
    exports.initializeLayers = initializeLayers;
    exports.resetLayers = resetLayers;
    exports.resetLayersByIndex = resetLayersByIndex;
    exports.resetLayerVisibility = resetLayerVisibility;
    exports.resetBounds = resetBounds;
    exports.resetBoundsQuietly = resetBoundsQuietly;
    exports.setProportional = setProportional;
    exports.createArtboard = createArtboard;
    exports.resetLinkedLayers = resetLinkedLayers;
    exports.duplicate = duplicate;
    exports.setGroupExpansion = setGroupExpansion;
    exports.revealLayers = revealLayers;
    exports.resetIndex = resetIndex;
    exports.handleCanvasShift = handleCanvasShift;
    exports.editVectorMask = editVectorMask;
    exports.selectVectorMask = selectVectorMask;
    exports.addVectorMask = addVectorMask;
    exports.deleteVectorMask = deleteVectorMask;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;

    exports._getLayersForDocument = _getLayersForDocument;
    exports._verifyLayerSelection = _verifyLayerSelection;
    exports._verifyLayerIndex = _verifyLayerIndex;
    exports._getLayerIDsForDocumentID = _getLayerIDsForDocumentID;

    exports.afterStartup = afterStartup;
});
