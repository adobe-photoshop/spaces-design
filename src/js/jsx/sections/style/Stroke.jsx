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
        classnames = require("classnames"),
        _ = require("lodash");

    var contentLayerLib = require("adapter/lib/contentLayer");

    var Color = require("js/models/color"),
        StrokeAlignment = require("jsx!./StrokeAlignment"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * Stroke Component displays information of a single stroke for a given layer or 
     * set of layers.
     */
    var Stroke = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps, nextState) {
            return !Immutable.is(this.state.stroke, nextState.stroke) ||
                this.props.disabled !== nextProps.disabled;
        },

        getInitialState: function () {
            return {
                layers: Immutable.List(),
                stroke: null
            };
        },

        componentWillReceiveProps: function (nextProps) {
            var document = nextProps.document,
                // We only care about vector layers. If at least one exists, then this component should render
                layers = document.layers.selected.filter(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                }),
                strokes = collection.pluck(layers, "stroke"),
                downsample = this._downsampleStrokes(strokes);

            this.setState({
                layers: layers,
                stroke: downsample
            });
        },

        /**
         * Handle the button click event, call the toggleStrokeEnabled button
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} isChecked
         */
        _toggleStrokeEnabled: function (event, isChecked) {
            this.getFlux().actions.shapes.setStrokeEnabled(
                this.props.document,
                this.state.layers,
                this.state.stroke && this.state.stroke.colors.first() || Color.DEFAULT,
                isChecked
            );
        },

        /**
         * Handle the change of the stroke width
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} width width of stroke, in pixels
         */
        _widthChanged: function (event, width) {
            this.getFlux().actions.shapes
                .setStrokeWidthThrottled(this.props.document, this.state.layers, width);
        },

        /**
         * Handle the change of the stroke opacity
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {number} opacity  of stroke, [0,100]
         */
        _opacityChanged: function (event, opacity) {
            this.getFlux().actions.shapes
                .setStrokeOpacityThrottled(this.props.document, this.state.layers, opacity);
        },

        /**
         * Handle the change of the stroke alpha value
         *
         * @private
         * @param {Color} color new stroke color, from which only the alpha is extracted
         * @param {boolean} coalesce         
         */
        _alphaChanged: function (color, coalesce) {
            this.getFlux().actions.shapes
                .setStrokeOpacityThrottled(this.props.document, this.state.layers,
                    color.opacity, coalesce);
        },

        /**
         * Handle the change of the opaque stroke color
         *
         * @private
         * @param {Color} color new stroke color
         * @param {boolean} coalesce         
         */
        _opaqueColorChanged: function (color, coalesce) {
            this._colorChanged.call(this, color, coalesce, true);
        },

        /**
         * Handle the change of the stroke color, including the alpha value
         *
         * @private
         * @param {Color} color new stroke color
         * @param {boolean} coalesce         
         */
        _colorChanged: function (color, coalesce, ignoreAlpha) {
            // If the enabled flags are mixed, or uniformly false, we want to clobber it with true
            // Otherwise left undefined, it will not cause a bounds change
            var strokes = collection.pluck(this.state.layers, "stroke"),
                isEnabledChanging = !collection.uniformValue(collection.pluck(strokes, "enabled")),
                enabled = isEnabledChanging || undefined;

            this.getFlux().actions.shapes
                .setStrokeColorThrottled(this.props.document, this.state.layers, color, coalesce,
                    enabled, ignoreAlpha);
        },

        /**
         * Produce a set of arrays of separate stroke display properties, transformed and ready for the sub-components
         *
         * @private
         * @param {Immutable.List.<Stroke>} strokes
         * @return {object}
         */
        _downsampleStrokes: function (strokes) {
            var colors = strokes.map(function (stroke) {
                    if (!stroke) {
                        return null;
                    }
                    if (stroke.type === contentLayerLib.contentTypes.SOLID_COLOR) {
                        return stroke.color;
                    } else {
                        return stroke.type;
                    }
                }),
                widths = collection.pluck(strokes, "width", 0)
                    .map(function (width) {
                        return width ? Math.ceil(width * 100) / 100 : 0;
                    }),
                opacityPercentages = collection.pluck(strokes, "color")
                    .map(function (color) {
                        return color && color.opacity;
                    }),
                enabledFlags = collection.pluck(strokes, "enabled", false),
                alignments = collection.pluck(strokes, "alignment");

            return {
                colors: colors,
                widths: widths,
                opacityPercentages: opacityPercentages,
                enabledFlags: enabledFlags,
                alignments: alignments
            };
        },

        render: function () {
            // If there are no vector layers, hide the component
            if (!this.state.stroke || this.state.layers.isEmpty()) {
                return null;
            }

            var stroke = this.state.stroke;

            var strokeClasses = classnames({
                "stroke-list__stroke": true,
                "stroke-list__stroke__disabled": this.props.disabled
            });

            var strokeOverlay = function (colorTiny) {
                var strokeStyle = {
                    width: "100%",
                    height: (collection.uniformValue(stroke.widths) || 0) + "%",
                    backgroundColor: colorTiny ? colorTiny.toRgbString() : "transparent"
                };

                return (
                    <div
                        className="stroke__preview"
                        style={strokeStyle}/>
                );
            };

            var colorInputID = "stroke-" + this.props.document.id;

            return (
                <div className="stroke-list__container">
                    <header className="stroke-list__header sub-header">
                        <h3>
                            {strings.STYLE.STROKE.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule"/>
                    </header>
                    <div className="stroke-list__list-container">
                        <div className={strokeClasses}>
                            <div className="formline">
                                <Gutter />
                                <ColorInput
                                    id={colorInputID}
                                    className="stroke"
                                    context={collection.pluck(this.state.layers, "id")}
                                    title={strings.TOOLTIPS.SET_STROKE_COLOR}
                                    editable={!this.props.disabled}
                                    defaultValue={stroke.colors}
                                    onChange={this._colorChanged}
                                    onFocus={this.props.onFocus}
                                    onColorChange={this._opaqueColorChanged}
                                    onAlphaChange={this._alphaChanged}
                                    onClick={!this.props.disabled ? this._toggleColorPicker : _.noop}
                                    swatchOverlay={strokeOverlay}>

                                    <div className="compact-stats__body">
                                        <div className="compact-stats__body__column">
                                            <Label
                                                title={strings.TOOLTIPS.SET_STROKE_OPACITY}
                                                size="column-4">
                                                {strings.STYLE.STROKE.ALPHA}
                                            </Label>
                                            <NumberInput
                                                value={stroke.opacityPercentages}
                                                onChange={this._opacityChanged}
                                                onFocus={this.props.onFocus}
                                                min={0}
                                                max={100}
                                                step={1}
                                                bigstep={10}
                                                disabled={this.props.disabled}
                                                size="column-3" />
                                        </div>
                                        <Gutter />
                                        <div className="compact-stats__body__column">
                                            <Label
                                                title={strings.TOOLTIPS.SET_STROKE_SIZE}
                                                size="column-4">
                                                {strings.STYLE.STROKE.SIZE}
                                            </Label>
                                            <NumberInput
                                                value={stroke.widths}
                                                onChange={this._widthChanged}
                                                onFocus={this.props.onFocus}
                                                min={0}
                                                step={1}
                                                bigstep={5}
                                                disabled={this.props.disabled}
                                                size="column-3" />
                                        </div>
                                        <Gutter />
                                        <div className="compact-stats__body__column">
                                            <Label
                                                title={strings.TOOLTIPS.SET_STROKE_ALIGNMENT}
                                                size="column-4">
                                                {strings.STYLE.STROKE.ALIGNMENT}
                                            </Label>
                                            <StrokeAlignment
                                                {...this.props}
                                                layers={this.state.layers}
                                                alignments={stroke.alignments}/>
                                        </div>
                                    </div>
                                </ColorInput>
                                <Gutter />
                                <ToggleButton
                                    title={strings.TOOLTIPS.TOGGLE_STROKE}
                                    name="toggleStrokeEnabled"
                                    buttonType={"layer-not-visible"}
                                    selected={stroke.enabledFlags}
                                    selectedButtonType={"layer-visible"}
                                    onClick={!this.props.disabled ? this._toggleStrokeEnabled : _.noop}
                                    size="column-2"
                                />
                                <Gutter />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    });

    module.exports = Stroke;
});
