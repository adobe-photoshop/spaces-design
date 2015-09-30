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

    var Shadow = require("./shadow"),
        Stroke = require("./stroke"),
        ColorOverlay = require("./coloroverlay");
    
    /**
     * Model for a layer's unsupported effects.
     *
     * @constructor
     */
    var LayerEffect = Immutable.Record({
        /**
         * Types defined in Layers.UNSUPPORTED_TYPES
         * @type {string}
         */
        type: null,
        
        /**
         * True if effect is enabled
         * @type {boolean}
         */
        enabled: null,
        
        /**
         * The raw value of the effect's descriptor from Photoshop.
         *
         * @private
         * @type {Immutable.Map}
         */
        _descriptor: null
    });
    
    /**
     * List of effect types
     *
     * @const
     * @type {string}
     */
    LayerEffect.INNER_SHADOW = "innerShadow";
    LayerEffect.DROP_SHADOW = "dropShadow";
    LayerEffect.BEVEL_EMBOSS = "bevelEmboss";
    LayerEffect.SATIN = "satin";
    LayerEffect.INNER_GLOW = "innerGlow";
    LayerEffect.OUTER_GLOW = "outerGlow";
    LayerEffect.PATTERN_OVERLAY = "patternOverlay";
    LayerEffect.STROKE = "stroke";
    LayerEffect.GRADIENT_OVERLAY = "gradientOverlay";
    LayerEffect.COLOR_OVERLAY = "colorOverlay";
    
    /**
     * List of shadow effect types.
     *
     * @const
     * @type {Immutable.Set.<string>}
     */
    LayerEffect.SHADOW_TYPES = new Immutable.Set([
        LayerEffect.INNER_SHADOW,
        LayerEffect.DROP_SHADOW
    ]);
    
    /**
     * List of unsupported layer effect types.
     *
     * @const
     * @type {Immutable.Set.<string>}
     */
    LayerEffect.UNSUPPORTED_TYPES = new Immutable.Set([
        LayerEffect.BEVEL_EMBOSS,
        LayerEffect.SATIN,
        LayerEffect.INNER_GLOW,
        LayerEffect.OUTER_GLOW,
        LayerEffect.PATTERN_OVERLAY,
        LayerEffect.GRADIENT_OVERLAY
    ]);
    
    /**
     * A set of all layer effect types.
     *
     * @const
     * @type {Immutable.Set.<string>}
     */
    LayerEffect.TYPES = new Immutable.Set([
        LayerEffect.INNER_SHADOW,
        LayerEffect.DROP_SHADOW,
        LayerEffect.BEVEL_EMBOSS,
        LayerEffect.SATIN,
        LayerEffect.INNER_GLOW,
        LayerEffect.OUTER_GLOW,
        LayerEffect.PATTERN_OVERLAY,
        LayerEffect.STROKE,
        LayerEffect.GRADIENT_OVERLAY,
        LayerEffect.COLOR_OVERLAY
    ]);
    
    /**
     * Adapter's internal effect types map Design Space types
     *
     * @private
     * @const
     * @type {Map.<string, string>}
     */
    var _DESCRIPTOR_TYPE_TO_DS_TYPE_MAP = {
        "innerShadow": LayerEffect.INNER_SHADOW,
        "dropShadow": LayerEffect.DROP_SHADOW,
        "bevelEmboss": LayerEffect.BEVEL_EMBOSS,
        "chromeFX": LayerEffect.SATIN,
        "innerGlow": LayerEffect.INNER_GLOW,
        "outerGlow": LayerEffect.OUTER_GLOW,
        "patternFill": LayerEffect.PATTERN_OVERLAY,
        "frameFX": LayerEffect.STROKE,
        "gradientFill": LayerEffect.GRADIENT_OVERLAY,
        "solidFill": LayerEffect.COLOR_OVERLAY
    };
    
    /**
     * Inversion of _DESCRIPTOR_TYPE_TO_DS_TYPE_MAP
     *
     * @private
     * @const
     * @type {Map.<string, string>}
     */
    var _DS_TYPE_TO_DESCRIPTOR_TYPE_MAP = _.invert(_DESCRIPTOR_TYPE_TO_DS_TYPE_MAP);
    
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
        var descriptor = this._descriptor.toObject();
        descriptor.enabled = this.enabled;
        return descriptor;
    };
    
    /**
     * Construct layer effect models map by their types. For shadow effects, their instances are 
     * created from Shadow model. For all other unsupported effects, their instances are LayerEffect model.
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
        
        // Use the empty effect
        var effects = {};
        
        LayerEffect.UNSUPPORTED_TYPES.forEach(function (effectType) {
            effects[effectType] = new Immutable.List();
        });

        _.map(layerEffects, function (effectDescriptors, descriptorType) {
            var effectType = LayerEffect.getEffectType(descriptorType.replace("Multi", ""));
            
            effectDescriptors = effectDescriptors instanceof Array ? effectDescriptors : [effectDescriptors];
            
            if (LayerEffect.SHADOW_TYPES.has(effectType)) {
                effects[effectType] = Shadow.fromEffectDescriptors(
                    effectType,
                    effectDescriptors,
                    layerDescriptor.globalAngle,
                    layerDescriptor.layerFXVisible);
            } else if (effectType === LayerEffect.COLOR_OVERLAY) {
                effects[effectType] = ColorOverlay.fromEffectDescriptors(effectType, effectDescriptors);
            } else if (effectType === LayerEffect.STROKE) {
                effects[effectType] = Stroke.fromEffectDescriptors(effectType, effectDescriptors);
            } else if (LayerEffect.UNSUPPORTED_TYPES.has(effectType)) {
                effects[effectType] = LayerEffect.fromEffectDescriptors(effectType, effectDescriptors);
            }
        });
      
        return Immutable.Map(effects);
    };
    
    /**
     * Construct layer effect model(s) from multiple Photoshop descriptors. 
     *
     * @param {string} effectType
     * @param {Array.<object>} effectDescriptors
     * @return {Immutable.List.<LayerEffect>}
     */
    LayerEffect.fromEffectDescriptors = function (effectType, effectDescriptors) {
        return effectDescriptors.reduce(function (effects, descriptor) {
            if (!descriptor.present) {
                return effects;
            }
            
            var effect = new LayerEffect({
                type: effectType,
                enabled: descriptor.enabled,
                _descriptor: new Immutable.Map(descriptor)
            });
            
            return effects.push(effect);
        }, new Immutable.List());
    };
    
    /**
     * Convert Adapter internal effect type to Design Space type. 
     * e.g. "frameFX" -> LayerEffect.STROKE
     * 
     * @param  {string} descriptorType
     * @return {string}
     */
    LayerEffect.getEffectType = function (descriptorType) {
        return _DESCRIPTOR_TYPE_TO_DS_TYPE_MAP[descriptorType];
    };
    
    /**
     * Convert Design Space effect type to Adapter effect type.
     * e.g. LayerEffect.STROKE -> "frameFX"
     * 
     * @param  {string} effectType
     * @return {string}
     */
    LayerEffect.getDescriptorType = function (effectType) {
        return _DS_TYPE_TO_DESCRIPTOR_TYPE_MAP[effectType];
    };
    
    /**
     * Static method to generate the appropriate LayerEffect based on a provided type
     *
     * @param {string} effectType
     * @return {Shadow|ColorOverlay|Stroke|LayerEffect}  instance of a layer effect such as a Shadow
     */
    LayerEffect.newEffectByType = function (effectType) {
        if (!LayerEffect.TYPES.has(effectType)) {
            throw new Error("Invalid layer effect type: " + effectType);
        }
        
        if (LayerEffect.SHADOW_TYPES.has(effectType)) {
            return new Shadow({ type: effectType });
        } else if (effectType === LayerEffect.COLOR_OVERLAY) {
            return new ColorOverlay({ type: LayerEffect.COLOR_OVERLAY });
        } else if (effectType === LayerEffect.STROKE) {
            return new Stroke({ type: LayerEffect.STROKE });
        } else {
            return new LayerEffect({ type: effectType });
        }
    };

    module.exports = LayerEffect;
});
