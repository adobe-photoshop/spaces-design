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
        LayerEffect = require("js/models/effects/layereffect"),
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
     * @param {string|Array.<String>} type layer effect type, eg "dropShadow"
     * @param {object} options Batch play options
     * @return {Promise} returns the promised value from the photoshop adapter call
     */
    var _syncStoreToPs = function (document, layers, coalesce, type, options) {
        var documentStore = this.flux.store("document"),
            layerStruct = documentStore.getDocument(document.id).layers,
            layerEffectPlayObjects = [],
            syncOptions = {
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
            },
            types = _.isArray(type) ? type : [type];

        options = _.merge(options, syncOptions);

        // Map the layers to a list of playable objects
        layers.forEach(function (curLayer) {
            // get this layer directly from the store and build a layer effect adapter object
            var layerFromStore = layerStruct.byID(curLayer.id),
                referenceID = layerEffectLib.referenceBy.id(curLayer.id),
                layerHasEffects = curLayer.usedToHaveLayerEffect;

            types.forEach(function (type) {
                var descriptorType = LayerEffect.getDescriptorType(type),
                    layerEffectsFromStore = layerFromStore.getLayerEffectsByType(type),
                    effectAdapterObject = layerEffectsFromStore
                        .map(function (effect) {
                            return effect.toAdapterObject();
                        }).toArray();

                if (layerHasEffects) {
                    layerEffectPlayObjects.push({
                        layer: curLayer,
                        playObject: layerEffectLib.setExtendedLayerEffect(descriptorType,
                            referenceID, effectAdapterObject)
                    });
                } else {
                    if (effectAdapterObject.length > 0) {
                        layerEffectPlayObjects.push({
                            layer: curLayer,
                            playObject: layerEffectLib.setLayerEffect(descriptorType, referenceID, effectAdapterObject)
                        });
                        layerHasEffects = true;
                    }
                }
            });
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
    var _upsertEffectProperties = function (document, layers, layerEffectIndex, newProps, coalesce, type) {
        var layerIDs = collection.pluck(layers, "id"),
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
        this.dispatch(events.document.history.optimistic.LAYER_EFFECT_CHANGED, payload);
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
    var addEffect = function (document, layers, type) {
        return _upsertEffectProperties.call(this, document, layers, null, { enabled: true }, undefined, type);
    };
    addEffect.reads = [locks.PS_DOC, locks.JS_DOC];
    addEffect.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the effect enabled flag for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} effectIndex index of the effectType within the layer(s)
     * @param {boolean} enabled enabled flag
     * @param {string} effectType
     * @return {Promise}
     */
    var setEffectEnabled = function (document, layers, effectIndex, enabled, effectType) {
        return _upsertEffectProperties.call(
            this, document, layers, effectIndex, { enabled: enabled }, 0, effectType);
    };
    setEffectEnabled.reads = [locks.PS_DOC, locks.JS_DOC];
    setEffectEnabled.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Delete the selected Shadow for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} effectIndex index of the effect within the layer(s)
     * @param {string} effectType
     * @return {Promise}
     */
    var deleteEffect = function (document, layers, effectIndex, effectType) {
        var payload = {
            documentID: document.id,
            layerIDs: collection.pluck(layers, "id"),
            layerEffectType: effectType,
            layerEffectIndex: effectIndex
        };
        // Synchronously update the stores
        this.dispatch(events.document.history.optimistic.LAYER_EFFECT_DELETED, payload);

        // Then update photoshop
        return _syncStoreToPs.call(this, document, layers, null, effectType, null);
    };
    deleteEffect.reads = [locks.PS_DOC, locks.JS_DOC];
    deleteEffect.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the effect alpha value for all selected layers. Preserves the opaque color.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {string} effectType
     * @param {number} effectIndex index of the effect within the layer(s)
     * @param {number} alpha alpha value of the effect
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var setAlpha = function (document, layers, effectType, effectIndex, alpha, coalesce) {
        var alphaUpdater = function (effect) {
            if (effect && effect.color) {
                return { color: effect.color.setAlpha(alpha) };
            } else {
                return { color: Color.DEFAULT.set("a", alpha) };
            }
        };
        return _upsertEffectProperties.call(
            this, document, layers, effectIndex, alphaUpdater, coalesce, effectType);
    };
    setAlpha.reads = [locks.PS_DOC, locks.JS_DOC];
    setAlpha.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the effect Color for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {string} effectType
     * @param {number} effectIndex index of the effect within the layer(s)
     * @param {Color} color color of the effect
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @param {boolean=} ignoreAlpha Whether to ignore the alpha value of the
     *  given color and only update the opaque color value.
     * @return {Promise}
     */
    var setColor = function (document, layers, effectType, effectIndex, color, coalesce, ignoreAlpha) {
        if (ignoreAlpha) {
            var colorUpdater = function (effect) {
                if (effect && effect.color) {
                    return { color: effect.color.setOpaque(color) };
                } else {
                    return { color: Color.DEFAULT.setOpaque(color) };
                }
            };

            return _upsertEffectProperties.call(
                this, document, layers, effectIndex, colorUpdater, coalesce, effectType);
        } else {
            var normalizedColor = color ? color.normalizeAlpha() : null;
            return _upsertEffectProperties.call(
                this, document, layers, effectIndex, { color: normalizedColor }, coalesce, effectType);
        }
    };
    setColor.reads = [locks.PS_DOC, locks.JS_DOC];
    setColor.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the Drop Shadow X coordinate for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} x x coordinate in pixels
     * @return {Promise}
     */
    var setShadowX = function (document, layers, shadowIndex, x, type) {
        return _upsertEffectProperties.call(
           this, document, layers, shadowIndex, { x: x }, null, type);
    };
    setShadowX.reads = [locks.PS_DOC, locks.JS_DOC];
    setShadowX.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the Drop Shadow Y coordinate for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} y y coordinate in pixels
     * @return {Promise}
     */
    var setShadowY = function (document, layers, shadowIndex, y, type) {
        return _upsertEffectProperties.call(
           this, document, layers, shadowIndex, { y: y }, null, type);
    };
    setShadowY.reads = [locks.PS_DOC, locks.JS_DOC];
    setShadowY.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the Drop Shadow Blur value for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} blur blur value in pixels
     * @return {Promise}
     */
    var setShadowBlur = function (document, layers, shadowIndex, blur, type) {
        return _upsertEffectProperties.call(
            this, document, layers, shadowIndex, { blur: blur }, null, type);
    };
    setShadowBlur.reads = [locks.PS_DOC, locks.JS_DOC];
    setShadowBlur.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the Drop Shadow Spread value for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} spread spread value in pixels
     * @return {Promise}
     */
    var setShadowSpread = function (document, layers, shadowIndex, spread, type) {
        return _upsertEffectProperties.call(
            this, document, layers, shadowIndex, { spread: spread }, null, type);
    };
    setShadowSpread.reads = [locks.PS_DOC, locks.JS_DOC];
    setShadowSpread.writes = [locks.PS_DOC, locks.JS_DOC];
    
    /**
     * Set the effect Blend Mode value for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} effectIndex index of the effectType within the layer(s)
     * @param {string} blendMode  blendMode name
     * @param {string} effectType
     * @return {Promise}
     */
    var setBlendMode = function (document, layers, effectIndex, blendMode, effectType) {
        return _upsertEffectProperties.call(
           this, document, layers, effectIndex, { blendMode: blendMode }, null, effectType);
    };
    setBlendMode.reads = [locks.PS_DOC, locks.JS_DOC];
    setBlendMode.writes = [locks.PS_DOC, locks.JS_DOC];
    
    /**
     * Set the size of Stroke Effect for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} effectIndex index of the effectType within the layer(s)
     * @param {number} size
     * @return {Promise}
     */
    var setStrokeSize = function (document, layers, effectIndex, size) {
        return _upsertEffectProperties.call(
           this, document, layers, effectIndex, { strokeSize: size }, null, LayerEffect.STROKE);
    };
    setStrokeSize.reads = [locks.PS_DOC, locks.JS_DOC];
    setStrokeSize.writes = [locks.PS_DOC, locks.JS_DOC];
    
    /**
     * Set the style of Stroke Effect for all selected layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} effectIndex index of the effectType within the layer(s)
     * @param {string} style
     * @return {Promise}
     */
    var setStrokeStyle = function (document, layers, effectIndex, style) {
        return _upsertEffectProperties.call(
           this, document, layers, effectIndex, { style: style }, null, LayerEffect.STROKE);
    };
    setStrokeStyle.reads = [locks.PS_DOC, locks.JS_DOC];
    setStrokeStyle.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Duplicates the layer effects of the source layer on all the target layers
     *
     * @param {Document} document
     * @param {?Immutable.Iterable.<Layer>} targetLayers Default is selected in the document
     * @param {LayerEffectsMap} source
     * @param {object} options
     * @return {Promise}
     */
    var duplicateLayerEffects = function (document, targetLayers, source, options) {
        targetLayers = targetLayers || document.layers.selected;

        var layerIDs = collection.pluck(targetLayers, "id"),
            masterEffectIndexMap = {}, // Immutable.Map<String, Immutable.List<Immutable.List<number>>>
            masterEffectPropsMap = {}, // Immutable.Map<String, Immutable.List<Immutable.List<object>>>
            masterEffectTypes = [], // Immutable.List<String>, for keys of above maps
            sourceEffects = _.map(source.toObject(), function (effects, effectType) {
                return {
                    type: effectType,
                    effects: effects
                };
            });

        // For each effectType
        //      For each effect at index i
        //          Build every layer's ID array, with index for that layer, and props for that layer's new effect

        // Build a different master props/index list for each effect type
        sourceEffects.forEach(function (sourceEffect) {
            var curType = sourceEffect.type,
                effectPropsList = [],
                effectIndexList = [];

            masterEffectTypes.push(curType);
            // Each effect will have either an index, or null to be inserted into each layer,
            // which are saved in effectPropsList and effectIndexList
            sourceEffect.effects.forEach(function (effectObj, effectIndex) {
                var perEffectIndexList = [],
                    perEffectPropsList = [];

                targetLayers.forEach(function (targetLayer) {
                    var targetLayerEffects = targetLayer.getLayerEffectsByType(curType),
                        newEffectProps = effectObj;

                    if (targetLayerEffects && targetLayerEffects.has(effectIndex)) {
                        // If it already exists, we can just push the ID for that effect
                        perEffectIndexList.push(effectIndex); // The order we push on these lists is the layer ordering
                    } else {
                        // If it doesn't exist, we push a null object/null index
                        // THIS IS GONNA BE A PROBLEM WITH MULTIPLES
                        perEffectIndexList.push(null); // null signifies this will be the first effect 
                    }

                    var enabled = (newEffectProps.enabled === undefined) || newEffectProps.enabled;

                    // We have to keep this immutable so we don't lose the data structures like Color in the Record
                    newEffectProps.set("enabled", enabled);

                    perEffectPropsList.push(newEffectProps);
                });
                effectIndexList.push(Immutable.List(perEffectIndexList));
                effectPropsList.push(Immutable.List(perEffectPropsList));
            });
            // Now that we've build per effect per layer lists, we can add them to master list
            masterEffectIndexMap[curType] = Immutable.List(effectIndexList);
            masterEffectPropsMap[curType] = Immutable.List(effectPropsList);
        });

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            layerEffectTypes: Immutable.List(masterEffectTypes),
            layerEffectIndex: Immutable.Map(masterEffectIndexMap),
            layerEffectProps: Immutable.Map(masterEffectPropsMap),
            coalesce: false
        };

        this.dispatchAsync(events.style.HIDE_HUD);
        
        // Synchronously update the stores
        this.dispatch(events.document.history.optimistic.LAYER_EFFECTS_BATCH_CHANGED, payload);
        // Then update photoshop
        return _syncStoreToPs.call(this, document, targetLayers, false, masterEffectTypes, options);
    };
    duplicateLayerEffects.reads = [locks.PS_DOC, locks.JS_DOC];
    duplicateLayerEffects.writes = [locks.PS_DOC, locks.JS_DOC];

    exports.addEffect = addEffect;
    exports.deleteEffect = deleteEffect;
    
    exports.setEffectEnabled = setEffectEnabled;
    exports.setAlpha = setAlpha;
    exports.setColor = setColor;
    exports.setShadowX = setShadowX;
    exports.setShadowY = setShadowY;
    exports.setBlendMode = setBlendMode;
    exports.setShadowBlur = setShadowBlur;
    exports.setShadowSpread = setShadowSpread;
    exports.setStrokeSize = setStrokeSize;
    exports.setStrokeStyle = setStrokeStyle;

    exports.duplicateLayerEffects = duplicateLayerEffects;
});
