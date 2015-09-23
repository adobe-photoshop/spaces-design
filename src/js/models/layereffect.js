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

    var Shadow = require("./shadow");
    
    /**
     * Model for a layer's unsupported effects.
     *
     * @constructor
     */
    var LayerEffect = Immutable.Record({
        /**
         * Types defined in Layers.UNSUPPORTED_TYPES
         * 
         * @type {string}
         */
        type: null,
        
        /**
         * The raw value of the effect's descriptor returned from Photoshop.
         * This attr is readonly (via Object.freeze).
         *
         * @private
         * @type {object}
         */
        _descriptor: null,
        
        /**
         * Only enabled layer effect are shown in the unsupported layer effects list.
         * Therefore, we can safely assume all unsupported effects are enabled.
         * 
         * @type {boolean}
         */
        enabled: true
    });
    
    /**
     * List of shadow effect types.
     *
     * @const
     * @type {Immutable.Set.<string>}
     */
    LayerEffect.SHADOW_TYPES = new Immutable.Set([
        "innerShadow",
        "dropShadow"
    ]);
    
    /**
     * List of unsupported layer effect types.
     *
     * @const
     * @type {Immutable.Set.<string>}
     */
    LayerEffect.UNSUPPORTED_TYPES = new Immutable.Set([
        "bevelEmboss", // Bevel & Emboss
        "chromeFX", // Satin
        "innerGlow", // Inner Glow
        "outerGlow", // Outer Glow
        "patternFill", // Pattern Overlay
        "frameFX", // Stroke Overlay
        "gradientFill", // Gradient Overlay
        "solidFill" // Color Overlay
    ]);
    
    /**
     * List of all layer effect types.
     *
     * @const
     * @type {Immutable.Set.<string>}
     */
    LayerEffect.TYPES = LayerEffect.SHADOW_TYPES.concat(LayerEffect.UNSUPPORTED_TYPES);
    
    /**
     * Layer effect types to empty immutable list. This is the default value for LayerEffect.fromLayerDescriptor
     *
     * @const
     * @type { Immutable.Map.<string, Immutable.List>}
     */
    LayerEffect.EMPTY_EFFECTS = new Immutable.Map(LayerEffect.TYPES.toJS().reduce(function (result, type) {
        result[type] = new Immutable.List();
        return result;
    }, {}));
    
    /**
     * Represent this layer effect in an intermediate format that is useful to playground-adapter.
     *
     * @return {object}
     */
    LayerEffect.prototype.toAdapterObject = function () {
        return this._descriptor;
    };
    
    /**
     * Construct layer effect models map by their types. For shadow effects, their instances are 
     * created from Shadow model. For all other unsupported effects, their instances are LyaerEffect model.
     * For those layer effects that a layer does not have, they will assign with an empty immutable list.
     *
     * @param {object} layerDescriptor
     * @return {Immutable.Map.<string, Immutable.List<LayerEffect|Shadow>>}
     */
    LayerEffect.fromLayerDescriptor = function (layerDescriptor) {
        var layerEffects = layerDescriptor.layerEffects;
        if (!layerEffects) {
            return LayerEffect.EMPTY_EFFECTS;
        }
        
        var effects = {};
        
        LayerEffect.UNSUPPORTED_TYPES.forEach(function (effectType) {
            effects[effectType] = new Immutable.List();
        });
        
        LayerEffect.SHADOW_TYPES.forEach(function (shadowType) {
            effects[shadowType] = Shadow.fromLayerDescriptor(layerDescriptor, shadowType);
        });

        _.map(layerEffects, function (effectDescriptors, effectType) {
            effectType = effectType.replace("Multi", "");
            effectDescriptors = effectDescriptors instanceof Array ? effectDescriptors : [effectDescriptors];
            
            if (LayerEffect.UNSUPPORTED_TYPES.has(effectType)) {
                effects[effectType] = LayerEffect.fromEffectDescriptor(effectType, effectDescriptors);
            }
        });
      
        return Immutable.Map(effects);
    };
    
    /**
     * Construct layer effect model(s) from multiple Photoshop descriptors. 
     *
     * @param {string} effectType
     * @param {object} effectDescriptors
     * @return {Immutable.List.<?LayerEffect>}
     */
    LayerEffect.fromEffectDescriptor = function (effectType, effectDescriptors) {
        var effects = effectDescriptors.reduce(function (effects, descriptor) {
            if (descriptor.present && descriptor.enabled) {
                effects.push(new LayerEffect({
                    type: effectType,
                    _descriptor: Object.freeze(descriptor)
                }));
            }
            
            return effects;
        }, []);
        
        return new Immutable.List(effects);
    };

    module.exports = LayerEffect;
});
