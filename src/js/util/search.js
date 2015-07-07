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

    var Immutable = require("immutable"),
        _ = require("lodash");

    var pathUtil = require("js/util/path"),
        svgUtil = require("js/util/svg"),
        collection = require("js/util/collection"),
        strings = require("i18n!nls/strings");

    /**
     * Strings for labeling search options
     *  
     * @const
     * @type {object} 
    */
    var HEADERS = strings.SEARCH.HEADERS,
        CATEGORIES = strings.SEARCH.CATEGORIES;

    /**
     * Get the layer type and if it is linked or an artboard, as an array of strings.
     * This is used for comparison against the inputted search terms and any search filters.
     * Not directly user-visible, but needs to be able to match user input.
     *
     * @private
     * @param {Layer} layer
     * @return {Array.<string>}
    */
    var _getLayerCategory = function (layer) {
        var layerType = [CATEGORIES.LAYER];

        if (layer.kind === layer.layerKinds.GROUP && layer.isArtboard) {
            layerType.push(CATEGORIES.ARTBOARD);
        } else {
            // Find string associated with layer.kind, which is a number
            _.forEach(Object.keys(layer.layerKinds), function (type) {
                if (layer.kind === layer.layerKinds[type]) {
                    layerType.push(CATEGORIES[type].replace(" ", ""));
                }
            });
        }

        if (layer.isLinked) {
            layerType.push(CATEGORIES.LINKED);
        }

        return layerType;
    };

    /**
     * Get the layer ancestry
     *
     * @private
     * @param {Layer} layer
     * @return {string}
    */
    var _formatLayerAncestry = function (layer, appStore) {
        var layerTree = appStore.getCurrentDocument().layers,
            ancestors = layerTree.ancestors(layer),
            ancestorNames = ancestors.first().name;
            
        return ancestors.skip(1).reduce(function (ancestors, ancestor) {
            return ancestorNames += ("/" + ancestor.name);
        }, ancestorNames);
    };

    /**
     * Make list of layers in the current document to be used as dropdown options
     * 
     * @return {Array.<object>}
     */
    var getLayerOptions = function (appStore) {
        // Get list of layers
        var document = appStore.getCurrentDocument(),
            layers = document.layers.allVisibleReversed,
            layerMap = layers.map(function (layer) {
                var ancestry = _formatLayerAncestry(layer, appStore),
                    layerType = _getLayerCategory(layer),
                    iconID = svgUtil.getSVGClassFromLayer(layer);

                return {
                    id: "layer_" + layer.id.toString(),
                    title: layer.name,
                    info: ancestry,
                    displayInfo: ancestry,
                    svgType: iconID,
                    category: layerType,
                    type: "item"
                };
            }.bind(this)),

            // Get shortest unique layer ancestry
            ancestors = collection.pluck(layerMap, "info"),
            shortenedPaths = pathUtil.getShortestUniquePaths(ancestors).toJS();

        layerMap.forEach(function (layerItem, index) {
            var newInfo = shortenedPaths[index];
            
            // Only show ancestry if other layers have the same name
            if (layerItem.title === newInfo) {
                layerItem.displayInfo = "";
            } else {
                layerItem.displayInfo = newInfo;
            }
        });

        var layerLabel = {
            id: "layer_header",
            title: HEADERS.LAYER,
            type: "header"
        },
        layerOptions = layerMap.unshift(layerLabel);

        return layerOptions;
    };

    /**
     * Make list of currently open documents to be used as dropdown options
     * 
     * @return {Array.<object>}
     */
    var getCurrentDocOptions = function (appStore, docStore) {
        var document = appStore.getCurrentDocument(),
            openDocs = appStore.getOpenDocumentIDs().filterNot(function (doc) {
                            return doc === document.id;
                        }),
            docMap = openDocs.map(function (doc) {
                return {
                    id: "curr-doc_" + doc.toString(),
                    title: docStore.getDocument(doc).name,
                    type: "item",
                    category: [CATEGORIES.DOCUMENT, CATEGORIES.CURRENT]
                };
            }),
            docLabel = {
                id: "curr-doc_header",
                title: HEADERS.CURRENT_DOC,
                type: "header"
            },

            docOptions = docMap.unshift(docLabel);

        return docOptions;
    };

    /**
     * Make list of recent documents to be used as dropdown options
     * 
     * @return {Array.<object>}
    */
    var getRecentDocOptions = function (appStore) {
        var recentFiles = appStore.getRecentFiles(),
            recentDocMap = recentFiles.map(function (doc, index) {
                return {
                    id: "recent-doc_" + index.toString(),
                    title: pathUtil.getShortestUniquePaths(Immutable.List.of(doc)).toJS()[0],
                    type: "item",
                    info: doc,
                    displayInfo: doc,
                    category: [CATEGORIES.DOCUMENT, CATEGORIES.RECENT]
                };
            });
        
        // Get shortest unique file path
        var paths = collection.pluck(recentDocMap, "info"),
            shortenedPaths = pathUtil.getShortestUniquePaths(paths).toJS();

        recentDocMap.forEach(function (docItem, index) {
            docItem.displayInfo = shortenedPaths[index];
        });

        var recentDocLabel = {
            id: "recent-doc_header",
            title: HEADERS.RECENT_DOC,
            type: "header"
        };

        return recentDocMap.unshift(recentDocLabel);
    };

    exports.getLayerOptions = getLayerOptions;
    exports.getRecentDocOptions = getRecentDocOptions;
    exports.getCurrentDocOptions = getCurrentDocOptions;
});
