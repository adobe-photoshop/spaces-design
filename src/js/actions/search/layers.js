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

    var layerLib = require("adapter/lib/layer"),
        events = require("js/events"),
        svgUtil = require("js/util/svg"),
        strings = require("i18n!nls/strings");
    
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
        var CATEGORIES = strings.SEARCH.CATEGORIES,
            layerType = [CATEGORIES.LAYER];

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
     * Make list of certain layer info so search store can create search options
     *
     * @private
     * @return {Immutable.List.<object>}
    */
    var _getLayerSearchOptions = function () {
        // Get list of layers
        var appStore = this.flux.store("application"),
            document = appStore.getCurrentDocument();
        if (!document) {
            return {};
        }
        var layers = document.layers.allVisibleReversed,
            layerMap = layers.map(function (layer) {
                var ancestry = _formatLayerAncestry(layer, appStore),
                    layerType = _getLayerCategory(layer),
                    iconID = svgUtil.getSVGClassFromLayer(layer);

                return {
                    id: layer.id.toString(),
                    name: layer.name,
                    pathInfo: ancestry,
                    iconID: iconID,
                    category: layerType
                };
            }.bind(this));

        return layerMap;
    };

    /**
     * Select layer when its item is confirmed in search
     *
     * @private
     * @param {number} idInt ID of layer to select
    */
    var _confirmSearch = function (idInt) {
        var appStore = this.flux.store("application"),
            document = appStore.getCurrentDocument(),
            selected = document.layers.byID(idInt);

        if (selected) {
            this.flux.actions.layers.select(document, selected);
        }
    };

    /**
     * Register layer info for search
     *
     */
    var registerLayerSearch = function () {
        var filters = Immutable.List(Object.keys(layerLib.layerKinds)).filterNot(function (kind) {
                        return (kind === "ANY" || kind === "GROUPEND" || kind === "3D" || kind === "VIDEO");
                    });

        var payload = {
            "type": "LAYER",
            "getOptions": _getLayerSearchOptions.bind(this),
            "filters": filters,
            "handleExecute": _confirmSearch.bind(this)
        };
        
        this.dispatch(events.search.REGISTER_SEARCH_PROVIDER, payload);
    };

    exports.registerLayerSearch = registerLayerSearch;
});
