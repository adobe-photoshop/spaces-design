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
        FluxMixin = Fluxxor.FluxMixin(React);

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        ColorPicker = require("jsx!js/jsx/shared/ColorPicker"),
        contentLayerLib = require("adapter/lib/contentLayer"),
        strings = require("i18n!nls/strings"),
        tinycolor = require("tinycolor"),
        mathjs = require("mathjs"),
        synchronization = require("js/util/synchronization"),
        _ = require("lodash");

    /**
     * Return a default color object for new fills
     *
     * @private
     * @return {Color}
     */
    var _getDefaultColor = function() {
        return {r: 0, g: 0, b: 0, a: 1};
    };

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
            var bestFill = _.find(this.props.fills, function(fill) {
                return fill && _.isObject(fill.color);
            });

            this.getFlux().actions.shapes.setFillEnabled(
                this.props.document,
                this.props.index,
                bestFill && bestFill.color || _getDefaultColor(),
                isChecked
            );
        },

        /**
         * Handle the change of the fill width
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {number} opacity opacity of fill, [0,1]
         */
        _opacityChanged: function (event, opacityPercentage) {
            this._setOpacityDebounced(this.props.document, this.props.index, opacityPercentage / 100); 
        },

        /**
         * Handle the change of the fill color
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {Color} color new fill color
         */
        _colorChanged: function (event, colorText) {
            var color = tinycolor(colorText).toRgb();
            this._setColorDebounced(this.props.document, this.props.index, color);
        },

        /**
         * Produce a set of arrays of separate fill display properties, transformed and ready for the sub-components
         *
         * @private
         * @param {Array.<Fill>} fills
         * @return {object}
         */
        _downsampleFills: function (fills) {
            if (_.size(fills) === 0) {
                return {};
            }
            return fills.reduce(function (downsample, fill) {
                    if (!_.isEmpty(fill)) {
                        downsample.colors.push(fill.color);
                        downsample.labels.push(fill.type !== contentLayerLib.contentTypes.SOLID_COLOR ?
                            fill.type : null);
                        downsample.opacityPercentages.push(_.isNumber(fill.opacity) ?
                            mathjs.round(fill.opacity * 100, 0) : null);
                        downsample.enabledArray.push(fill.enabled);
                    } else {
                        downsample.colors.push(null);
                        downsample.labels.push(null);
                        downsample.opacityPercentages.push(null);
                        downsample.enabledArray.push(false);
                    }
                    return downsample;
                },
                {
                    colors : [],
                    labels : [],
                    opacityPercentages : [],
                    enabledArray : []
                }
            );
        },

        /**
         * Toggle the color picker dialog on click.
         *
         * @param {SyntheticEvent} event
         */
        _toggleColorPicker: function (event) {
            this.refs.dialog.toggle(event);
        },

        render: function () {
            var downsample = this._downsampleFills(this.props.fills);

            var fillClasses = React.addons.classSet({
                "fill-list__fill": true,
                "fill-list__fill__disabled": this.props.readOnly
            });

            return (
                <div className={fillClasses}>
                    <ul>
                        <li className="formline">
                            <Gutter />
                            <ColorInput
                                title={strings.TOOLTIPS.SET_FILL_COLOR}
                                editable={!this.props.readOnly}
                                defaultColor={downsample.colors}
                                defaultText={downsample.labels}
                                onChange={this._colorChanged}
                                onClick={!this.props.readOnly ? this._toggleColorPicker : _.noop}
                            />
                            <Dialog ref="dialog"
                                id="colorpicker-fill"
                                dismissOnDocumentChange
                                dismissOnSelectionTypeChange
                                dismissOnWindowClick>
                                <ColorPicker
                                    color={downsample.colors[0] || _getDefaultColor()}
                                    onChange={this._colorChanged.bind(this, null)} />
                            </Dialog>
                            <Label
                                title={strings.TOOLTIPS.SET_FILL_OPACITY}
                                size="column-2">
                                {strings.STYLE.FILL.ALPHA}
                            </Label>
                            <Gutter />
                            <NumberInput
                                value={downsample.opacityPercentages}
                                onChange={this._opacityChanged}
                                min={0}
                                max={100}
                                step={1}
                                bigstep={10}
                                disabled={this.props.readOnly}
                                size="column-3"
                            />
                            <Gutter />
                            <ToggleButton
                                title={strings.TOOLTIPS.TOGGLE_FILL}
                                name="toggleFillEnabled"
                                selected={downsample.enabledArray}
                                onClick={!this.props.readOnly ? this._toggleFillEnabled : _.noop}
                            />
                            <Gutter />
                        </li>
                    </ul>
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
            this.getFlux().actions.shapes.addFill(this.props.document);
        },

        render: function () {
            //short circuit when no active document
            if (!this.props.document) {
                return null;
            }

            var activeDocument = this.props.document,
                activeLayers = this.props.layers,
                readOnly = activeDocument ? activeDocument.selectedLayersLocked() : true;

            // Group into arrays of fills, by position in each layer
            var fillGroups = _.zip(_.pluck(activeLayers, "fills"));

            // Check if all layers are vector type
            var vectorType = activeLayers.length > 0 ? activeLayers[0].layerKinds.VECTOR : null,
                onlyVectorLayers = _.every(activeLayers, {kind: vectorType});    
            
            var fillList = _.map(fillGroups, function (fills, index) {
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
            if (!readOnly && _.size(fillGroups) < 1 && onlyVectorLayers) {
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
                        {newButton}
                    </header>
                    <div className="fill-list__list-container">
                        {fillList}
                    </div>
                </div>
            );
        }
    });

    module.exports.Fill = Fill;
    module.exports.FillList = FillList;
});
