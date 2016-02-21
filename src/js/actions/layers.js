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
        
    var photoshopEvent = require("adapter").lib.photoshopEvent,
        descriptor = require("adapter").ps.descriptor,
        documentLib = require("adapter").lib.document,
        layerLib = require("adapter").lib.layer,
        appLib = require("adapter").lib.application,
        OS = require("adapter").os;

    var Layer = require("js/models/layer"),
        collection = require("js/util/collection"),
        documentActions = require("./documents"),
        historyActions = require("./history"),
        log = require("js/util/log"),
        events = require("../events"),
        shortcuts = require("./shortcuts"),
        guides = require("./guides"),
        tools = require("./tools"),
        layerActionsUtil = require("js/util/layeractions"),
        locks = require("js/locks"),
        locking = require("js/util/locking"),
        headlights = require("js/util/headlights"),
        nls = require("js/util/nls"),
        global = require("js/util/global");

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
        "bounds",
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
     * Namespace for extension metadata.
     * 
     * @const
     * @type {string}
     */
    var METADATA_NAMESPACE = global.EXTENSION_DATA_NAMESPACE;

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
        var layerPropertiesPromise = references.length === 0 ? Promise.resolve([]) :
                descriptor.batchMultiGetProperties(references, _layerProperties),
            optionalProperties = lazy ? _optionalLayerProperties : _allOptionalLayerProperties,
            optionalPropertiesPromise = references.length === 0 ? Promise.resolve([]) :
                descriptor.batchMultiGetProperties(references, optionalProperties, { continueOnError: true });

        var extensionPromise;
        if (lazy || references.length === 0) {
            extensionPromise = Promise.resolve();
        } else {
            var extensionPlayObjects = references.map(function (ref) {
                return layerLib.getExtensionData(ref[0], ref[1], METADATA_NAMESPACE);
            });

            extensionPromise = descriptor.batchPlayObjects(extensionPlayObjects)
                .map(function (extensionData) {
                    var extensionDataRoot = extensionData[METADATA_NAMESPACE];
                    return (extensionDataRoot && extensionDataRoot.exportsMetadata) || {};
                });
        }

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
                    docRef,
                    layerLib.referenceBy.index(startIndex + target._index)
                ];
            });

        return Promise.join(requiredPropertiesPromise, optionalPropertiesPromise,
            function (required, optional) {
                return _.zipWith(required, optional, _.merge);
            })
            .tap(function (properties) {
                var extensionPromise;
                if (doc.hasBackgroundLayer && doc.numberOfLayers === 0 && targetLayers.length === 1) {
                    // Special case for background-only documents, which can't contain metadata
                    extensionPromise = Promise.resolve([{}]);
                } else if (targetLayers.length !== 0) {
                    var extensionPlayObjects = targetRefs.map(function (refObj) {
                        var layerRef = refObj[1];
                        return layerLib.getExtensionData(docRef, layerRef, METADATA_NAMESPACE);
                    });

                    extensionPromise = descriptor.batchPlayObjects(extensionPlayObjects)
                        .map(function (extensionData) {
                            var extensionDataRoot = extensionData[METADATA_NAMESPACE];
                            return (extensionDataRoot && extensionDataRoot.exportsMetadata) || {};
                        });
                } else {
                    extensionPromise = Promise.resolve([]);
                }

                return extensionPromise.then(function (allData) {
                    var lazyPropertiesPromise = targetLayers.length === 0 ? Promise.resolve([]) :
                            descriptor.batchMultiGetProperties(targetRefs, _lazyLayerProperties,
                                { continueOnError: true });

                    return lazyPropertiesPromise.each(function (lazyProperties, index) {
                        if (!lazyProperties) {
                            // A background will not have a layer ID
                            return;
                        }

                        var propertiesByID = _.indexBy(properties, "layerID"),
                            lazyLayerID = lazyProperties.layerID,
                            extensionData = allData[index];

                        _.merge(propertiesByID[lazyLayerID], lazyProperties, extensionData);
                    });
                });
            })
            .then(function (properties) {
                return properties.reverse();
            });
    };

    /**
     * The list of properties on the Photoshop layer descriptor that corresponds to bounds.
     *
     * @private
     * @param {Layer} layer
     * @return {string}
     */
    var _boundsPropertiesForLayer = function (layer) {
        var property;

        if (layer.isArtboard) {
            property = ["artboard"];
        } else if (layer.isVector) {
            property = ["pathBounds", "keyOriginType"];
        } else if (layer.isText) {
            property = ["boundingBox"];
        } else if (layer.isGroup && layer.vectorMaskEnabled) {
            property = ["bounds", "vectorMaskEnabled"];
        } else {
            property = ["boundsNoMask"];
        }

        return property;
    };

    /**
     * Get the ordered list of layer IDs for the given Document ID.
     *
     * @private
     * @param {number} documentID
     * @return {Promise.<{documentID: number, layerIDs: Array.<number>}>}
     */
    var getLayerIDsForDocumentID = function (documentID) {
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
    getLayerIDsForDocumentID.action = {
        reads: [locks.PS_DOC],
        writes: [],
        modal: true
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
        
        layerSpec.forEach(function (layerID) {
            var layer = document.layers.byID(layerID);

            if (layer) {
                throw new Error("Trying to add a layer that already exists: " + layerID + " " + layer.name);
            }
        });

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
                    replace: replace,
                    history: {
                        newState: true,
                        amendRogue: true
                    }
                };

                this.dispatch(events.document.history.ADD_LAYERS, payload);

                var nextDocument = this.flux.store("document").getDocument(document.id),
                    nextLayerCount = nextDocument.layers.all.size,
                    naiveLayerCount = document.layers.all.size + layerSpec.length;

                return nextLayerCount !== naiveLayerCount;
            });
    };
    addLayers.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        modal: true,
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
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
     * Emit RESET_LAYERS with layer descriptors for all given layers.
     *
     * @param {Document} document
     * @param {Layer|Immutable.Iterable.<Layer>} layers
     * @param {boolean=} suppressDirty If truthy, do NOT dirty the document.
     * @param {boolean=} lazy If true, non-selected layers will only have their
     *  non-lazy properties updated, and will be returned to an uninitialized
     *  state. This is a performance optimization. NOTE: the selection state
     *  of the layer models passed in must be accurate for this to work correctly!
     * @return {Promise}
     */
    var resetLayers = function (document, layers, suppressDirty, lazy) {
        if (layers instanceof Layer) {
            layers = Immutable.List.of(layers);
        } else if (layers.isEmpty()) {
            return Promise.resolve();
        }

        var storedDocument = this.flux.store("document").getDocument(document.id);

        if (!storedDocument) {
            log.debug("Ignoring this resetLayers call, the document does not exist");
            return Promise.resolve();
        }

        var docRef = documentLib.referenceBy.id(document.id),
            layersPromise;

        if (lazy) {
            var selectedLayerRefs = layers
                .filter(function (layer) {
                    return layer.selected;
                })
                .map(function (layer) {
                    return [
                        docRef,
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
                        docRef,
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
                    docRef,
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
                        documentID: storedDocument.id,
                        suppressDirty: suppressDirty,
                        lazy: lazy
                    };

                payload.layers = layers.map(function (layer) {
                    return {
                        layerID: layer.id,
                        descriptor: descriptors[index++]
                    };
                });
                this.dispatch(events.document.history.RESET_LAYERS, payload);
            });
    };
    resetLayers.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        modal: true
    };

    /**
     * Emit a RESET_BOUNDS with bounds descriptors for the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {Promise}
     */
    var resetBounds = function (document, layers) {
        if (layers.isEmpty()) {
            return Promise.resolve();
        }

        var layerIDIndex = [],
            layersWithBounds = layers
                .filterNot(function (layer) {
                    // We don't track bounds of non-artboard groups or adjustment layers
                    return layer.isGroupEnd ||
                        (layer.isGroup && !(layer.isArtboard || layer.vectorMaskEnabled)) ||
                        layer.isAdjustment;
                });

        var propertyRefs = layersWithBounds
            .toArray()
            .reduce(function (propArray, layer) {
                var properties = _boundsPropertiesForLayer(layer),
                    propertyRefs = properties.map(function (property) {
                        layerIDIndex.push(layer.id);
                        
                        return [
                            documentLib.referenceBy.id(document.id),
                            layerLib.referenceBy.id(layer.id),
                            {
                                _ref: "property",
                                _property: property
                            }
                        ];
                    });

                return propArray.concat(propertyRefs);
            }, []);

        return descriptor.batchGet(propertyRefs)
            .bind(this)
            .then(function (boundProps) {
                var payload = {
                    documentID: document.id
                };

                payload.bounds = layersWithBounds.map(function (layer) {
                    var descriptorProps = boundProps.filter(function (props, index) {
                        return layer.id === layerIDIndex[index];
                    });
                    
                    return {
                        layerID: layer.id,
                        descriptor: _.merge.apply(_, descriptorProps)
                    };
                });

                this.dispatch(events.document.history.RESET_BOUNDS, payload);

                return this.transfer(guides.queryCurrentGuides);
            });
    };
    resetBounds.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        modal: true,
        transfers: [guides.queryCurrentGuides]
    };

    /** 
     * Transfers to reset bounds, but if there is a failure, quietly fails instead of 
     * causing a reset. We use this for pathOperation notifications
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {Promise}
     */
    var resetBoundsQuietly = function (document, layers) {
        return this.transfer(resetBounds, document, layers)
            .catch(function () {});
    };
    resetBoundsQuietly.action = {
        reads: [],
        writes: [],
        modal: true,
        transfers: [resetBounds]
    };

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
            return layer.isSmartObject;
        });

        if (linkedLayers.isEmpty()) {
            return Promise.resolve();
        }
        return this.transfer(resetBounds, document, linkedLayers);
    };
    resetLinkedLayers.action = {
        reads: [locks.JS_DOC],
        writes: [],
        modal: true,
        transfers: [resetBounds]
    };

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
                this.dispatch(events.document.history.RESET_LAYERS_BY_INDEX, payload);
            });
    };
    resetLayersByIndex.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        modal: true
    };

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
    resetLayerVisibility.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        modal: true
    };

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
    initializeLayers.action = {
        reads: [],
        writes: [],
        transfers: [resetLayers],
        modal: true
    };

    /**
     * Initialize layers in blocks of 50. This should be run as an idle task.
     *
     * @param {Document} document
     * @return {Promise} Resolves either when all layers are initialized, or if
     *  the document is closed.
     */
    var initializeLayersBackground = function (document) {
        var flux = this.flux,
            documentStore = flux.store("document");

        document = documentStore.getDocument(document.id);
        if (!document) {
            return Promise.resolve();
        }

        var uninitializedLayers = document.layers.uninitialized;
        if (uninitializedLayers.isEmpty()) {
            return Promise.resolve();
        }

        var firstUninitializedLayers = uninitializedLayers.take(50);

        return this.transfer(initializeLayers, document, firstUninitializedLayers)
            .bind(this)
            .then(function () {
                if (firstUninitializedLayers.size === 50) {
                    this.whenIdle(initializeLayersBackground, document);
                }
            });
    };
    initializeLayersBackground.action = {
        reads: [locks.JS_DOC],
        writes: [],
        transfers: [initializeLayers],
        modal: true,
        allowFailure: true
    };

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

        return this.transfer("groups.setGroupExpansion", document, collapsedAncestors, true);
    };
    revealLayers.action = {
        reads: [locks.JS_DOC],
        writes: [],
        modal: true,
        transfers: ["groups.setGroupExpansion"]
    };

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
    resetSelection.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.JS_DOC],
        modal: true,
        transfers: [initializeLayers]
    };

    /**
     * Selects the given layer with given modifiers
     *
     * @param {Document} document Owner document
     * @param {Layer|Immutable.Iterable.<Layer>} layerSpec Either a single layer that
     *  the selection is based on, or a list of such layers.
     * @param {object=} options Object containins optional parameters
     * @param {string=} options.modifier Way of modifying the selection. Possible values
     *  are defined in `adapter/src/lib/layer.js` under `select.vals`.
     *  Default is similar to "select", but the pivot layer will always be cleared.
     * @param {boolean=} options.quiet If set, will prevent dispatches as result of this select
     *  Please use this sparingly, and making sure that you dispatch the correct events
     *  so UI is updated at some point
     *
     * @returns {Promise}
     */
    var select = function (document, layerSpec, options) {
        if (layerSpec instanceof Layer) {
            layerSpec = Immutable.List.of(layerSpec);
        }

        if (document.unsupported) {
            return Promise.resolve();
        }

        var modifier = options ? options.modifier : "selectNoPivot",
            quiet = options ? options.quiet : false,
            setPivot = layerSpec.size === 1,
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
        case "selectNoPivot":
            nextSelected = layerSpec;
            nextPivot = null;
            break;
        default:
            throw new Error("Layers.select is passed an invalid modifier");
        }

        var payload = {
            documentID: document.id,
            selectedIDs: collection.pluck(nextSelected, "id"),
            pivotID: nextPivot && nextPivot.id
        };

        var dispatchPromise,
            revealPromise;

        // If quiet is set, we are doing a drag event, and don't want a UI update
        // We dispatch the drag event with the selected layer IDs, so
        // the actual dispatch can be done after a "move" event arrives from PS
        if (quiet) {
            dispatchPromise = this.dispatchAsync(events.tool.SUPERSELECT_DRAG_UPDATE, payload);
            revealPromise = Promise.resolve();
        } else {
            dispatchPromise = this.dispatchAsync(events.document.SELECT_LAYERS_BY_ID, payload)
                .bind(this)
                .then(function () {
                    return this.transfer(initializeLayers, document, nextSelected);
                });
            revealPromise = this.transfer(revealLayers, document, nextSelected);
        }
        
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
    select.action = {
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [revealLayers, resetSelection, initializeLayers, tools.changeVectorMaskMode],
        post: ["verify.layers.verifyLayerSelection"]
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
    var rename = function (document, layer, newName) {
        var docRef = documentLib.referenceBy.id(document.id),
            actionName = nls.localize("strings.ACTIONS.RENAME_LAYER"),
            payload = {
                documentID: document.id,
                layerID: layer.id,
                name: newName,
                history: {
                    newState: true,
                    name: actionName
                }
            },
            layerRef = [
                docRef,
                layerLib.referenceBy.id(layer.id)
            ],
            renameObj = layerLib.rename(layerRef, newName),
            renamePromise = descriptor.playObject(renameObj),
            dispatchPromise = this.dispatchAsync(events.document.history.RENAME_LAYER, payload);

        return Promise.join(dispatchPromise, renamePromise);
    };
    rename.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

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
            dispatchPromise = this.dispatchAsync(events.document.SELECT_LAYERS_BY_ID, payload);

        return Promise.join(dispatchPromise, deselectPromise);
    };
    deselectAll.action = {
        reads: [locks.JS_APP],
        writes: [locks.PS_DOC, locks.JS_DOC],
        post: ["verify.layers.verifyLayerSelection"]
    };

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
    selectAll.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [],
        transfers: [select],
        post: ["verify.layers.verifyLayerSelection"]
    };

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
                    selectedIndices: selectedLayerIndices,
                    history: {
                        newState: true,
                        amendRogue: true
                    }
                };

                this.dispatch(events.document.history.DELETE_LAYERS, payload);

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
    removeLayers.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        modal: true,
        transfers: ["history.queryCurrentHistory", initializeLayers],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
    };

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
                    name: nls.localize("strings.ACTIONS.DELETE_LAYERS"),
                    target: documentLib.referenceBy.id(documentID)
                }
            };

        return locking.playWithLockOverride(document, layers, deletePlayObject, options, true)
            .bind(this)
            .then(function () {
                return this.transfer(removeLayers, document, layers);
            });
    };
    deleteSelected.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [removeLayers],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
    };

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
                layerProps: Immutable.Map([[layer.id, visible]])
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
    setVisibility.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

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
    setVisibilitySelectedInCurrentDocument.action = {
        reads: [locks.JS_DOC],
        writes: [],
        transfers: [setVisibility]
    };

    /**
     * Unlocks the background layer of the document
     * FIXME: Does not care about the document reference
     *
     * @param {Document} document
     * @param {Layer} layer
     * @returns {Promise}
     */
    var unlockBackgroundLayer = function (document, layer) {
        return descriptor.playObject(layerLib.unlockBackground(layer.id))
            .bind(this)
            .then(function (event) {
                var layerID = event.layerID;
                return this.transfer(addLayers, document, layerID, true, layer.id);
            });
    };
    unlockBackgroundLayer.action = {
        reads: [],
        writes: [locks.PS_DOC],
        transfers: [addLayers]
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
        if (layer.isBackground) {
            return this.transfer(unlockBackgroundLayer, document, layer);
        }

        var docRef = documentLib.referenceBy.id(document.id),
            actionName = locked ?
                nls.localize("strings.ACTIONS.LOCK_LAYER") :
                nls.localize("strings.ACTIONS.UNLOCK_LAYER"),
            payload = {
                documentID: document.id,
                layerID: layer.id,
                locked: locked,
                history: {
                    newState: true,
                    name: actionName
                }
            },
            layerRef = [
                docRef,
                layerLib.referenceBy.id(layer.id)
            ],
            dispatchPromise = this.dispatchAsync(events.document.history.LOCK_CHANGED, payload),
            lockPromise = descriptor.playObject(layerLib.setLocking(layerRef, locked));

        return Promise.join(dispatchPromise, lockPromise);
    };
    setLocking.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [addLayers, unlockBackgroundLayer],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
    };

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
                coalesce: !!options.coalesce,
                history: {
                    newState: true,
                    name: nls.localize("strings.ACTIONS.CHANGE_LAYER_OPACITY")
                }
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
                name: nls.localize("strings.ACTIONS.CHANGE_LAYER_OPACITY"),
                target: documentLib.referenceBy.id(document.id),
                coalesce: !!options.coalesce,
                suppressHistoryStateNotification: !!options.coalesce
            },
            paintOptions: {
                immediateUpdate: true,
                quality: "draft"
            }
        });

        var dispatchPromise = this.dispatchAsync(events.document.history.OPACITY_CHANGED, payload),
            opacityPromise = locking.playWithLockOverride(document, layers, playObjects.toArray(), playOptions);

        return Promise.join(dispatchPromise, opacityPromise);
    };
    setOpacity.action = {
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC]
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
    var lockSelectedInCurrentDocument = function () {
        return _setLockingInCurrentDocument.call(this, true);
    };
    lockSelectedInCurrentDocument.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [],
        transfers: [setLocking]
    };

    /**
     * Unlock the selected layers in the current document.
     * 
     * @return {Promise}
     */
    var unlockSelectedInCurrentDocument = function () {
        return _setLockingInCurrentDocument.call(this, false);
    };
    unlockSelectedInCurrentDocument.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [],
        transfers: [setLocking]
    };

    /**
     * Reset the layer z-index. Assumes that all layers are already in the model,
     * though possibly out of order w.r.t. Photoshop's model.
     *
     * @param {Document=} document Document for which layers should be reordered, if undefined, use current document
     * @return {Promise} Resolves to the new ordered IDs of layers as well as what layers should be selected
     */
    var resetIndex = function (document) {
        if (typeof document === "undefined") {
            document = this.flux.store("application").getCurrentDocument();

            if (!document) {
                return Promise.resolve();
            }
        }

        return this.transfer(getLayerIDsForDocumentID, document.id)
            .bind(this)
            .then(function (payload) {
                return _getSelectedLayerIndices(document).then(function (selectedIndices) {
                    payload.selectedIndices = selectedIndices;
                    return payload;
                });
            })
            .then(function (payload) {
                this.dispatch(events.document.history.REORDER_LAYERS, payload);
            })
            .then(function () {
                // get the document with latest selected layers, after layer reordering.
                var document = this.flux.store("application").getCurrentDocument();

                return this.transfer(initializeLayers, document, document.layers.selected);
            });
    };
    resetIndex.action = {
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC],
        modal: true,
        transfers: [initializeLayers, getLayerIDsForDocumentID],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
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
     * @param {number|string} target If a number, the target index to move layers to
     *                               If a string, the reference enum type ("front", "back", "previous", "next")
     *
     * @return {Promise} Resolves to the new ordered IDs of layers as well as what layers should be selected,
     *  or rejects if targetIndex is invalid, as example when it is a child of one of the layers in layer spec
     */
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
            historyStateName = nls.localize("strings.ACTIONS.REORDER_LAYERS");
      
        return this.transfer(historyActions.newHistoryState, document.id, historyStateName)
            .bind(this)
            .then(function () {
                return descriptor.playObject(reorderObj);
            })
            .catch(function (err) {
                // Ignore reorder errors if target was a string (called by one of the bring/send methods below)
                // since PS fails if we try to move a layer past the doc bounds
                // but we use PS enum references so we don't control the location
                if (numberRef) {
                    throw (err);
                }
            })
            .then(function () {
                return this.transfer(resetIndex, document);
            })
            .then(function () {
                // The selected layers may have changed after the reorder.
                var nextDocument = this.flux.store("document").getDocument(document.id);

                return this.transfer(resetBounds, nextDocument, nextDocument.layers.allSelected);
            });
    };
    reorderLayers.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC],
        transfers: [resetIndex, resetBounds, "history.newHistoryState"],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
    };

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
    bringToFront.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [],
        transfers: [reorderLayers],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
    };

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
    bringForward.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [],
        transfers: [reorderLayers],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
    };

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
    sendBackward.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [],
        transfers: [reorderLayers],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
    };

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
    sendToBack.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [],
        transfers: [reorderLayers],
        post: ["verify.layers.verifyLayerIndex", "verify.layers.verifyLayerSelection"]
    };

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
                name: nls.localize("strings.ACTIONS.SET_BLEND_MODE"),
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
            mode: mode,
            history: {
                newState: true,
                name: nls.localize("strings.ACTIONS.SET_BLEND_MODE")
            }
        };

        var dispatchPromise = this.dispatchAsync(events.document.history.BLEND_MODE_CHANGED, payload),
            blendPromise = locking.playWithLockOverride(document, layers,
                layerLib.setBlendMode(layerRef, mode), options);

        return Promise.join(dispatchPromise, blendPromise);
    };
    setBlendMode.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
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
    var setProportional = function (document, layerSpec, proportional) {
        layerSpec = layerSpec.filterNot(function (layer) {
            return layer.isGroupEnd;
        });

        var layerIDs = collection.pluck(layerSpec, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                proportional: proportional,
                history: {
                    newState: true,
                    name: nls.localize("strings.ACTIONS.SET_PROPORTIONAL_SCALE")
                }
            },
            options = {
                paintOptions: {
                    immediateUpdate: true,
                    quality: "draft"
                },
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.SET_PROPORTIONAL_SCALE"),
                    target: documentLib.referenceBy.id(document.id)
                }
            };

        var dispatchPromise = this.dispatchAsync(events.document.history.SET_LAYERS_PROPORTIONAL,
                payload),
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
    setProportional.action = {
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

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
                name: nls.localize("strings.ACTIONS.DUPLICATE_LAYERS"),
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
    duplicate.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: ["documents.updateDocument", addLayers, select],
        post: ["verify.layers.verifySelectedBounds", "verify.layers.verifyLayerSelection",
            "verify.layers.verifyLayerIndex"]
    };

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
        return this.transfer(resetBounds, document, document.layers.all);
    };
    handleCanvasShift.action = {
        reads: [locks.JS_DOC, locks.JS_APP],
        writes: [],
        transfers: [resetBounds],
        modal: true,
        post: ["verify.layers.verifySelectedBounds"],
        hideOverlays: true
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
        _autoCanvasResizeShiftHandler = _.debounce(function (event) {
            return this.flux.actions.layers.handleCanvasShift(event);
        }.bind(this), 500);
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
                    layerIDs: Immutable.List(event.layerID) || Immutable.List(),
                    history: {
                        newState: true,
                        amendRogue: true
                    }
                };
                
                this.dispatch(events.document.history.DELETE_LAYERS, payload);

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

        return Promise.resolve();
    };
    beforeStartup.action = {
        reads: [],
        writes: [],
        modal: true
    };

    /**
     * Send info about layers to search store
     *
     * @private
     * @return {Promise}
     */
    var afterStartup = function () {
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

        var shortcutSpecs = [
            {
                key: OS.eventKeyCode.BACKSPACE,
                modifiers: {},
                fn: deleteFn
            },
            {
                key: OS.eventKeyCode.DELETE,
                modifiers: {},
                fn: deleteFn
            }
        ];

        var preferencesObjects = [
            appLib.setAddCopyToLayerNames(false),
            appLib.setGlobalPreferences({
                skipTransformSOFromLibrary: true
            })
        ];

        var preferencesPromise = descriptor.batchPlayObjects(preferencesObjects),
            shortcutPromise = this.transfer(shortcuts.addShortcuts, shortcutSpecs),
            searchAllPromise = this.transfer("search.layers.registerAllLayerSearch"),
            searchCurrentPromise = this.transfer("search.layers.registerCurrentLayerSearch");

        return Promise.join(preferencesPromise, shortcutPromise, searchAllPromise, searchCurrentPromise);
    };
    afterStartup.action = {
        reads: [],
        writes: [locks.PS_APP],
        transfers: [shortcuts.addShortcuts, "search.layers.registerAllLayerSearch",
            "search.layers.registerCurrentLayerSearch"]
    };

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
    onReset.action = {
        reads: [],
        writes: []
    };

    exports.select = select;
    exports.rename = rename;
    exports.selectAll = selectAll;
    exports.deselectAll = deselectAll;
    exports.removeLayers = removeLayers;
    exports.deleteSelected = deleteSelected;
    exports.setVisibility = setVisibility;
    exports.setVisibilitySelectedInCurrentDocument = setVisibilitySelectedInCurrentDocument;
    exports.unlockBackgroundLayer = unlockBackgroundLayer;
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
    exports.initializeLayersBackground = initializeLayersBackground;
    exports.resetLayers = resetLayers;
    exports.resetLayersByIndex = resetLayersByIndex;
    exports.resetLayerVisibility = resetLayerVisibility;
    exports.resetBounds = resetBounds;
    exports.resetBoundsQuietly = resetBoundsQuietly;
    exports.setProportional = setProportional;
    exports.resetLinkedLayers = resetLinkedLayers;
    exports.duplicate = duplicate;
    exports.revealLayers = revealLayers;
    exports.resetIndex = resetIndex;
    exports.handleCanvasShift = handleCanvasShift;
    exports.getLayerIDsForDocumentID = getLayerIDsForDocumentID;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;

    exports._getLayersForDocument = _getLayersForDocument;
    exports._boundsPropertiesForLayer = _boundsPropertiesForLayer;

    exports.afterStartup = afterStartup;
});
