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
        _ = require("lodash");

    var Color = require("js/models/color"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * FillColor Component displays color information of a single fill for a given layer or 
     * set of layers.
     */
    var FillColor = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            return !Immutable.is(this.props.fill, nextProps.fill) ||
                this.props.disabled !== nextProps.disabled;
        },

        /**
         * Handle the change of the fill opacity
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {number} opacity of fill, [0,100]
         */
        _opacityChanged: function (event, opacity) {
            this.getFlux().actions.shapes
                .setFillOpacityThrottled(this.props.document, this.props.layers, opacity);
        },

        /**
         * Handle the change of the fill color
         *
         * @private
         * @param {Color} color new fill color
         * @param {boolean} coalesce
         */
        _colorChanged: function (color, coalesce) {
            this.getFlux().actions.shapes
                .setFillColorThrottled(this.props.document, this.props.layers, color,
                    { coalesce: coalesce });
        },

        /**
         * Handle the change of the opaque fill color
         *
         * @private
         * @param {Color} color new fill color
         * @param {boolean} coalesce         
         */
        _opaqueColorChanged: function (color, coalesce) {
            this.getFlux().actions.shapes
                .setFillColorThrottled(this.props.document, this.props.layers, color,
                    {
                        coalesce: coalesce,
                        ignoreAlpha: true,
                        enabled: true
                    });
        },

        /**
         * Handle the change of the fill alpha value
         *
         * @private
         * @param {Color} color new fill color, from which only the alpha is extracted
         * @param {boolean} coalesce         
         */
        _alphaChanged: function (color, coalesce) {
            this.getFlux().actions.shapes
                .setFillOpacityThrottled(this.props.document, this.props.layers,
                    color.opacity, { coalesce: coalesce });
        },

        render: function () {
            // If there are no vector layers, hide the component
            if (!this.props.fill || this.props.layers.isEmpty()) {
                return (<div className="color-input color-input__swatch__color color-input__empty"></div>);
            }

            var fillOverlay = function (colorTiny) {
                var fillStyle = {
                    height: "100%",
                    width: "100%",
                    backgroundColor: colorTiny ? colorTiny.toRgbString() : "transparent"
                };
                
                return (
                    <div
                        className="fill__preview"
                        style={fillStyle}/>
                );
            };

            var colorInputID = "fill-" + this.props.document.id,
                fill = this.props.fill;

            return (
                <ColorInput
                    id={colorInputID}
                    className="fill"
                    context={collection.pluck(this.props.layers, "id")}
                    title={strings.TOOLTIPS.SET_FILL_COLOR}
                    editable={!this.props.disabled}
                    defaultValue={fill.colors}
                    onChange={this._colorChanged}
                    onColorChange={this._opaqueColorChanged}
                    onAlphaChange={this._alphaChanged}
                    onClick={!this.props.disabled ? this._toggleColorPicker : _.noop}
                    swatchOverlay={fillOverlay} />
            );
        }
    });
    
    /**
     * FillVisibility Component displays visibility information of a single fill for a given layer or 
     * set of layers.
     */
    var FillVisibility = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            return !Immutable.is(this.props.fill, nextProps.fill) ||
                this.props.disabled !== nextProps.disabled;
        },

        /**
         * Handle the button click event, call the toggleFillEnabled button
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {boolean} isChecked
         */
        _toggleFillEnabled: function (event, isChecked) {
            var color = this.props.fill && collection.uniformValue(this.props.fill.colors) || Color.DEFAULT;

            this.getFlux().actions.shapes.setFillEnabled(
                this.props.document,
                this.props.layers,
                color,
                { enabled: isChecked }
            );
        },

        render: function () {
            // If there are no vector layers, hide the component
            if (!this.props.fill || this.props.layers.isEmpty()) {
                return null;
            }

            return (
                <ToggleButton
                    title={strings.TOOLTIPS.TOGGLE_FILL}
                    name="toggleFillEnabled"
                    buttonType="layer-not-visible"
                    selected={this.props.fill.enabledFlags}
                    selectedButtonType={"layer-visible"}
                    onClick={!this.props.disabled ? this._toggleFillEnabled : _.noop}
                    size="column-2"
                />
            );
        }
    });

    module.exports.FillColor = FillColor;
    module.exports.FillVisibility = FillVisibility;
});
