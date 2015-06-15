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
        Immutable = require("immutable");

    var layerEffectLib = require("adapter/lib/layerEffect"),
        documentLib = require("adapter/lib/document");

    var Color = require("js/models/color"),
        events = require("../events"),
        locks = require("js/locks"),
        layerActionsUtil = require("js/util/layeractions"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * Fetch layer effects from the store, and send them to the adapter to update photoshop.
     * Fetch/Send only the layer effects of the given type for the given document/layers
     *
     * @private
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @param {string} type layer effect type, eg "dropShadow"
     * @return {Promise} returns the promised value from the photoshop adapter call
     */
    var _syncStoreToPs = function (document, layers, coalesce, type) {
        var documentStore = this.flux.store("document"),
            layerStruct = documentStore.getDocument(document.id).layers,
            layerEffectPlayObjects,
            options = {
                paintOptions: {
                    immediateUpdate: true,
                    quality: "draft"
                },
                historyStateInfo: {
                    name: strings.ACTIONS.SET_LAYER_EFFECTS,
                    target: documentLib.referenceBy.id(document.id),
                    coalesce: !!coalesce,
                    suppressHistoryStateNotification: !!coalesce
                }
            };

        // Map the layers to a list of playable objects
        layerEffectPlayObjects = layers.map(function (curLayer) {
            // get this layer directly from the store and build a layer effect adapter object
            var layerFromStore = layerStruct.byID(curLayer.id),
                layerEffectsFromStore = layerFromStore.getLayerEffectsByType(type),
                referenceID = layerEffectLib.referenceBy.id(curLayer.id),
                shadowAdapterObject = layerEffectsFromStore
                    .map(function (shadow) {
                        return shadow.toAdapterObject();
                    }).toArray();

            if (curLayer.hasLayerEffect) {
                return {
                    layer: curLayer,
                    playObject: layerEffectLib.setExtendedLayerEffect(type, referenceID, shadowAdapterObject)
                };
            } else {
                return {
                    layer: curLayer,
                    playObject: layerEffectLib.setLayerEffect(type, referenceID, shadowAdapterObject)
                };
            }
        });

        return layerActionsUtil.playLayerActions(document, Immutable.List(layerEffectPlayObjects), true, options);
    };

    /**
     * For each given layer insert or update a new Shadow at given index, depending on its existence,
     * using the provided newProps object
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} layerEffectIndex index that the drop shadow should be added to
     * @param {object} newProps object containing new drop shadow properties
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var _upsertShadowProperties = function (document, layers, layerEffectIndex, newProps, coalesce, type) {
        var toEmit = events.document.history.optimistic.LAYER_EFFECT_CHANGED,
            layerIDs = collection.pluck(layers, "id"),
            layerEffectPropsList = [],
            layerEffectIndexList = [];

        // Prepare some per-layer items for the payload
        layers.forEach(function (curLayer) {
            var curLayerEffects = curLayer.getLayerEffectsByType(type),
                curLayerEffect,
                props;

            if (curLayerEffects && curLayerEffects.has(layerEffectIndex)) {
                // updating existing layer effect
                curLayerEffect = curLayerEffects.get(layerEffectIndex);
                layerEffectIndexList.push(layerEffectIndex);
            } else {
                // adding new layer effect
                curLayerEffect = {};
                layerEffectIndexList.push(null); // will use push on top of any existing layer effects
            }

            // if newProps is a function, apply it
            props = _.isFunction(newProps) ? newProps(curLayerEffect) : newProps;
            // force it back enabled unless explicitly set to false
            props.enabled = (props.enabled === undefined) || props.enabled;
            layerEffectPropsList.push(props);
        }, this);

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            layerEffectType: type,
            layerEffectIndex: Immutable.List(layerEffectIndexList),
            layerEffectProperties: Immutable.List(layerEffectPropsList),
            coalesce: !!coalesce
        };
        
        // Synchronously update the stores
        this.dispatch(toEmit, payload);
        // Then update photoshop
        return _syncStoreToPs.call(this, document, layers, coalesce, type);
    };

    /**
     * Add a new Drop Shadow to all selected layers of the given document
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @return {Promise}
     */
    var addShadowCommand = function (document, layers, type) {
        return _upsertShadowProperties.call(this, document, layers, null, { enabled: true }, undefined, type);
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
        var alphaUpdater = function (shadow) {
            if (shadow && shadow.color) {
                return { color: shadow.color.setAlpha(alpha) };
            } else {
                return { color: Color.DEFAULT.set("a", alpha) };
            }
        };
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, alphaUpdater, coalesce, type);
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
            var colorUpdater = function (shadow) {
                if (shadow && shadow.color) {
                    return { color: shadow.color.setOpaque(color) };
                } else {
                    return { color: Color.DEFAULT };
                }
            };

            return _upsertShadowProperties.call(
                this, document, layers, shadowIndex, colorUpdater, coalesce, type);
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
