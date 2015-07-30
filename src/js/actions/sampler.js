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
        Immutable = require("immutable");

    var uiUtil = require("js/util/ui"),
        locks = require("js/locks"),
        layerFXActions = require("./layereffects"),
        typeActions = require("./type"),
        shapeActions = require("./shapes");

    /**
     * Process a single click from the sampler tool.
     * Based on the clicked leaf layer type, will sample the property from it
     * 
     * @private
     * @param {Document} doc Document model
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise}
     */
    var click = function (doc, x, y, secondary) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerTree = doc.layers;
        
        return uiUtil.hitTestLayers(doc.id, coords.x, coords.y)
            .bind(this)
            .then(function (hitLayerIDs) {
                var hitLayerMap = new Set(hitLayerIDs.toJS()),
                    clickedLeafLayers = layerTree.leaves.filter(function (layer) {
                        return hitLayerMap.has(layer.id);
                    }),
                    topLayer = clickedLeafLayers.last();

                if (secondary) {
                    return sampleLayerSecondary.call(this, doc, topLayer);
                } else {
                    return sampleLayerPrimary.call(this, doc, topLayer, x, y);
                }
            });
    };
    click.reads = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP];
    click.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Gets the color of the source layer, or color at the pixel
     * if sourceLayer is not applicable
     *
     * @private
     * @param {Document} doc
     * @param {Layer} sourceLayer
     * @param {number} x
     * @param {number} y
     * @return {Promise.<?Color>} Either the primary color of the layer, or the color at the clicked pixel
     */
    var _getSourceColor = function (doc, sourceLayer, x, y) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerKinds = sourceLayer.layerKinds,
            color;

        switch (sourceLayer.kind) {
            case layerKinds.VECTOR:
                color = sourceLayer.fills.first() ? sourceLayer.fills.first().color : null;

                return Promise.resolve(color);
            case layerKinds.TEXT:
                color = sourceLayer.text.characterStyle.color;
                color = color ? color.setOpacity(sourceLayer.opacity) : null;

                return Promise.resolve(color);
            default:
                return uiUtil.colorAtPoint(doc.id, coords.x, coords.y, sourceLayer.opacity);
        }
    };

    /**
     * Applies the primary property of the layer to
     * the selected layers.
     *
     * Primary properties are:
     * Shape layers: Fill color
     * Pixel layers / smart objects: Pixel color value
     * Type layers: Type color
     *
     * If any of the selected layers are a group, they're skipped (may change)
     *
     * @private
     * @param {Document} doc Selected layers of this document will be sampled into
     * @param {Layer} sourceLayer Layer to be sampled
     * @return {Promise}
     */
    var sampleLayerPrimary = function (doc, sourceLayer, x, y) {
        var selectedLayers = doc.layers.selected;

        if (selectedLayers.isEmpty() || !sourceLayer) {
            return Promise.resolve();
        }
        
        return _getSourceColor.call(this, doc, sourceLayer, x, y)
            .bind(this)
            .then(function (sourceColor) {
                if (!sourceColor) {
                    return Promise.resolve();
                }

                var shapeLayers = Immutable.List(),
                    textLayers = Immutable.List();

                selectedLayers.forEach(function (layer) {
                    if (layer.kind === layer.layerKinds.VECTOR) {
                        shapeLayers = shapeLayers.push(layer);
                    } else if (layer.kind === layer.layerKinds.TEXT) {
                        textLayers = textLayers.push(layer);
                    }
                });

                var shapePromise = shapeLayers.isEmpty() ? Promise.resolve() :
                        this.transfer(shapeActions.setFillColor, doc, shapeLayers, 0, sourceColor, false),
                    textPromise = textLayers.isEmpty() ? Promise.resolve() :
                        this.transfer(typeActions.setColor, doc, textLayers, sourceColor, false, false);

                return Promise.join(shapePromise, textPromise);
            });
    };

    /**
     * Applies the secondary property of the layer to
     * the selected layers.
     *
     * Secondary properties are (as applicable):
     * Shape layers: Effects
     * Pixel layers / smart objects: Effects
     * Type layers: Type style / effects
     *
     * If any of the selected layers are a group, they're skipped (may change)
     *
     * @private
     * @param {Document} doc Selected layers of this document will be sampled into
     * @param {Layer} sourceLayer Layer to be sampled
     * @return {Promise}
     */
    var sampleLayerSecondary = function (doc, sourceLayer) {
        var selectedLayers = doc.layers.selected;

        if (selectedLayers.isEmpty() || !sourceLayer) {
            return Promise.resolve();
        }
        
        return this.transfer(layerFXActions.duplicateLayerEffects, doc, selectedLayers, sourceLayer);
    };

    exports.click = click;
});
