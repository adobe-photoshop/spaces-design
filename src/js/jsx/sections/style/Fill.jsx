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

    var contentLayerLib = require("adapter/lib/contentLayer");

    var Color = require("js/models/color"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * Fill Component displays information of a single fill for a given layer or 
     * set of layers.
     */
    var Fill = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            return !Immutable.is(this.props.fills, nextProps.fills) ||
                this.props.index !== nextProps.index ||
                this.props.readOnly !== nextProps.readOnly;
        },

        /**
         * Handle the button click event, call the toggleFillEnabled button
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {boolean} isChecked
         */
        _toggleFillEnabled: function (event, isChecked) {
            var bestFill = this.props.fills.find(function (fill) {
                return fill && _.isObject(fill.color);
            });

            this.getFlux().actions.shapes.setFillEnabled(
                this.props.document,
                this.props.layers,
                this.props.index,
                bestFill && bestFill.color || Color.DEFAULT,
                isChecked
            );
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
                .setFillOpacityThrottled(this.props.document, this.props.layers, this.props.index, opacity);
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
                .setFillColorThrottled(this.props.document, this.props.layers, this.props.index, color, coalesce);
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
                .setFillColorThrottled(this.props.document, this.props.layers,
                    this.props.index, color, coalesce, true, true);
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
                    this.props.index, color.opacity, coalesce);
        },

        /**
         * Produce a set of arrays of separate fill display properties, transformed and ready for the sub-components
         *
         * @private
         * @param {Immutable.List.<Fill>} fills
         * @return {object}
         */
        _downsampleFills: function (fills) {
            var colors = fills.map(function (fill) {
                    if (!fill) {
                        return null;
                    }
                    if (fill.type === contentLayerLib.contentTypes.SOLID_COLOR) {
                        return fill.color;
                    } else {
                        return fill.type;
                    }
                }),
                opacityPercentages = collection.pluck(fills, "color")
                    .map(function (color) {
                        return color && color.opacity;
                    }),
                enabledFlags = collection.pluck(fills, "enabled", false);

            return {
                colors: colors,
                opacityPercentages: opacityPercentages,
                enabledFlags: enabledFlags
            };
        },

        render: function () {
            var downsample = this._downsampleFills(this.props.fills);

            var fillClasses = classnames({
                "fill-list__fill": true,
                "fill-list__fill__disabled": this.props.readOnly
            });

            var fillOverlay = function (colorTiny) {
                var fillStyle = {
                    height: "100%",
                    width: "100%"
                };

                if (colorTiny) {
                    fillStyle.backgroundColor = colorTiny.toRgbString();
                }

                return (
                    <div
                        className="fill__preview"
                        style={fillStyle}/>
                );
            };

            var colorInputID = "fill-" + this.props.index + "-" + this.props.document.id;

            return (
                <div className={fillClasses}>
                    <div className="formline">
                        <Gutter />
                        <ColorInput
                            id={colorInputID}
                            className="fill"
                            context={collection.pluck(this.props.layers, "id")}
                            title={strings.TOOLTIPS.SET_FILL_COLOR}
                            editable={!this.props.readOnly}
                            defaultValue={downsample.colors}
                            onChange={this._colorChanged}
                            onColorChange={this._opaqueColorChanged}
                            onAlphaChange={this._alphaChanged}
                            onClick={!this.props.readOnly ? this._toggleColorPicker : _.noop}
                            swatchOverlay={fillOverlay}>

                            <div className="compact-stats__body">
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_FILL_OPACITY}
                                        size="column-4">
                                        {strings.STYLE.FILL.ALPHA}
                                    </Label>
                                    <NumberInput
                                        value={downsample.opacityPercentages}
                                        onChange={this._opacityChanged}
                                        min={0}
                                        max={100}
                                        step={1}
                                        bigstep={10}
                                        disabled={this.props.readOnly}
                                        size="column-3" />
                                </div>
                            </div>
                        </ColorInput>
                        <Gutter />
                        <ToggleButton
                            title={strings.TOOLTIPS.TOGGLE_FILL}
                            name="toggleFillEnabled"
                            buttonType="layer-visibility"
                            selected={downsample.enabledFlags}
                            onClick={!this.props.readOnly ? this._toggleFillEnabled : _.noop}
                            size="column-2"
                        />
                        <Gutter />
                    </div>
                </div>
            );
        }
    });

    /**
     * FillList Component maintains a set of fills components for the selected Layer(s)
     */
    var FillList = React.createClass({
        mixins: [FluxMixin],

        /**
         * Handle a NEW fill
         *
         * @private
         */
        _addFill: function (layers) {
            this.getFlux().actions.shapes.addFill(this.props.document, layers, Color.DEFAULT);
        },

        render: function () {
            var document = this.props.document,
                // We only care about vector layers.  If at least one exists, then this component should render
                layers = document.layers.selected.filter(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                });

            // If there are no vector layers, hide the component
            if (layers.isEmpty()) {
                return null;
            }

            // Group into arrays of fills, by position in each layer
            var fillGroups = collection.zip(collection.pluck(layers, "fills")),
                fillList = fillGroups.map(function (fills, index) {
                    return (
                        <Fill {...this.props}
                            key={index}
                            index={index}
                            readOnly={this.props.disabled}
                            layers={layers}
                            fills={fills} />
                    );
                }, this).toList();

            // Add a "new fill" button if not read only
            var newButton = null;
            if (fillGroups.isEmpty()) {
                newButton = (
                    <Button
                        className="button-plus"
                        onClick = {this._addFill.bind(this, layers)}>
                        <SVGIcon
                            viewbox="0 0 12 12"
                            CSSID="plus" />
                    </Button>
                );
            }
            
            return (
                <div className="fill-list__container">
                    <header className="fill-list__header sub-header">
                        <h3>
                            {strings.STYLE.FILL.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule"/>
                        {newButton}
                    </header>
                    <div className="fill-list__list-container">
                        {fillList}
                    </div>
                </div>
            );
        }
    });

    exports.Fill = Fill;
    exports.FillList = FillList;
});
