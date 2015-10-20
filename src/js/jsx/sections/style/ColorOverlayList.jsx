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
        Immutable = require("immutable"),
        classnames = require("classnames");
        
    var LayerEffect = require("js/models/effects/layereffect"),
        collection = require("js/util/collection"),
        strings = require("i18n!nls/strings"),
        headlights = require("js/util/headlights");

    var BlendMode = require("jsx!./BlendMode"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton");

    var ColorOverlay = React.createClass({
        mixins: [FluxMixin],
        
        shouldComponentUpdate: function (nextProps) {
            var sameLayerIDs = collection.pluck(this.props.layers, "id")
                .equals(collection.pluck(nextProps.layers, "id"));
        
            return !sameLayerIDs ||
                !Immutable.is(this.props.colorOverlays, nextProps.colorOverlays) ||
                this.props.index !== nextProps.index ||
                this.props.readOnly !== nextProps.readOnly;
        },

        /**
         * Handle the change of the effect color, including the alpha value
         *
         * @private
         * @param {Color} color new effect color
         * @param {boolean} coalesce
         */
        _colorChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setColorThrottled(this.props.document, this.props.layers,
                    LayerEffect.COLOR_OVERLAY, this.props.index, color, coalesce, false);
        },

        /**
         * Handle the change of the opaque effect color
         *
         * @private
         * @param {Color} color new effect opaque color
         * @param {boolean} coalesce
         */
        _opaqueColorChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setColorThrottled(this.props.document, this.props.layers,
                    LayerEffect.COLOR_OVERLAY, this.props.index, color, coalesce, true);
        },
        
        /**
         * Handle the change of the effect alpha
         *
         * @private
         * @param {Color} color new effect color
         * @param {boolean} coalesce
         */
        _alphaChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setAlphaThrottled(this.props.document, this.props.layers,
                    LayerEffect.COLOR_OVERLAY, this.props.index, color.a, coalesce);
        },
        
        /**
         * Handle the change of the effect blend mode value
         *
         * @private
         * @param {string} blendMode new blend mode
         */
        _blendModeChanged: function (blendMode) {
            this.getFlux().actions.layerEffects
                .setBlendModeThrottled(this.props.document,
                    this.props.layers,
                    this.props.index,
                    blendMode,
                    LayerEffect.COLOR_OVERLAY);
            headlights.logEvent("edit", "color-overlay-blendmode-input", blendMode);
        },

        /**
         * Handle the change of the effect enabled state
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} enabled new enabled state
         */
        _enabledChanged: function (event, enabled) {
            this.getFlux().actions.layerEffects.setEffectEnabled(
                this.props.document, this.props.layers, this.props.index, enabled, LayerEffect.COLOR_OVERLAY);
        },

        /**
         * Handle the deletion of the effect
         *
         * @private
         */
        _handleDelete: function () {
            this.getFlux().actions.layerEffects.deleteEffect(
                this.props.document, this.props.layers, this.props.index, LayerEffect.COLOR_OVERLAY);
            headlights.logEvent("effect", "delete", "color-overlay");
        },

        /**
         * Produce a set of arrays of separate colorOverlay display properties,
         * transformed and ready for the sub-components
         *
         * @private
         * @param {Array.<ColorOverlay>} colorOverlays
         * @return {object}
         */
        _downsampleColorOverlays: function (colorOverlays) {
            return {
                colors: collection.pluck(colorOverlays, "color"),
                enabledFlags: collection.pluck(colorOverlays, "enabled"),
                blendModes: collection.pluck(colorOverlays, "blendMode")
            };
        },

        render: function () {
            var downsample = this._downsampleColorOverlays(this.props.colorOverlays),
                colorOverlayClasses = classnames({
                    "effect-list__color-overlay": true,
                    "effect-list__color-overlay__disabled": this.props.readOnly
                });

            var colorOverlayColorTooltip = strings.TOOLTIPS.SET_COLOR_OVERLAY_COLOR,
                colorOverlayToggleTooltip = strings.TOOLTIPS.TOGGLE_COLOR_OVERLAY,
                colorOverlayDeleteTooltip = strings.TOOLTIPS.DELETE_COLOR_OVERLAY;

            // Dialog IDs
            var blendModelistID = "color-overlay-blendmodes-" + this.props.index + "-" + this.props.document.id,
                colorInputID = "color-overlay-" + this.props.index + "-" + this.props.document.id;

            return (
                <div className={colorOverlayClasses}>
                    <div className="formline formline__no-padding">
                        <div className="control-group control-group__vertical">
                            <ColorInput
                                id={colorInputID}
                                context={collection.pluck(this.props.layers, "id")}
                                title={colorOverlayColorTooltip}
                                editable={!this.props.readOnly}
                                defaultValue={downsample.colors}
                                onChange={this._colorChanged}
                                onFocus={this.props.onFocus}
                                onColorChange={this._opaqueColorChanged}
                                onAlphaChange={this._alphaChanged}/>
                        </div>
                        <div className="column-21 control-group__horizontal__left">
                            <BlendMode
                                listID={blendModelistID}
                                modes={downsample.blendModes}
                                handleChange={this._blendModeChanged}
                                disabled={this.props.disabled}
                                size="column-19"
                                onChange={this._blendModeChanged} />
                        </div>
                        <div className="button-toggle-list">
                            <ToggleButton
                                title={colorOverlayToggleTooltip}
                                buttonType="layer-not-visible"
                                selected={downsample.enabledFlags}
                                selectedButtonType={"layer-visible"}
                                onFocus={this.props.onFocus}
                                onClick={!this.props.readOnly && this._enabledChanged}
                                size="column-2" />
                            <ToggleButton
                                title={colorOverlayDeleteTooltip}
                                buttonType="delete"
                                className="delete"
                                selected={true}
                                onFocus={this.props.onFocus}
                                onClick={!this.props.readOnly && this._handleDelete}
                                size="column-2" />
                        </div>
                        
                    </div>
                </div>
            );
        }
    });

    var ColorOverlayList = React.createClass({
        mixins: [FluxMixin],

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected.filter(function (layer) {
                    return !layer.isBackground;
                });

            if (layers.isEmpty()) {
                return null;
            }
            
            var overlayCountsUnmatch = !layers.every(function (l) {
                    return l.colorOverlays.size === layers.first().colorOverlays.size;
                }),
                colorOverlayContent;
                
            if (!overlayCountsUnmatch) {
                if (layers.first().colorOverlays.size === 0) {
                    return null;
                }
                
                var temp = collection.pluck(layers, "colorOverlays");
                var colorOverlayGroups = collection.zip(temp);
                
                colorOverlayContent = colorOverlayGroups.map(function (colorOverlays, index) {
                    return (
                        <ColorOverlay
                            document={this.props.document}
                            onFocus={this.props.onFocus}
                            layers={layers}
                            key={index}
                            index={index}
                            readOnly={this.props.disabled}
                            colorOverlays={colorOverlays}/>
                    );
                }, this).toList();
            } else {
                colorOverlayContent = (
                    <div className="effect-list__list-container__mixed">
                        <i>{strings.STYLE.COLOR_OVERLAY.MIXED}</i>
                    </div>
                );
            }

            return (
                <div className="effect-list__container">
                    <header className="section-header section-header__no-padding">
                        <h3 className="section-title__subtitle">
                            {strings.STYLE.COLOR_OVERLAY.TITLE}
                        </h3>
                    </header>
                    <div className="effect-list__list-container">
                        {colorOverlayContent}
                    </div>
                </div>
            );
        }
    });

    module.exports = ColorOverlayList;
});
