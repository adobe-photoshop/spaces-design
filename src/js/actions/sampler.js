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
        events = require("../events"),
        locks = require("js/locks"),
        layerFXActions = require("./layereffects"),
        typeActions = require("./type"),
        shapeActions = require("./shapes");

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
    var _sampleLayerPrimary = function (doc, sourceLayer, x, y) {
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
    var _sampleLayerSecondary = function (doc, sourceLayer) {
        var selectedLayers = doc.layers.selected;

        if (selectedLayers.isEmpty() || !sourceLayer) {
            return Promise.resolve();
        }
        
        return this.transfer(layerFXActions.duplicateLayerEffects, doc, selectedLayers, sourceLayer);
    };

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
                    return _sampleLayerSecondary.call(this, doc, topLayer);
                } else {
                    return _sampleLayerPrimary.call(this, doc, topLayer, x, y);
                }
            });
    };
    click.reads = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP];
    click.writes = [locks.PS_DOC, locks.JS_DOC];
    
    /**
     * Saves the currently selected layer's style in the style store clipboard
     *
     * @param {Document?} document Default is active document
     * @param {Layer?} source Layer to copy style of, default is selected layer
     *
     * @return {Promise}
     */
    var copyLayerStyle = function (document, source) {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.layers.selected;

        document = document || currentDocument;
        source = source || document ? selectedLayers.first() : null;

        if (!source) {
            return Promise.resolve();
        }
        
        var payload = {
            layer: source
        };

        return this.dispatchAsync(events.style.COPY_STYLE, payload);
    };
    copyLayerStyle.reads = [locks.JS_DOC];
    copyLayerStyle.writes = [locks.JS_STYLE];

    /**
     * Applies the saved layer style to the given layers
     * Fill color applies to text color and vica versa
     * Layer effects are sent across
     * Stroke color is ignored by type layers
     *
     * @param {Document?} document Default is active document
     * @param {Immutable.Iterable.<Layer>?} targetLayers Default is selected layers
     *
     * @return {Promise}
     */
    var pasteLayerStyle = function (document, targetLayers) {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.layers.selected;

        document = document || currentDocument;
        targetLayers = targetLayers || document ? selectedLayers : null;

        if (!targetLayers) {
            return Promise.resolve();
        }
        
        var styleStore = this.flux.store("style"),
            style = styleStore.getClipboardStyle(),
            shapeLayers = Immutable.List(),
            textLayers = Immutable.List();

        targetLayers.forEach(function (layer) {
            if (layer.kind === layer.layerKinds.VECTOR) {
                shapeLayers = shapeLayers.push(layer);
            } else if (layer.kind === layer.layerKinds.TEXT) {
                textLayers = textLayers.push(layer);
            }
        });

        var shapeFillPromise = (!style.fillColor || shapeLayers.isEmpty()) ? Promise.resolve() :
                this.transfer(shapeActions.setFillColor, document, shapeLayers, 0, style.fillColor, false),
            shapeStrokePromise = (!style.strokeColor || shapeLayers.isEmpty()) ? Promise.resolve() :
                this.transfer(shapeActions.setStrokeColor, document, shapeLayers, 0, style.strokeColor, false),
            textColorPromise = (!style.fillColor || textLayers.isEmpty()) ? Promise.resolve() :
                this.transfer(typeActions.setColor, document, textLayers, style.fillColor, false, false),
            textStylePromise = (!style.typeStyle || textLayers.isEmpty()) ? Promise.resolve() :
                this.transfer(typeActions.applyTextStyle, document, textLayers, style.typeStyle),
            effectsPromise = !style.effects ? Promise.resolve() :
                this.transfer(layerFXActions.duplicateLayerEffects, document, targetLayers, style.effects);

        return Promise.join(shapeFillPromise, shapeStrokePromise, textColorPromise, textStylePromise, effectsPromise);
    };
    pasteLayerStyle.reads = [locks.PS_DOC, locks.JS_DOC, locks.JS_STYLE, locks.JS_APP, locks.JS_TOOL];
    pasteLayerStyle.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];

    exports.click = click;

    exports.copyLayerStyle = copyLayerStyle;
    exports.pasteLayerStyle = pasteLayerStyle;
});
