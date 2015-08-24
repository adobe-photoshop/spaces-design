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

    var events = require("js/events"),
        mathUtil = require("js/util/math"),
        svgUtil = require("js/util/svg");
    
    /**
     * Get the layer type and if it is linked or an artboard, as an array of strings.
     * This is used for comparison against any search filters.
     *
     * @private
     * @param {Layer} layer
     * @param {string} type
     * @return {Array.<string>}
    */
    var _getLayerCategory = function (layer, type) {
        var layerType = [type + "_LAYER"];

        if (layer.kind === layer.layerKinds.GROUP && layer.isArtboard) {
            layerType.push("ARTBOARD");
        } else {
            // Find string associated with layer.kind, which is a number
            _.forEach(Object.keys(layer.layerKinds), function (type) {
                if (layer.kind === layer.layerKinds[type]) {
                    layerType.push(type);
                }
            });
        }

        if (layer.isLinked) {
            layerType.push("LINKED");
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
     * Get the layer options from the specified document
     *
     * @private
     * @param {Document} document
     * @param {string} type Type of layer search, for finding correct layer category
     * @return {Immutable.List.<object>}
    */
    var _getLayerOptionsFromDoc = function (document, type) {
        var appStore = this.flux.store("application"),
            currentID = appStore.getCurrentDocumentID(),
            layers = document.layers.allVisibleReversed,
            layerItems = [];
        
        layers.forEach(function (layer) {
            var ancestry,
                layerType = _getLayerCategory(layer, type),
                iconID = svgUtil.getSVGClassFromLayer(layer);

            // Layers from current, active document should display layer ancestry
            // Layers from other open documents should display document name
            if (document.id === currentID) {
                ancestry = _formatLayerAncestry(layer, appStore);
            } else {
                ancestry = document.name;
            }

            layerItems.push({
                id: document.id.toString() + "_" + layer.id.toString(),
                name: layer.name,
                pathInfo: ancestry,
                iconID: iconID,
                category: layerType
            });
        });
        return layerItems;
    };

    /**
     * Make list of certain layer info from current document only so search store can create search options
     *
     * @private
     * @return {Immutable.List.<object>}
    */
    var _getLayerSearchOptions = function () {
        // Get list of layers
        var appStore = this.flux.store("application"),
            document = appStore.getCurrentDocument();

        return _getLayerOptionsFromDoc.call(this, document, "CURRENT");
    };

    /**
     * Make list of certain layer info from all documents so search store can create search options
     *
     * @private
     * @return {Immutable.List.<object>}
    */
    var _getAllLayerSearchOptions = function () {
        // Get list of layers
        var appStore = this.flux.store("application"),
            currDoc = appStore.getCurrentDocument(),
            allLayerMaps = [];

        if (currDoc) {
            var documents = appStore.getOpenDocuments();
            // add layers from current document first, then skip it in the loop
            allLayerMaps = allLayerMaps.concat(_getLayerOptionsFromDoc.call(this, currDoc, "ALL"));

            documents.forEach(function (document) {
                if (document !== currDoc) {
                    var layerMap = _getLayerOptionsFromDoc.call(this, document, "ALL");
                    allLayerMaps = allLayerMaps.concat(layerMap);
                }
            }.bind(this));
        }
        return Immutable.List(allLayerMaps);
    };

    /**
     * Select layer when its item is confirmed in search
     *
     * @private
     * @param {string} id ID of layer to select
    */
    var _confirmSearch = function (id) {
        var appStore = this.flux.store("application"),
            docStore = this.flux.store("document"),
            splitID = id.split("_"),
            docID = mathUtil.parseNumber(splitID[0]),
            layerID = mathUtil.parseNumber(splitID[1]),
            document = docStore.getDocument(docID),
            selected = document.layers.byID(layerID);

        if (selected) {
            var currentDoc = appStore.getCurrentDocument(),
                selectPromise = document.equals(currentDoc) ?
                    Promise.resolve() :
                    this.flux.actions.documents.selectDocument(document);

            selectPromise
                .bind(this)
                .then(function () {
                    this.flux.actions.layers.select(document, selected);
                });
        }
    };

    /**
     * Register layer info to search
     *
     * @param {boolean} searchAllDocuments Whether to search all documents or not (just the current one)
     */
    var _registerLayerSearch = function (searchAllDocuments) {
        var type = searchAllDocuments ? "ALL" : "CURRENT",
            filters = Immutable.List.of(
                (type + "_LAYER"), "PIXEL", "TEXT", "ARTBOARD", "ADJUSTMENT", "SMARTOBJECT", "GROUP", "VECTOR"
            ),
            options = searchAllDocuments ? _getAllLayerSearchOptions.bind(this) : _getLayerSearchOptions.bind(this);

        var payload = {
            "type": type + "_LAYER",
            "getOptions": options,
            "filters": filters,
            "handleExecute": _confirmSearch.bind(this),
            "shortenPaths": true,
            "haveDocument": true,
            "getSVGClass": svgUtil.getSVGClassFromLayerCategories
        };
        
        this.dispatch(events.search.REGISTER_SEARCH_PROVIDER, payload);
    };

    /**
     * Register layer info to search for layers in all current documents
     *
     */
    var registerAllLayerSearch = function () {
        _registerLayerSearch.call(this, true);
    };
    
    /**
     * Register layer info to search for layers just in current document
     *
     */
    var registerCurrentLayerSearch = function () {
        _registerLayerSearch.call(this, false);
    };

    exports.registerCurrentLayerSearch = registerCurrentLayerSearch;
    exports.registerAllLayerSearch = registerAllLayerSearch;
});
