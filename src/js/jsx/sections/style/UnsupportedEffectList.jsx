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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        _ = require("lodash");
    
    var LayerEffect = require("js/models/effects/layereffect");

    var ToggleButton = require("js/jsx/shared/ToggleButton"),
        headlights = require("js/util/headlights"),
        nls = require("js/util/nls");

    var UnsupportedEffectList = React.createClass({
        mixins: [FluxMixin],
        
        /**
         * Handle delete unsupported layer effect.
         *
         * @private
         * @param  {string} effectType
         * @param  {number} effectIndex
         */
        _handleDelete: function (effectType, effectIndex) {
            this.getFlux().actions.layereffects.deleteEffect(
                this.props.document, this.props.layers, effectIndex, effectType);
            headlights.logEvent("effect", "delete", "unsupported");
        },
        
        /**
         * Handle the change of the Shadow enabled state
         *
         * @private
         * @param {string} effectType
         * @param {number} effectIndex
         * @param {SyntheticEvent} event
         * @param {boolean} enabled new enabled state
         */
        _enabledChangedHandler: function (effectType, effectIndex, event, enabled) {
            this.getFlux().actions.layereffects.setEffectEnabled(
                this.props.document, this.props.layers, effectIndex, enabled, effectType);
        },

        render: function () {
            var layers = this.props.layers,
                layer = layers.first();
            
            if (layers.isEmpty()) {
                return null;
            }
            
            var effectsContent;
            
            if (layers.size !== 1) {
                var hasUnsupportedLayerEffect = layers.some(function (layer) {
                    return layer.hasUnsupportedLayerEffect;
                });
                    
                if (!hasUnsupportedLayerEffect) {
                    return null;
                }
                
                effectsContent = (
                    <div className="effect-list__list-container__mixed">
                        {nls.localize("strings.STYLE.UNSUPPORTED_EFFECTS.MIXED")}
                    </div>
                );
            } else {
                var orderedEffects = _.flatten(_.values(layer.effects.map(function (effects, effectType) {
                    if (!LayerEffect.UNSUPPORTED_TYPES.has(effectType)) {
                        return [];
                    }
                    
                    return effects.map(function (effect, effectIndex) {
                        var effectStringKey = _.snakeCase(effectType).toUpperCase(),
                            effectName = nls.localize("strings.STYLE.UNSUPPORTED_EFFECTS.NAMES." + effectStringKey),
                            toggleBtnTitle = nls.localize("strings.TOOLTIPS.TOGGLE_LAYER_EFFECT")
                                .replace("%s", effectName),
                            deleteBtnTitle = nls.localize("strings.TOOLTIPS.DELETE_LAYER_EFFECT")
                                .replace("%s", effectName);
                            
                        return {
                            type: effectType,
                            index: effectIndex,
                            name: effectName,
                            deleteBtnTitle: deleteBtnTitle,
                            toggleBtnTitle: toggleBtnTitle,
                            total: effects.size,
                            enabled: effect.enabled
                        };
                    }).toJS();
                }).toJS())).sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });
                    
                var effectComponents = orderedEffects.map(function (effect) {
                    var key = effect.type + effect.index,
                        indexStr = effect.total > 1 ? (effect.index + 1) + " of " + effect.total : null,
                        deletionHandler = !this.props.disabled && this._handleDelete.bind(
                            this, effect.type, effect.index),
                        _enabledChangedHandler = !this.props.disabled && this._enabledChangedHandler.bind(
                            this, effect.type, effect.index);
                    
                    return (
                        <div className="unsupported-effect-list__effect"
                             key={key}>
                            <div className="unsupported-effect-list__effect__title">
                                {effect.name}
                                <span className="unsupported-effect-list__effect__index">{indexStr}</span>
                            </div>
                            <div className="unsupported-effect-list__effect__toggle-btns">
                                <ToggleButton
                                    title={effect.toggleBtnTitle}
                                    name="toggleShadowEnabled"
                                    buttonType="layer-not-visible"
                                    selected={effect.enabled}
                                    selectedButtonType={"layer-visible"}
                                    onFocus={this.props.onFocus}
                                    onClick={!this.props.readOnly ? _enabledChangedHandler : _.noop}
                                    size="column-2" />
                                <ToggleButton
                                    title={effect.deleteBtnTitle}
                                    buttonType="delete"
                                    className="delete"
                                    selected={true}
                                    onClick={deletionHandler}
                                    size="column-2" />
                            </div>
                        </div>
                    );
                }, this);
                
                if (effectComponents.length === 0) {
                    return null;
                }
                
                effectsContent = (
                    <div className="effect-list__list-container">
                        {effectComponents}
                    </div>
                );
            }
            
            return (
                <div className="unsupported-effect-list effect-list__container">
                    <header className="section-header section-header__no-padding">
                        <h3 className="section-title__subtitle">
                            {nls.localize("strings.STYLE.UNSUPPORTED_EFFECTS.TITLE")}
                        </h3>
                    </header>
                    {effectsContent}
                </div>
            );
        }
    });

    module.exports = UnsupportedEffectList;
});
