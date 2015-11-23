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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var LayerEffect = require("js/models/effects/layereffect"),
        collection = require("js/util/collection"),
        headlights = require("js/util/headlights"),
        nls = require("js/util/nls"),
        synchronization = require("js/util/synchronization");

    var Label = require("js/jsx/shared/Label"),
        NumberInput = require("js/jsx/shared/NumberInput"),
        BlendMode = require("./BlendMode"),
        ColorInput = require("js/jsx/shared/ColorInput"),
        ToggleButton = require("js/jsx/shared/ToggleButton");

    /**
     * Debounced version of headlights.logEvents to help prevent false changes from 
     * datalists from being logged. 
     *
     * @private
     * @type {function(*)}
     */
    var logEventDebounced = synchronization.debounce(headlights.logEvent, null, 10000);

    var MIN_SPREAD = 0,
        MAX_SPREAD = 100,
        MIN_BLUR = 0,
        MAX_BLUR = 250;

    /**
     * Shadow Component displays information of a single Shadow for a given layer or
     * set of layers.
     */
    var Shadow = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            var sameLayerIDs = collection.pluck(this.props.layers, "id")
                .equals(collection.pluck(nextProps.layers, "id"));

            return !sameLayerIDs ||
                !Immutable.is(this.props.shadows, nextProps.shadows) ||
                this.props.index !== nextProps.index ||
                this.props.readOnly !== nextProps.readOnly;
        },

        /**
         * Handle the change of the Shadow color, including the alpha value
         *
         * @private
         * @param {Color} color new shadow color
         * @param {boolean} coalesce
         */
        _colorChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setColorThrottled(this.props.document, this.props.layers,
                    this.props.type, this.props.index, color, coalesce, false);
        },

        /**
         * Handle the change of the opaque Shadow color
         *
         * @private
         * @param {Color} color new shadow opaque color
         * @param {boolean} coalesce
         */
        _opaqueColorChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setColorThrottled(this.props.document, this.props.layers,
                    this.props.type, this.props.index, color, coalesce, true);
        },

        /**
         * Handle the change of the Shadow alpha
         *
         * @private
         * @param {Color} color new shadow color
         * @param {boolean} coalesce
         */
        _alphaChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setAlphaThrottled(this.props.document, this.props.layers,
                    this.props.type, this.props.index, color.a, coalesce);
        },

        /**
         * Handle the change of the Shadow x coordinate.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {x} x new shadow x coordinate
         */
        _xChanged: function (event, x) {
            var minValidX = x,
                xChanged = false;

            this.props.shadows.forEach(function (shadow) {
                if (shadow) {
                    var oldX = shadow.x,
                        updatedX = shadow.setX(x).x;

                    // Want the lower value because it means that the current minValidX made the distance too
                    // big for the current shadow
                    minValidX = Math.abs(updatedX) < Math.abs(minValidX) ? updatedX : minValidX;

                    if (minValidX !== oldX) {
                        xChanged = true;
                    }
                }
            });

            if (xChanged) {
                this.getFlux().actions.layerEffects
                    .setShadowXThrottled(this.props.document, this.props.layers,
                        this.props.index, minValidX, this.props.type);
            } else {
                this.forceUpdate();
            }
        },

        /**
         * Handle the change of the Shadow y coordinate
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {y} y new shadow y coordinate
         */
        _yChanged: function (event, y) {
            var minValidY = y,
                yChanged = false;

            this.props.shadows.forEach(function (shadow) {
                if (shadow) {
                    var oldY = shadow.y,
                        updatedY = shadow.setY(y).y;

                    // Want the lower value because it means that the current minValidY made the distance too
                    // big for the current shadow
                    minValidY = Math.abs(updatedY) < Math.abs(minValidY) ? updatedY : minValidY;

                    if (minValidY !== oldY) {
                        yChanged = true;
                    }
                }
            });

            if (yChanged) {
                this.getFlux().actions.layerEffects
                    .setShadowYThrottled(this.props.document, this.props.layers,
                        this.props.index, minValidY, this.props.type);
            } else {
                this.forceUpdate();
            }
        },

        /**
         * Handle the change of the Shadow blur value in pixels
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {blur} blur new shadow blur value in pixels
         */
        _blurChanged: function (event, blur) {
            this.getFlux().actions.layerEffects
                .setShadowBlurThrottled(this.props.document,
                    this.props.layers,
                    this.props.index,
                    blur,
                    this.props.type);
        },

        /**
         * Handle the change of the Shadow spread value in pixels
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {spread} spread new shadow spread value in pixels
         */
        _spreadChanged: function (event, spread) {
            this.getFlux().actions.layerEffects
                .setShadowSpreadThrottled(this.props.document,
                    this.props.layers,
                    this.props.index,
                    spread,
                    this.props.type);
        },
        
        /**
         * Handle the change of the Shadow blend mode value
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
                    this.props.type);
            // Currently does not differentiate between inner and drop shadows
            logEventDebounced("edit", "shadow-blendmode-input", blendMode);
        },

        /**
         * Handle the change of the Shadow enabled state
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} enabled new enabled state
         */
        _enabledChanged: function (event, enabled) {
            this.getFlux().actions.layerEffects.setEffectEnabled(
                this.props.document, this.props.layers, this.props.index, enabled, this.props.type);
        },

        /**
         * Handle the deletion of the Shadow
         *
         * @private
         */
        _handleDelete: function () {
            this.getFlux().actions.layerEffects.deleteEffect(
                this.props.document, this.props.layers, this.props.index, this.props.type);
            
            headlights.logEvent("effect", "delete", "shadow");
        },

        /**
         * Produce a set of arrays of separate dropShadow display properties,
         * transformed and ready for the sub-components
         *
         * @private
         * @param {Array.<DropShadow>} shadows
         * @return {object}
         */
        _downsampleShadows: function (shadows) {
            return {
                colors: collection.pluck(shadows, "color"),
                enabledFlags: collection.pluck(shadows, "enabled"),
                xPositions: collection.pluck(shadows, "x"),
                yPositions: collection.pluck(shadows, "y"),
                blurs: collection.pluck(shadows, "blur"),
                spreads: collection.pluck(shadows, "spread"),
                blendModes: collection.pluck(shadows, "blendMode")
            };
        },

        /** @ignore */
        _stringHelper: function (dropString, innerString) {
            if (this.props.type === LayerEffect.DROP_SHADOW) {
                return dropString;
            } else if (this.props.type === LayerEffect.INNER_SHADOW) {
                return innerString;
            } else {
                throw new Error("Unexpected shadow type: " + this.props.type);
            }
        },

        render: function () {
            var downsample = this._downsampleShadows(this.props.shadows),
                shadowClasses = classnames({
                    "effect-list__shadow": true,
                    "effect-list__shadow__disabled": this.props.readOnly
                });

            var shadowXPositionTooltip = this._stringHelper(
                    nls.localize("strings.TOOLTIPS.SET_DROP_SHADOW_X_POSITION"),
                    nls.localize("strings.TOOLTIPS.SET_INNER_SHADOW_X_POSITION")
                ),
                shadowYPositionTooltip = this._stringHelper(
                    nls.localize("strings.TOOLTIPS.SET_DROP_SHADOW_Y_POSITION"),
                    nls.localize("strings.TOOLTIPS.SET_INNER_SHADOW_Y_POSITION")
                ),
                shadowColorTooltip = this._stringHelper(
                    nls.localize("strings.TOOLTIPS.SET_DROP_SHADOW_COLOR"),
                    nls.localize("strings.TOOLTIPS.SET_INNER_SHADOW_COLOR")
                ),
                shadowBlurTooltip = this._stringHelper(
                    nls.localize("strings.TOOLTIPS.SET_DROP_SHADOW_BLUR"),
                    nls.localize("strings.TOOLTIPS.SET_INNER_SHADOW_BLUR")
                ),
                shadowSpreadTooltip = this._stringHelper(
                    nls.localize("strings.TOOLTIPS.SET_DROP_SHADOW_SPREAD"),
                    nls.localize("strings.TOOLTIPS.SET_INNER_SHADOW_SPREAD")
                ),
                shadowToggleTooltip = this._stringHelper(
                    nls.localize("strings.TOOLTIPS.TOGGLE_DROP_SHADOW"),
                    nls.localize("strings.TOOLTIPS.TOGGLE_INNER_SHADOW")
                ),
                shadowDeleteTooltip = this._stringHelper(
                    nls.localize("strings.TOOLTIPS.DELETE_DROP_SHADOW"),
                    nls.localize("strings.TOOLTIPS.DELETE_INNER_SHADOW")
                );

            var shadowXPosition = this._stringHelper(
                    nls.localize("strings.STYLE.DROP_SHADOW.X_POSITION"),
                    nls.localize("strings.STYLE.INNER_SHADOW.X_POSITION")
                ),
                shadowYPosition = this._stringHelper(
                    nls.localize("strings.STYLE.DROP_SHADOW.Y_POSITION"),
                    nls.localize("strings.STYLE.INNER_SHADOW.Y_POSITION")
                ),
                shadowBlur = this._stringHelper(
                    nls.localize("strings.STYLE.DROP_SHADOW.BLUR"),
                    nls.localize("strings.STYLE.INNER_SHADOW.BLUR")
                ),
                shadowSpread = this._stringHelper(
                    nls.localize("strings.STYLE.DROP_SHADOW.SPREAD"),
                    nls.localize("strings.STYLE.INNER_SHADOW.SPREAD")
                );

            var type = this.props.type,
                blendModelistID = "shadow-blendmodes-" + type + this.props.index + "-" + this.props.document.id,
                colorInputID = "shadow-" + type + "-" + this.props.index + "-" + this.props.document.id;

            return (
                <div className={shadowClasses}>
                    <div className="formline formline__no-padding">
                        <div className="control-group control-group__vertical">
                            <ColorInput
                                id={colorInputID}
                                context={collection.pluck(this.props.layers, "id")}
                                title={shadowColorTooltip}
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
                                title={shadowToggleTooltip}
                                name="toggleShadowEnabled"
                                buttonType="layer-not-visible"
                                selected={downsample.enabledFlags}
                                selectedButtonType={"layer-visible"}
                                onFocus={this.props.onFocus}
                                onClick={!this.props.readOnly ? this._enabledChanged : _.noop}
                                size="column-2" />
                            <ToggleButton
                                title={shadowDeleteTooltip}
                                name="deleteDropShadowEnabled"
                                buttonType="delete"
                                className="delete"
                                selected={true}
                                onFocus={this.props.onFocus}
                                onClick={!this.props.readOnly ? this._handleDelete : _.noop}
                                size="column-2" />
                        </div>
                    </div>
                    <div className="formline formline__no-padding">
                        <Label
                            title={shadowXPositionTooltip}
                            size="column-1">
                            {shadowXPosition}
                        </Label>
                        <NumberInput
                            value={downsample.xPositions}
                            onChange={this._xChanged}
                            onFocus={this.props.onFocus}
                            disabled={this.props.readOnly}
                            size="column-3" />
                        <Label
                            title={shadowYPositionTooltip}
                            size="column-1">
                            {shadowYPosition}
                        </Label>
                        <NumberInput
                            value={downsample.yPositions}
                            onChange={this._yChanged}
                            onFocus={this.props.onFocus}
                            disabled={this.props.readOnly}
                            size="column-3" />
                        <Label
                            title={shadowBlurTooltip}
                            className="blur-label"
                            size="column-2">
                            {shadowBlur}
                        </Label>
                        <NumberInput
                            value={downsample.blurs}
                            onChange={this._blurChanged}
                            onFocus={this.props.onFocus}
                            disabled={this.props.readOnly}
                            min={MIN_BLUR}
                            max={MAX_BLUR}
                            size="column-3" />
                        <Label
                            title={shadowSpreadTooltip}
                            className="spread-label"
                            size="column-4">
                            {shadowSpread}
                        </Label>
                        <div className="column-5">
                            <NumberInput
                                value={downsample.spreads}
                                onChange={this._spreadChanged}
                                onFocus={this.props.onFocus}
                                disabled={this.props.readOnly}
                                min={MIN_SPREAD}
                                max={MAX_SPREAD}
                                size="column-3" />
                        </div>
                    </div>
                </div>
            );
        }
    });

    /**
     * DropShadowList Component maintains a set of dropShadows components for the selected Layer(s)
     */
    var DropShadowList = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            max: React.PropTypes.number
        },

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected.filter(function (layer) {
                    return !layer.isBackground;
                });

            if (layers.isEmpty()) {
                return null;
            }
                
            var shadowCountsUnmatch = !layers.every(function (l) {
                    return l.dropShadows.size === layers.first().dropShadows.size;
                }),
                shadowsContent;
                
            if (!shadowCountsUnmatch) {
                // Group into arrays of dropShadows, by position in each layer
                var shadowGroups = collection.zip(collection.pluck(layers, "dropShadows"));
                
                if (shadowGroups.isEmpty()) {
                    return null;
                }
                
                shadowsContent = shadowGroups.map(function (dropShadows, index) {
                    return (
                        <Shadow
                            document={this.props.document}
                            onFocus={this.props.onFocus}
                            layers={layers}
                            key={index}
                            index={index}
                            readOnly={this.props.disabled}
                            shadows={dropShadows}
                            type={LayerEffect.DROP_SHADOW} />
                    );
                }, this).toList();
            } else {
                shadowsContent = (
                    <div className="effect-list__list-container__mixed">
                        <i>{nls.localize("strings.STYLE.DROP_SHADOW.MIXED")}</i>
                    </div>
                );
            }

            return (
                <div className="effect-list__container ">
                    <header className="section-header section-header__no-padding">
                        <h3 className="section-title__subtitle">
                            {nls.localize("strings.STYLE.DROP_SHADOW.TITLE")}
                        </h3>
                    </header>
                    <div className="effect-list__list-container">
                        {shadowsContent}
                    </div>
                </div>
            );
        }
    });

    /**
     * InnerShadowList Component maintains a set of innerShadows components for the selected Layer(s)
     */
    var InnerShadowList = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            max: React.PropTypes.number
        },

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected.filter(function (layer) {
                    return !layer.isBackground;
                });

            if (layers.isEmpty()) {
                return null;
            }
            
            var shadowCountsUnmatch = !layers.every(function (l) {
                    return l.innerShadows.size === layers.first().innerShadows.size;
                }),
                shadowsContent;
                
            if (!shadowCountsUnmatch) {
                // Group into arrays of innerShadows, by position in each layer

                var temp = collection.pluck(layers, "innerShadows");
                var shadowGroups = collection.zip(temp);
                
                if (shadowGroups.isEmpty()) {
                    return null;
                }
                
                shadowsContent = shadowGroups.map(function (innerShadows, index) {
                    return (
                        <Shadow {...this.props}
                            layers={layers}
                            key={index}
                            index={index}
                            readOnly={this.props.disabled}
                            shadows={innerShadows}
                            type={LayerEffect.INNER_SHADOW} />
                    );
                }, this).toList();
            } else {
                shadowsContent = (
                    <div className="effect-list__list-container__mixed">
                        <i>{nls.localize("strings.STYLE.INNER_SHADOW.MIXED")}</i>
                    </div>
                );
            }

            return (
                <div className="effect-list__container">
                    <header className="section-header section-header__no-padding">
                        <h3 className="section-title__subtitle">
                            {nls.localize("strings.STYLE.INNER_SHADOW.TITLE")}
                        </h3>
                    </header>
                    <div className="effect-list__list-container">
                        {shadowsContent}
                    </div>
                </div>
            );
        }
    });

    exports.InnerShadowList = InnerShadowList;
    exports.DropShadowList = DropShadowList;
});
