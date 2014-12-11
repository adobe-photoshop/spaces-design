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
        synchronization = require("js/util/synchronization"),
        _ = require("lodash");

    /**
     * Return a default color object for new strokes
     *
     * @private
     * @return {Color}
     */
    var _getDefaultColor = function() {
        return {r: 0, g: 0, b: 0, a: 1};
    };        

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
         * A debounced version of actions.shapes.setStrokeColor
         * 
         * @type {?function}
         */
        _setColorDebounced: null,

        componentWillMount: function() {
            var flux = this.getFlux(),
                setStrokeWidth = flux.actions.shapes.setStrokeWidth,
                setStrokeColor = flux.actions.shapes.setStrokeColor;

            this._setWidthDebounced = synchronization.debounce(setStrokeWidth);
            this._setColorDebounced = synchronization.debounce(setStrokeColor);
        },

        /**
         * Handle the button click event, call the toggleStrokeEnabled button
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {boolean} isChecked
         */
        _toggleStrokeEnabled: function (event, isChecked) {
            var bestStroke = _.find(this.props.strokes, function(stroke) {
                return stroke && _.isObject(stroke.color);
            });

            this.getFlux().actions.shapes.setStrokeEnabled(
                this.props.document,
                this.props.index,
                bestStroke && bestStroke.color || _getDefaultColor(),
                isChecked
            );
        },

        /**
         * Handle the change of the stroke width
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {number} width width of stroke, in pixels
         */
        _widthChanged: function (event, width) {
            this._setWidthDebounced(this.props.document, this.props.index, width); 
        },

        /**
         * Handle the change of the stroke color
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {Color} color new stroke color
         */
        _colorChanged: function (event, colorText) {
            var color = tinycolor(colorText).toRgb();
            this._setColorDebounced(this.props.document, this.props.index, color);
        },

        /**
         * Produce a set of arrays of separate stroke display properties, transformed and ready for the sub-components
         *
         * @private
         * @param {Array.<Stroke>} strokes
         * @return {Stroke}
         */
        _downsampleStrokes: function (strokes) {
            if (_.size(strokes) === 0) {
                return {};
            }
            return strokes.reduce(function (downsample, stroke) {
                    if (!_.isEmpty(stroke)) {
                        downsample.colors.push(stroke.color);
                        downsample.labels.push(stroke.type !== contentLayerLib.contentTypes.SOLID_COLOR ?
                            stroke.type :
                            null);
                        downsample.widthArray.push(Math.ceil(stroke.width * 100)/100);
                        downsample.enabledArray.push(stroke.enabled);
                    } else {
                        downsample.colors.push(null);
                        downsample.labels.push(null);
                        downsample.widthArray.push(null);
                        downsample.enabledArray.push(false);
                    }
                    return downsample;
                },
                {
                    colors : [],
                    labels : [],
                    widthArray : [],
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
            var downsample = this._downsampleStrokes(this.props.strokes);

            var strokeClasses = React.addons.classSet({
                "stroke-list__stroke": true,
                "stroke-list__stroke__disabled": this.props.readOnly
            });

            return (
                <div className={strokeClasses}>
                    <ul>
                        <li className="formline">
                            <Gutter />
                            <ColorInput
                                title={strings.TOOLTIPS.SET_STROKE_COLOR}
                                editable={!this.props.readOnly}
                                defaultColor={downsample.colors}
                                defaultText={downsample.labels}
                                onChange={this._colorChanged}
                                onClick={!this.props.readOnly ? this._toggleColorPicker : _.noop}
                            />
                            <Dialog ref="dialog"
                                id="colorpicker-stroke"
                                dismissOnDocumentChange
                                dismissOnSelectionTypeChange
                                dismissOnWindowClick>
                                <ColorPicker
                                    color={downsample.colors[0] || _getDefaultColor()}
                                    onChange={this._colorChanged.bind(this, null)} />
                            </Dialog>
                            <Label 
                                title={strings.TOOLTIPS.SET_STROKE_SIZE}
                                size="column-2">
                                {strings.STYLE.STROKE.SIZE}
                            </Label>
                            <Gutter />
                            <NumberInput
                                value={downsample.widthArray}
                                onChange={this._widthChanged}
                                min={0}
                                step={1}
                                bigstep={5}
                                disabled={this.props.readOnly}
                                size="column-3"
                            />
                            <Gutter />
                            <ToggleButton
                                title={strings.TOOLTIPS.TOGGLE_STROKE}
                                name="toggleStrokeEnabled"
                                selected={downsample.enabledArray}
                                onClick={!this.props.readOnly ? this._toggleStrokeEnabled : _.noop}
                            />
                            <Gutter />
                        </li>
                    </ul>
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
            //short circuit when no active document
            if (!this.props.document) {
                return null;
            }

            var activeDocument = this.props.document,
                activeLayers = this.props.layers,
                readOnly = activeDocument ? activeDocument.selectedLayersLocked() : true;

            // Group into arrays of strokes, by position in each layer
            var strokeGroups = _.zip(_.pluck(activeLayers, "strokes"));

            // Check if all layers are vector type
            var vectorType = activeLayers.length > 0 ? activeLayers[0].layerKinds.VECTOR : null,
                onlyVectorLayers = _.every(activeLayers, {kind: vectorType});    
            
            var strokeList = _.map(strokeGroups, function (strokes, index) {
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
            if (!readOnly && _.size(strokeGroups) < 1 && onlyVectorLayers) {
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
                        {newButton}
                    </header>
                    <div className="stroke-list__list-container">
                        {strokeList}
                    </div>
                </div>
            );
        }
    });

    module.exports.Stroke = Stroke;
    module.exports.StrokeList = StrokeList;
});
