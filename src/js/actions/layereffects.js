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
        Immutable = require("immutable"),
        Promise = require("bluebird");

    var layerEffectLib = require("adapter/lib/layerEffect"),
        documentLib = require("adapter/lib/document");

    var Color = require("js/models/color"),
        events = require("../events"),
        locks = require("js/locks"),
        layerActionsUtil = require("js/util/layeractions"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * Call ps adapter for the given layers, setting the Shadow at the given index with the new props
     * this dispatches events to the fluxx store, and uses the resulting model to drive PS
     *
     * @private
     * @param {Document} document document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {?number} shadowIndex index of the Shadow TO UPDATE within a list.  If null, adds new Shadow
     * @param {object} newProps object containing NEW properties to be merged with existing Shadow props
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var _callAdapter = function (document, layers, shadowIndex, newProps, coalesce, type) {
        var documentStore = this.flux.store("document"),
            options = {
                paintOptions: {
                    immediateUpdate: true,
                    quality: "draft"
                },
                historyStateInfo: {
                    name: strings.ACTIONS.SET_LAYER_EFFECTS,
                    target: documentLib.referenceBy.id(document.id),
                    coalesce: !!coalesce
                }
            };

        var toEmit = events.document.history.optimistic.LAYER_EFFECT_CHANGED,
            layerIDs = collection.pluck(layers, "id"),
            payloadIndex = null;
        
        if (_.isNumber(shadowIndex)) {
            payloadIndex = shadowIndex;
        }

        var payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                layerEffectIndex: payloadIndex,
                layerEffectType: type,
                layerEffectProperties: newProps
            };
            
        this.dispatch(toEmit, payload);
        // loop over layers, get current Shadow, merge new properties, build PlayObject array
        var shadowPlayObjects = layers.map(function (curlayer) {
            var layerStruct = documentStore.getDocument(document.id).layers,
                curLayerFromDocumentStore = layerStruct.byID(curlayer.id);

            var shadowsFromDocumentStore;
            if (type === "dropShadow") {
                shadowsFromDocumentStore = curLayerFromDocumentStore.dropShadows;
            } else if (type === "innerShadow") {
                shadowsFromDocumentStore = curLayerFromDocumentStore.innerShadows;
            }

            var shadowAdapterObject = shadowsFromDocumentStore
                .map(function (shadow) {
                    return shadow.toAdapterObject();
                }).toArray();

            var referenceID = layerEffectLib
                .referenceBy
                .id(curlayer.id);

            if (curlayer.hasLayerEffect) {
                return {
                    layer: curlayer,
                    playObject: layerEffectLib.setExtendedLayerEffect(type, referenceID, shadowAdapterObject)
                };
            } else {
                return {
                    layer: curlayer,
                    playObject: layerEffectLib.setLayerEffect(type, referenceID, shadowAdapterObject)
                };
            }
        }, this);

        return layerActionsUtil.playLayerActions(document, shadowPlayObjects, true, options);
    };

    /**
     * Creates a new Shadow for each layer and uses the photoshop response to add it to the Store
     * If no props are provided, photoshop gets to choose the defaults
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index that the drop shadow should be added to
     * @param {?object} withProps object containing new drop shadow properties
     * @return {Promise}
     */
    var _addShadowToLayers = function (document, layers, shadowIndex, withProps, type) {
        // withProps can be null, but force {enabled: true} regardless
        var newProps = _.isObject(withProps) ? withProps : {};
        _.merge(newProps, { enabled: true });

        return _callAdapter.call(this, document, layers, null, newProps, null, type);
    };

    /**
     * Update an existing shadow (at given index) in each given layer
     * Optimistically dispatches event, and calls PS Adapter
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index that the drop shadow should be added to
     * @param {object} newProps object containing new drop shadow properties
     * @return {Promise}
     */
    var _updateShadowProperties = function (document, layers, shadowIndex, newProps, coalesce, type) {
        // call PS Adapter
        return _callAdapter.call(this, document, layers, shadowIndex, newProps, coalesce, type);
    };

    /**
     * For each given layer insert or update a new Shadow at given index, depending on its existence,
     * using the provided newProps object
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index that the drop shadow should be added to
     * @param {object} newProps object containing new drop shadow properties
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var _upsertShadowProperties = function (document, layers, shadowIndex, newProps, coalesce, type) {
        // split layers in to two groups: those with existing shadows at index, and those without
        var addPromise,
            updatePromise,
            upsertList = layers.reduce(function (output, layer) {
                if (layer[type + "s"].has(shadowIndex)) {
                    output.toUpdate.push(layer);
                } else {
                    output.toAdd.push(layer);
                }
                return output;
            }, { toUpdate: [], toAdd: [] });

        if (upsertList.toAdd.length > 0) {
            addPromise = _addShadowToLayers.call(
                this, document, Immutable.List(upsertList.toAdd), shadowIndex, newProps, type);
        } else {
            addPromise = Promise.resolve();
        }
        if (upsertList.toUpdate.length > 0) {
            updatePromise = _updateShadowProperties.call(
                this, document, Immutable.List(upsertList.toUpdate), shadowIndex, newProps, coalesce, type);
        } else {
            updatePromise = Promise.resolve();
        }

        return Promise.join(addPromise, updatePromise);
    };

    /**
     * Add a new Drop Shadow to all selected layers of the given document
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @return {Promise}
     */
    var addShadowCommand = function (document, layers, type) {
        return _addShadowToLayers.call(this, document, layers, 0, null, type);
    };


    /**
     * Set the  Shadow enabled flag for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {boolean} enabled enabled flag
     * @return {Promise}
     */

    var setShadowEnabledCommand = function (document, layers, shadowIndex, enabled, type) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, { enabled: enabled }, 0, type);
    };

    /**
     * Set the Shadow alpha value for all selected layers. Preserves the opaque color.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} alpha alpha value of the Drop Shadow
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var setShadowAlphaCommand = function (document, layers, shadowIndex, alpha, coalesce, type) {
        // FIXME: this would ideally make a single adapter call and emit a single event.
        return Promise.all(layers.map(function (layer) {
            var shadow = layer[type + "s"].get(shadowIndex),
                color;

            if (shadow) {
                color = shadow.color.setAlpha(alpha);
            } else {
                color = Color.DEFAULT.set("a", alpha);
            }

            return _upsertShadowProperties.call(
                this, document, Immutable.List.of(layer), shadowIndex, { color: color }, coalesce, type);
        }, this).toArray());
    };

    /**
     * Set the Drop Shadow Color for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {Color} color color of the Drop Shadow
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @param {boolean=} ignoreAlpha Whether to ignore the alpha value of the
     *  given color and only update the opaque color value.
     * @return {Promise}
     */
    var setShadowColorCommand = function (document, layers, shadowIndex, color, coalesce, ignoreAlpha, type) {
        if (ignoreAlpha) {
            // FIXME: this would ideally make a single adapter call and emit a single event.
            return Promise.all(layers.map(function (layer) {
                var shadow = layer[type + "s"].get(shadowIndex),
                    nextColor;

                if (shadow) {
                    nextColor = shadow.color.setOpaque(color);
                } else {
                    nextColor = Color.DEFAULT;
                }
                return _upsertShadowProperties.call(
                    this, document, Immutable.List.of(layer), shadowIndex, { color: nextColor }, coalesce, type);
            }, this).toArray());
        } else {
            var normalizedColor = color ? color.normalizeAlpha() : null;
            return _upsertShadowProperties.call(
                this, document, layers, shadowIndex, { color: normalizedColor }, coalesce, type);
        }
    };

    /**
     * Set the Drop Shadow X coordinate for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} x x coordinate in pixels
     * @return {Promise}
     */
    var setShadowXCommand = function (document, layers, shadowIndex, x, type) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, { x: x }, null, type);
    };


    /**
     * Set the Drop Shadow Y coordinate for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} y y coordinate in pixels
     * @return {Promise}
     */
    var setShadowYCommand = function (document, layers, shadowIndex, y, type) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, { y: y }, null, type);
    };

    /**
     * Set the Drop Shadow Blur value for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} blur blur value in pixels
     * @return {Promise}
     */
    var setShadowBlurCommand = function (document, layers, shadowIndex, blur, type) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, { blur: blur }, null, type);
    };

    /**
     * Set the Drop Shadow Spread value for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} spread spread value in pixels
     * @return {Promise}
     */
    var setShadowSpreadCommand = function (document, layers, shadowIndex, spread, type) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, { spread: spread }, null, type);
    };

    var addShadow = {
        command: addShadowCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setShadowEnabled = {
        command: setShadowEnabledCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setShadowAlpha = {
        command: setShadowAlphaCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setShadowColor = {
        command: setShadowColorCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setShadowX = {
        command: setShadowXCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setShadowY = {
        command: setShadowYCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setShadowBlur = {
        command: setShadowBlurCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setShadowSpread = {
        command: setShadowSpreadCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    exports.addShadow = addShadow;
    exports.setShadowEnabled = setShadowEnabled;
    exports.setShadowAlpha = setShadowAlpha;
    exports.setShadowColor = setShadowColor;
    exports.setShadowX = setShadowX;
    exports.setShadowY = setShadowY;
    exports.setShadowBlur = setShadowBlur;
    exports.setShadowSpread = setShadowSpread;
});
