/*
 * Copyright (c) 2016 Adobe Systems Incorporated. All rights reserved.
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
        _ = require("lodash");

    var LayerBlendMode = require("./LayerBlendMode"),
        Opacity = require("./Opacity"),
        ColorInput = require("js/jsx/shared/ColorInput"),
        Label = require("js/jsx/shared/Label"),
        ToggleButton = require("js/jsx/shared/ToggleButton"),
        CoalesceMixin = require("js/jsx/mixin/Coalesce"),
        nls = require("js/util/nls"),
        math = require("js/util/math"),
        collection = require("js/util/collection"),
        headlights = require("js/util/headlights");

    /**
     * AppearanceProperties Component displays information for the fill, blend mode, 
     * opacity, and toggle visibility for both type and vector layers
     */
    var AppearanceProperties = React.createClass({
        mixins: [FluxMixin, CoalesceMixin],

        shouldComponentUpdate: function (nextProps) {
            return this.props.disabled !== nextProps.disabled ||
                !Immutable.is(this.props.document, nextProps.document) ||
                !Immutable.is(this.props.fill, nextProps.fill);
        },

        /**
         * Begins opacity scrubbing by saving current opacity value
         *
         * @private
         */
        _handleOpacityScrubBegin: function () {
            var opacity = collection.uniformValue(this.state.opacities);

            if (opacity !== null) {
                this.setState({
                    scrubOpacity: opacity
                });

                this.startCoalescing();
            }
        },

        /**
         * Calls a throttled setOpacity action on scrubs
         *
         * @private
         * @param {number} deltaX Amount of scrub distance
         */
        _handleOpacityScrub: function (deltaX) {
            if (this.state.scrubOpacity === null) {
                return;
            }

            var actionOpts = {
                coalesce: this.shouldCoalesce()
            };

            var newOpacity = math.clamp(this.state.scrubOpacity + deltaX, 0, 100),
                currentOpacity = collection.uniformValue(this.state.opacities);

            if (newOpacity !== currentOpacity) {
                this.getFlux().actions.layers.changeOpacityThrottled(
                    this.props.document,
                    this.props.layersSelected,
                    newOpacity,
                    actionOpts
                );
            }
        },

        _handleOpacityScrubEnd: function () {
            this.setState({
                scrubOpacity: null
            });

            this.stopCoalescing();
        },

        /**
         * Handle the change of the color for all selected layers for
         * which this is possible
         *
         * @private
         * @param {Color} color new fill color
         * @param {boolean} coalesce
         */
        _colorChanged: function (color, coalesce) {
            var actionOpts = {
                coalesce: coalesce,
                ignoreAlpha: this.props.opaque
            };

            this.getFlux().actions.layers
                .changeColorsThrottled(this.props.document, this.props.vectorLayers,
                    this.props.textLayers, color, actionOpts);

            if (!coalesce) {
                if (this.props.textLayers.size > 0 && this.props.vectorLayers.size === 0) {
                    headlights.logEvent("edit", "color-input", "type-color-change");
                } else if (this.props.textLayers.size === 0 && this.props.vectorLayers > 0) {
                    headlights.logEvent("edit", "color-input", "fill-color-change");
                } else {
                    headlights.logEvent("edit", "color-input", "type-fill-color-change");
                }
            }
        },

        /**
         * Handle the change of the opaque fill color for all selected layers
         * for which this is possible
         *
         * @private
         * @param {Color} color new fill color
         * @param {boolean} coalesce         
         */
        _opaqueColorChanged: function (color, coalesce) {
            var actionOpts = {
                coalesce: coalesce,
                ignoreAlpha: true,
                enabled: true
            };

            this.getFlux().actions.layers
                .changeColorsThrottled(this.props.document, this.props.selectedLayers, color, actionOpts);

            if (!coalesce) {
                if (this.props.textLayers.size > 0 && this.props.vectorLayers.size === 0) {
                    headlights.logEvent("edit", "color-input", "type-color-change");
                } else if (this.props.textLayers.size === 0 && this.props.vectorLayers > 0) {
                    headlights.logEvent("edit", "color-input", "fill-color-change");
                } else {
                    headlights.logEvent("edit", "color-input", "type-fill-color-change");
                }
            }
        },

        /**
         * Handle the change of the fill alpha value for all selected layers for 
         * which this is possible
         *
         * @private
         * @param {Color} color new fill color, from which only the alpha is extracted
         * @param {boolean} coalesce         
         */
        _alphaChanged: function (color, coalesce) {
            var actionOpts = {
                coalesce: coalesce
            };

            if (this.props.opaque) {
                return;
            }

            this.getFlux().actions.layers
                .changeOpacityThrottled(this.props.document, this.props.selectedLayers, color.opacity, actionOpts);

            if (!coalesce) {
                if (this.props.textLayers.size > 0 && this.props.vectorLayers.size === 0) {
                    headlights.logEvent("edit", "color-input", "type-color-change");
                } else if (this.props.textLayers.size === 0 && this.props.vectorLayers > 0) {
                    headlights.logEvent("edit", "color-input", "fill-color-change");
                } else {
                    headlights.logEvent("edit", "color-input", "type-fill-color-change");
                }
            }
        },

        /**
         * Handle the button click event, call the toggleFillEnabled button
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {boolean} isChecked
         */
        _toggleFillEnabled: function (event, isChecked) {
            this.getFlux().actions.shapes.setFillEnabled(
                this.props.document,
                this.props.vectorLayers,
                { enabled: isChecked }
            );
        },

        render: function () {
            var fillVisibilityToggle = this.props.vectorLayers.size === 0 ? null : (
                    <ToggleButton
                        title={nls.localize("strings.TOOLTIPS.TOGGLE_FILL")}
                        name="toggleFillEnabled"
                        buttonType="layer-not-visible"
                        selected={this.props.fill.enabledFlags}
                        selectedButtonType={"layer-visible"}
                        onClick={!this.props.disabled ? this._toggleFillEnabled : _.noop}
                        size="column-2" />
                ),
                colorPickerID = "appearance-properties" + this.props.document.id;

            if (!this.props.forceDisabledDisplay && (this.props.selectedLayers.size === 0 || !this.props.fill)) {
                return (
                    <div className="color-input color-input__swatch__color color-input__empty">
                        <div
                            className="fill__preview__disabled"/>
                    </div>
                );
            }

            return (
                <div>
                    <div className={this.props.className}>
                        <div className="control-group__vertical vector-fill">
                            <ColorInput
                                id={colorPickerID}
                                ref="color"
                                onChange={this._colorChanged}
                                onAlphaChange={this._alphaChanged}
                                onClick={!this.props.disabled ? this._toggleColorPicker : _.noop}
                                onColorChange={this._opaqueColorChanged}
                                defaultValue={this.props.defaultValue}
                                className="color-picker__appearance-properties"
                                context={collection.pluck(this.props.selectedLayers, "id")}
                                title={nls.localize("strings.TOOLTIPS.SET_TYPE_FILL_COLOR")}
                                editable={!this.props.disabled}
                                opaque={this.props.opaque}
                                swatchOverlay={this.props.swatchOverlay} />
                        </div>
                        <div className="control-group__vertical control-group__no-label">
                            <LayerBlendMode
                                document={this.props.document}
                                disabled={this.props.disabled}
                                onFocus={this.props.onFocus}
                                containerType={"appearance-properties"}
                                layers={this.props.selectedLayers} />
                        </div>
                        <div className="control-group__vertical">
                            <Label
                                size="column-4"
                                className={"label__medium__left-aligned opacity-label"}
                                onScrubStart={this._handleOpacityScrubBegin}
                                onScrub={this._handleOpacityScrub}
                                onScrubEnd={this._handleOpacityScrubEnd}
                                title={nls.localize("strings.TOOLTIPS.SET_OPACITY")}>
                                {nls.localize("strings.STYLE.OPACITY")}
                            </Label>
                            <Opacity
                                document={this.props.document}
                                disabled={this.props.disabled}
                                onFocus={this.props.onFocus}
                                selectedLayers={this.props.selectedLayers} />
                        </div>
                        <div className="control-group__vertical control-group__no-label">
                            {fillVisibilityToggle}
                        </div>
                    </div>
                </div>
            );
        }
    });

    module.exports = AppearanceProperties;
});
