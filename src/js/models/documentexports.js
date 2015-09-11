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

    var Immutable = require("immutable"),
        _ = require("lodash");

    var ExportAsset = require("./exportasset"),
        collection = require("js/util/collection"),
        objUtil = require("js/util/object");

    /**
     * Internal representation of a document's various exports
     * @private
     * @constructor
     */
    var DocumentExports = Immutable.Record({
        /**
         * Map of root (document) level export assets, indexed by Id
         * @type {Immutable.List<ExportAsset>}
        */
        rootExports: Immutable.List(),

        /**
         * Map of Lists of assets, by layer ID
         * @type {Immutable.Map<number, Immutable.List.<ExportAsset>>}
         */
        layerExportsMap: Immutable.Map()
    });

    Object.defineProperties(DocumentExports.prototype, objUtil.cachedGetSpecs({
        /**
         * Get a list of layer IDs that have a non-empty set of configured export assets
         *
         * @return {Immutable.List.<number>}
         */
        layerIDsWithExports: function () {
            return this.layerExportsMap
                .filterNot(function (layerExports) {
                    return layerExports.isEmpty();
                })
                .keySeq()
                .toList();
        }
    }));

    /**
     * Given an array of layer descriptors, populate both the rootExports and layerExportsMap
     * with lists of ExportAssets derived from the photoshop extension data
     *
     * @param {{document: object, layers: Array.<object>}} payload
     * @return {DocumentExports}
     */
    DocumentExports.fromDescriptors = function (payload) {
        var layers = payload.layers || [],
            document = payload.document;

        // generate List of ExportAssets based on an array of simple props objects
        var _toListOfAssets = function (propsArray) {
            if (!propsArray || !_.isArray(propsArray)) {
                return new Immutable.List();
            }
            return Immutable.List(propsArray.map(function (props) {
                return new ExportAsset(props);
            }));
        };

        var rootExports = _toListOfAssets(document.exportAssets);

        var layerExportsMap = Immutable.Map(layers.map(function (layer) {
            var exportList = _toListOfAssets(layer.exportAssets);
            return [layer.layerID, exportList];
        }));
        
        return new DocumentExports({
            layerExportsMap: layerExportsMap,
            rootExports: rootExports
        });
    };

    /**
     * Get a List of ExportAssets for the given layerID
     *
     * @param {number} layerID
     * @return {?Immutable.List.<ExportAsset>}
     */
    DocumentExports.prototype.getLayerExports = function (layerID) {
        return this.layerExportsMap.get(layerID);
    };

    /**
     * Generate a list of Layers in index order for which there is at least one configured export asset
     * If artboards is not supplied, include all layers.  Otherwise filter(in/out) artboards accordingly
     *
     * @param {Document} document
     * @param {boolean=} artboards if provided filter in/out artboards
     * @param {boolean=} exportEnabled if provided, also filter layers by exportEnabled
     * @return {Immutable.List.<Layer>}
     */
    DocumentExports.prototype.getLayersWithExports = function (document, artboards, exportEnabled) {
        var layers;

        if (artboards === undefined) {
            layers = document.layers.all;
        } else if (artboards) {
            layers = document.layers.artboards;
        } else {
            layers = document.layers.all
                .filterNot(function (layer) {
                    return layer.isArtboard;
                });
        }

        if (exportEnabled) {
            layers = layers.filter(function (layer) {
                return layer.exportEnabled;
            });
        } else if (exportEnabled === false) {
            layers = layers.filterNot(function (layer) {
                return layer.exportEnabled;
            });
        }

        return layers
            .filter(function (layer) {
                return this.layerIDsWithExports.includes(layer.id);
            }, this);
    };

    /**
     * Given a list of layers, return the sub-set that has no export assets configured
     *
     * @param {Immutable.List.<Layer>} layers
     * @return {Immutable.List.<Layer>}
     */
    DocumentExports.prototype.filterLayersWithoutExports = function (layers) {
        return layers.filter(function (layer) {
            var layerExports = this.getLayerExports(layer.id);
            return !layerExports || layerExports.isEmpty();
        }, this);
    };

    /**
     * Given a set of layers, produce a "zipped" list of of lists of ExportAssets for those layers,
     * grouped by index within the layers
     *
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {Immutable.IndexedSeq.<Immutable.Iterable.<?ExportAsset>>}
     */
    Object.defineProperty(DocumentExports.prototype, "getAssetGroups",
        objUtil.cachedLookupSpec(function (layers) {
            var exportLists = layers.map(function (layer) {
                return this.getLayerExports(layer.id);
            }, this);

            return collection.zip(exportLists);
        }));

    /**
     * Given a set of layers, get a list of common ExportAssets, or null if none
     *
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {Immutable.List.<?ExportAsset>}
     */
    Object.defineProperty(DocumentExports.prototype, "getUniformAssets",
        objUtil.cachedLookupSpec(function (layers) {
            var assetGroups = this.getAssetGroups(layers);

            return assetGroups
                .map(function (group) {
                    return collection.uniformValue(group, ExportAsset.similar);
                })
                .toList(); // assetGroups is an IndexedSeq
        }));

    /**
     * Given a set of layers, get a list of common ExportAssets, but trimmed
     * to include only those with valid values.
     * Caveat: this changes the relative position of the assets in their original list,
     * so don't rely on the key for updating these assets later!
     *
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {Immutable.Iterable.<ExportAsset>}
     */
    Object.defineProperty(DocumentExports.prototype, "getUniformAssetsOnly",
        objUtil.cachedLookupSpec(function (layers) {
            return this.getUniformAssets(layers).filter(function (val) {
                return !!val;
            });
        }));

    /**
     * Given a set of layers, find the index of the last asset that is common to them all.
     * Per Immutable's findLastIndex, if not found then -1 is returned.
     * This is useful because this is used to add indexes at (this + 1)
     *
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {number}
     */
    Object.defineProperty(DocumentExports.prototype, "getLastUniformAssetIndex",
        objUtil.cachedLookupSpec(function (layers) {
            return this.getUniformAssets(layers).findLastIndex(function (val) {
                return !!val;
            });
        }));

    /**
     * Merge an array of asset-like objects into a List of ExportAssets
     * If the array is larger than the list, new Assets are added
     * The array may be sparse, and the matching elements in the assetList are not modified
     *
     * @private
     * @param {Immutable.Iterable.<ExportAsset>} assetList
     * @param {Array.<object>} assetProps Array of asset property objects
     * @return {Immutable.List.<ExportAsset>}
     */
    var _mergePropList = function (assetList, assetProps) {
        var tempAssetProps = _.clone(assetProps),
            nextAssetList;

        nextAssetList = assetList.map(function (value) {
            var tempProps = tempAssetProps.shift();
            if (tempProps) {
                return value.mergeProps(tempProps);
            } else {
                return value;
            }
        });

        // any remaining asset props should be added
        var newAssetArray = tempAssetProps.map(function (props) {
            var newAsset = new ExportAsset(props);
            if (!_.has(props, "suffix")) {
                newAsset = newAsset.deriveSuffix();
            }
            return newAsset;
        });

        return nextAssetList.concat(newAssetArray);
    };

    /**
     * Given an array of layerIDs and an array of asset prop objects,
     * merge the props into each layer assets by index, adding where necessary
     *
     * @param {Immutable.Iterable.<number>} layerIDs 
     * @param {Array.<?object>} assetProps Array of asset property objects (possibly sparse)
     *
     * @return {DocumentExports}
     */
    DocumentExports.prototype.mergeLayerAssets = function (layerIDs, assetProps) {
        var nextLayerExportsMap = Immutable.Map(layerIDs.map(function (layerID) {
            var assetList = this.layerExportsMap.get(layerID) || Immutable.List(),
                nextAssetList = _mergePropList(assetList, assetProps);

            return [layerID, nextAssetList];
        }, this));

        return this.mergeDeepIn(["layerExportsMap"], nextLayerExportsMap);
    };

    /**
     * Splice an array of new assets into the given layers at the given index.
     * New ExportAssets are generated from the provided property objects
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {Array.<object>} assetProps Array of asset property objects
     * @param {number} index index at which to insert the new elements
     * @return {DocumentExport}
     */
    DocumentExports.prototype.spliceLayerAssets = function (layerIDs, assetProps, index) {
        var nextLayerExportsMap = Immutable.Map(layerIDs.map(function (layerID) {
            var newAssetArray = assetProps.map(function (props) {
                var newAsset = new ExportAsset(props);
                if (!_.has(props, "suffix")) {
                    newAsset = newAsset.deriveSuffix();
                }
                return newAsset;
            });

            var assetList = this.layerExportsMap.get(layerID) || Immutable.List(),
                nextAssetList = assetList.splice.apply(assetList, [index, 0].concat(newAssetArray));

            return [layerID, nextAssetList];
        }, this));
        return this.mergeDeepIn(["layerExportsMap"], nextLayerExportsMap);
    };

    /**
     * Splice an array of new assets into the document root list, at the given index.
     * New ExportAssets are generated from the provided property objects
     *
     * @param {Array.<object>} assetProps Array of asset property objects
     * @param {number} index index at which to insert the new elements
     * @return {DocumentExport}
     */
    DocumentExports.prototype.spliceRootAssets = function (assetProps, index) {
        var newAssetArray = assetProps.map(function (props) {
            var newAsset = new ExportAsset(props);
            if (!_.has(props, "suffix")) {
                newAsset = newAsset.deriveSuffix();
            }
            return newAsset;
        });

        var rootExports = this.rootExports,
            nextRootExports = rootExports.splice.apply(rootExports, [index, 0].concat(newAssetArray));

        return this.mergeIn(["rootExports"], nextRootExports);
    };
    
    /**
     * Given an array of asset prop objects,
     * merge the props into each assets by index, adding where necessary
     *
     * @param {Array.<object>} assetProps Array of asset property objects (possibly sparse)
     *
     * @return {DocumentExports}
     */
    DocumentExports.prototype.mergeRootAssets = function (assetProps) {
        var nextRootExports = _mergePropList(this.rootExports, assetProps);
        return this.mergeIn(["rootExports"], nextRootExports);
    };

    /**
     * Remove the asset from the given layer's list, by index
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number} assetIndex
     * @return {DocumentExports}
     */
    DocumentExports.prototype.removeLayerAsset = function (layerIDs, assetIndex) {
        var nextLayerExportsMap = this.layerExportsMap.map(function (layerExports, key) {
            return layerIDs.includes(key) ? layerExports.delete(assetIndex) : layerExports;
        });
        return this.set("layerExportsMap", nextLayerExportsMap);
    };

    /**
     * Remove the asset from the given layer's list, by index
     *
     * @param {number} assetIndex
     * @return {DocumentExports}
     */
    DocumentExports.prototype.removeRootAsset = function (assetIndex) {
        return this.deleteIn(["rootExports", assetIndex]);
    };

    /**
     * Set all root assets with the "requested" status
     *
     * @return {DocumentExports}
     */
    DocumentExports.prototype.setRootExportsRequested = function () {
        var newList = this.rootExports.map(function (asset) {
            return asset.setStatusRequested();
        });

        return this.set("rootExports", newList);
    };

    /**
     * Given a set of layer IDs, set all associated assets with the "requested" status
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @return {DocumentExports}
     */
    DocumentExports.prototype.setLayerExportsRequested = function (layerIDs) {
        var newMap = this.layerExportsMap
            .filter(function (value, key) {
                return layerIDs.includes(key);
            })
            .map(function (layerExports) {
                return layerExports.map(function (asset) {
                    return asset.setStatusRequested();
                });
            });

        return this.mergeIn(["layerExportsMap"], newMap);
    };

    module.exports = DocumentExports;
});
