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
        _ = require("lodash");

    var Color = require("js/models/color"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        contentLayerLib = require("adapter/lib/contentLayer"),
        strings = require("i18n!nls/strings"),
        synchronization = require("js/util/synchronization"),
        collection = require("js/util/collection");

    /**
     * Stroke Component displays information of a single stroke for a given layer or 
     * set of layers.
     */
    var Stroke = React.createClass({
        mixins: [FluxMixin],

        /**
         * A debounced version of actions.shapes.setStrokeWidth
         * 
         * @type {?function}
         */
        _setWidthDebounced: null,

        /**
         * A debounced version of actions.shapes.setStrokeOpacity
         *
         * @type {?function}
         */
        _setOpacityDebounced: null,

        /**
         * A debounced version of actions.shapes.setStrokeColor
         * 
         * @type {?function}
         */
        _setColorDebounced: null,

        componentWillMount: function() {
            var flux = this.getFlux(),
                setStrokeWidth = flux.actions.shapes.setStrokeWidth,
                setStrokeOpacity = flux.actions.shapes.setStrokeOpacity,
                setStrokeColor = flux.actions.shapes.setStrokeColor;

            this._setWidthDebounced = synchronization.debounce(setStrokeWidth);
            this._setOpacityDebounced = synchronization.debounce(setStrokeOpacity);
            this._setColorDebounced = synchronization.debounce(setStrokeColor);
        },

        /**
         * Handle the button click event, call the toggleStrokeEnabled button
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} isChecked
         */
        _toggleStrokeEnabled: function (event, isChecked) {
            var bestStroke = this.props.strokes.find(function(stroke) {
                return stroke && _.isObject(stroke.color);
            });

            this.getFlux().actions.shapes.setStrokeEnabled(
                this.props.document,
                this.props.index,
                bestStroke && bestStroke.color || Color.DEFAULT,
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
            this._setWidthDebounced(this.props.document, this.props.index, width); 
        },

        /**
         * Handle the change of the stroke opacity
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {number} opacity  of stroke, [0,100]
         */
        _opacityChanged: function (event, opacityPercentage) {
            this._setOpacityDebounced(this.props.document, this.props.index, opacityPercentage);
        },

        /**
         * Handle the change of the stroke color
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {Color} color new stroke color
         */
        _colorChanged: function (color) {
            this._setColorDebounced(this.props.document, this.props.index, color);
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
                enabledFlags = collection.pluck(strokes, "enabled", false);

            return {
                colors: colors,
                widths: widths,
                opacityPercentages: opacityPercentages,
                enabledFlags: enabledFlags
            };
        },

        render: function () {
            var downsample = this._downsampleStrokes(this.props.strokes);

            var strokeClasses = React.addons.classSet({
                "stroke-list__stroke": true,
                "stroke-list__stroke__disabled": this.props.readOnly
            });

            var strokeOverlay = function (colorTiny) {
                var strokeStyle = {
                    width: "100%",
                    height: (collection.uniformValue(downsample.widths) || 0) + "%"
                };

                if (colorTiny) {
                    strokeStyle.backgroundColor = colorTiny.toRgbString();
                }

                return (
                    <div
                        className="stroke__preview"
                        style={strokeStyle}/>
                );
            };

            
            // FIXME: strokeOpacity is not yet implemented
            return (
                <div className={strokeClasses}>
                    <div className="formline">
                        <Gutter />
                        <ColorInput
                            id="stroke"
                            context={collection.pluck(this.props.document.layers.selected, "id")}
                            title={strings.TOOLTIPS.SET_STROKE_COLOR}
                            editable={!this.props.readOnly}
                            defaultValue={downsample.colors}
                            onChange={this._colorChanged}
                            onClick={!this.props.readOnly ? this._toggleColorPicker : _.noop}
                            swatchOverlay={strokeOverlay}>

                            <div className="compact-stats__body">
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_STROKE_OPACITY}
                                        size="column-4">
                                        {strings.STYLE.STROKE.ALPHA}
                                    </Label>
                                    <NumberInput
                                        value={downsample.opacityPercentages}
                                        onChange={this._opacityChanged}
                                        min={0}
                                        max={100}
                                        step={1}
                                        bigstep={10}
                                        disabled={this.props.readOnly || true}
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
                                        value={downsample.widths}
                                        onChange={this._widthChanged}
                                        min={0}
                                        step={1}
                                        bigstep={5}
                                        disabled={this.props.readOnly}
                                        size="column-3" />
                                </div>
                                <Gutter  />
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_STROKE_ALIGNMENT}
                                        size="column-4">
                                        {strings.STYLE.STROKE.ALIGNMENT}
                                    </Label>
                                </div>
                            </div>
                        </ColorInput>
                        <Gutter />
                        <ToggleButton
                            title={strings.TOOLTIPS.TOGGLE_STROKE}
                            name="toggleStrokeEnabled"
                            buttonType="layer-visibility"
                            selected={downsample.enabledFlags}
                            onClick={!this.props.readOnly ? this._toggleStrokeEnabled : _.noop}
                        />
                        <Gutter />
                    </div>
                </div>
            );
        }
    });

    /**
     * StrokeList Component maintains a set of strokes components for the selected Layer(s)
     */
    var StrokeList = React.createClass({
        mixins: [FluxMixin],

        /**
         * Handle a NEW stroke
         *
         * @private
         */
        _addStroke: function () {
            this.getFlux().actions.shapes.addStroke(this.props.document);
        },

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected,
                vectorLayers = layers.filter(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                });

            if (vectorLayers.size === 0) {
                return null;
            }

            // Group into arrays of strokes, by position in each layer
            var strokeGroups = collection.zip(collection.pluck(layers, "strokes"));

            // Check if all layers are vector type
            var onlyVectorLayers = vectorLayers.size === layers.size,
                readOnly = !document || document.layers.selectedLocked,
                strokeList = strokeGroups.map(function (strokes, index) {
                    return (
                        <Stroke {...this.props}
                            key={index}
                            index={index}
                            readOnly={readOnly || !onlyVectorLayers}
                            strokes={strokes} />
                    );
                }, this);

            // Add a "new stroke" button if not read only
            var newButton = null;
            if (!readOnly && strokeGroups.size < 1 && onlyVectorLayers) {
                newButton = (
                    <Button 
                        className="button-plus"
                        onClick = {this._addStroke}>
                        +
                    </Button>
                );
            }
            
            return (
                <div className="stroke-list__container">
                    <header className="stroke-list__header sub-header">
                        <h3>
                            {strings.STYLE.STROKE.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule"/>
                        <Gutter />
                        {newButton}
                    </header>
                    <div className="stroke-list__list-container">
                        {strokeList.toArray()}
                    </div>
                </div>
            );
        }
    });

    exports.Stroke = Stroke;
    exports.StrokeList = StrokeList;
});
