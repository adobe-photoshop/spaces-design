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
        BlendMode = require("jsx!./BlendMode"),
        contentLayerLib = require("adapter/lib/contentLayer"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection"),
        synchronization = require("js/util/synchronization");

    /**
     * Fill Component displays information of a single fill for a given layer or 
     * set of layers.
     */
    var Fill = React.createClass({
        mixins: [FluxMixin],

        /**
         * A debounced version of actions.shapes.setFillOpacity
         * 
         * @type {?function}
         */
        _setOpacityDebounced: null,

        /**
         * A debounced version of actions.shapes.setFillColor
         * 
         * @type {?function}
         */
        _setColorDebounced: null,

        componentWillMount: function() {
            var flux = this.getFlux(),
                setFillOpacity = flux.actions.shapes.setFillOpacity,
                setFillColor = flux.actions.shapes.setFillColor;

            this._setOpacityDebounced = synchronization.debounce(setFillOpacity);
            this._setColorDebounced = synchronization.debounce(setFillColor);
        },

        /**
         * Handle the button click event, call the toggleFillEnabled button
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {boolean} isChecked
         */
        _toggleFillEnabled: function (event, isChecked) {
            var bestFill = this.props.fills.find(function(fill) {
                return fill && _.isObject(fill.color);
            });

            this.getFlux().actions.shapes.setFillEnabled(
                this.props.document,
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
        _opacityChanged: function (event, opacityPercentage) {
            this._setOpacityDebounced(this.props.document, this.props.index, opacityPercentage); 
        },

        /**
         * Handle the change of the fill color
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {Color} color new fill color
         */
        _colorChanged: function (color) {
            this._setColorDebounced(this.props.document, this.props.index, color);
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

            var fillClasses = React.addons.classSet({
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

            return (
                <div className={fillClasses}>
                    <div className="formline">
                        <Gutter />
                        <ColorInput
                            id="fill"
                            context={collection.pluck(this.props.document.layers.selected, "id")}
                            title={strings.TOOLTIPS.SET_FILL_COLOR}
                            editable={!this.props.readOnly}
                            defaultValue={downsample.colors}
                            onChange={this._colorChanged}
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
                                <Gutter />
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_FILL_BLENDING}
                                        size="column-5">
                                        {strings.STYLE.FILL.BLENDING}
                                    </Label>
                                    <BlendMode id="fill"/>
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
        _addFill: function () {
            this.getFlux().actions.shapes.addFill(this.props.document, Color.DEFAULT);
        },

        render: function () {
            var activeDocument = this.props.document,
                activeLayers = activeDocument.layers.selected,
                vectorLayers = activeLayers.filter(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                });

            // If there are no vector layers, hide the component
            if (vectorLayers.size === 0) {
                return null;
            }

            // Group into arrays of fills, by position in each layer
            var fillGroups = collection.zip(collection.pluck(activeLayers, "fills"));

            // Check if all layers are vector kind
            var onlyVectorLayers = vectorLayers.size === activeLayers.size,
                readOnly = !activeDocument || activeDocument.layers.selectedLocked,
                fillList = fillGroups.map(function (fills, index) {
                    return (
                        <Fill {...this.props}
                            key={index}
                            index={index}
                            readOnly={readOnly || !onlyVectorLayers}
                            fills={fills} />
                    );
                }, this);

            // Add a "new fill" button if not read only
            var newButton = null;
            if (!readOnly && fillGroups.size < 1 && onlyVectorLayers) {
                newButton = (
                    <Button 
                        className="button-plus"
                        onClick = {this._addFill}>
                        +
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
                        <Gutter />
                        {newButton}
                    </header>
                    <div className="fill-list__list-container">
                        {fillList.toArray()}
                    </div>
                </div>
            );
        }
    });

    exports.Fill = Fill;
    exports.FillList = FillList;
});
