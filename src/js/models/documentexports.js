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

    var ExportAsset = require("./exportasset");

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

    /**
     * Produce an array of ExportAssets for the given layerID, converted to a JS object
     * This is used for serializing the data to Ps metadata store
     *
     * @param {number} layerID
     * @return {Array.<object>} An array of ExportAsset-like JS objects
     */
    DocumentExports.prototype.layerExportsArray = function (layerID) {
        var layerExports = this.layerExportsMap.get(layerID);

        if (layerExports && layerExports.size > 0) {
            return layerExports.toJS();
        } else {
            return [];
        }
    };

    /**
     * Produce an array of ExportAssets for the root of this document, converted to a JS object
     * This is used for serializing the data to Ps metadata store
     *
     * @return {Array.<object>} An array of ExportAsset-like JS objects
     */
    DocumentExports.prototype.rootExportsArray = function () {
        if (this.rootExports && this.rootExports.size > 0) {
            return this.rootExports.toJS();
        } else {
            return [];
        }
    };

    /**
     * Given an array of layer descriptors, populate the layerExportsMap with lists of ExportAssets
     *
     * @param {{layers: Array.<object>}} payload
     * @return {DocumentExports}
     */
    DocumentExports.fromDescriptors = function (payload) {
        var layers = payload.layers || [];

        // TODO the doc/root level exports, maybe?

        var layerExportsMap = new Map();

        layers.forEach(function (layer) {
            var layerExports = [];
            if (layer.exportAssets && layer.exportAssets.length > 0) {
                layer.exportAssets.forEach(function (exportAsset) {
                    var _exportAsset = new ExportAsset(exportAsset);
                    layerExports.push(_exportAsset);
                });
            }
            layerExportsMap.set(layer.layerID, Immutable.List(layerExports));
        });
        
        return new DocumentExports({ layerExportsMap: Immutable.Map(layerExportsMap) });
    };

    /**
     * Given an array of layerIDs and an array of asset prop objects,
     * merge the props into each layer assets by index, adding where necessary
     *
     * @param {Array.<number>} layerIDs 
     * @param {Array.<object>} assetProps Array of asset property objects (possibly sparse)
     *
     * @return {DocumentExports}
     */
    DocumentExports.prototype.mergeLayerAssets = function (layerIDs, assetProps) {
        var nextLayerExportsMap = new Map();

        layerIDs.forEach(function (layerID) {
            var assetList = this.layerExportsMap.get(layerID) || Immutable.List(),
                nextAssetList = [],
                tempAssetProps = _.clone(assetProps);

            assetList.forEach(function (value) {
                var tempProps = tempAssetProps.shift();
                if (tempProps) {
                    nextAssetList.push(value.mergeProps(tempProps));
                } else {
                    nextAssetList.push(value);
                }
            });

            // any remaining asset props should be added
            tempAssetProps.forEach(function (props) {
                var newAsset = new ExportAsset(props);
                if (!_.has(props, "suffix")) {
                    newAsset = newAsset.deriveSuffix();
                }
                nextAssetList.push(newAsset);
            });

            nextLayerExportsMap.set(layerID, Immutable.List(nextAssetList));
        }.bind(this));

        return this.mergeIn(["layerExportsMap"], nextLayerExportsMap);
    };

    /**
     * Remove the asset from the given layer's list, by index
     *
     * @param {number} layerID
     * @param {number} assetIndex
     * @return {DocumentExports}
     */
    DocumentExports.prototype.removeLayerAsset = function (layerID, assetIndex) {
        return this.deleteIn(["layerExportsMap", layerID, assetIndex]);
    };

    /**
     * Given a set of layer IDs, set all associated assets with the "requested" status
     *
     * @param {Immutable.Set.<number>} layerIDs
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
