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

    var _ = require("lodash"),
        layerLib = require("adapter/lib/layer");
   
    /**
     * Get the class name for the layer face icon for the given layer
     *
     * @private
     * @param {Layer} layer
     * @return {string}
    */
    var getSVGClassFromLayer = function (layer) {
        var iconID = "layer-";
        if (layer.isArtboard) {
            iconID += "artboard";
        } else if (layer.kind === layer.layerKinds.BACKGROUND) {
            iconID += layer.layerKinds.PIXEL;
        } else if (layer.kind === layer.layerKinds.SMARTOBJECT && layer.isLinked) {
            iconID += layer.kind + "-linked";
        } else {
            iconID += layer.kind;
        }

        if (layer.kind === layer.layerKinds.GROUP && !layer.expanded) {
            iconID += "-collapsed";
        }

        return iconID;
    };

    /**
     * Gets a CSS class name for the layer category
     *
     * @private
     * @param {Array.<string>} categories
     * @return {?string}
    */
    var getSVGClassFromLayerCategories = function (categories) {
        if (categories.length === 0) {
            return null;
        }

        if (categories.length < 2) {
            return "layers";
        }

        var iconID = "layer-",
            isLinked = _.has(categories, "linked");
        
        _.forEach(categories, function (kind) {
            if (kind === "ARTBOARD") {
                iconID += "artboard";
            } else if (kind === "BACKGROUND") {
                iconID += layerLib.layerKinds.PIXEL;
            } else if (kind === "SMARTOBJECT" && isLinked) {
                iconID += layerLib.layerKinds.SMARTOBJECT + "-linked";
            } else if (kind.indexOf("LAYER") === -1) { // check if kind is "ALL_LAYER" or "CURRENT_LAYER"
                iconID += layerLib.layerKinds[kind.toUpperCase().replace(" ", "")];
            }
        });

        return iconID;
    };

    exports.getSVGClassFromLayer = getSVGClassFromLayer;
    exports.getSVGClassFromLayerCategories = getSVGClassFromLayerCategories;
});
