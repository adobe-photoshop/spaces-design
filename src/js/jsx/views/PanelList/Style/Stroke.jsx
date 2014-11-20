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
        StoreWatchMixin  = Fluxxor.StoreWatchMixin;

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        tinycolor = require("tinycolor"),
        synchronization = require("js/util/synchronization"),
        _ = require("lodash");

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

        componentWillMount: function() {
            var flux = this.getFlux(),
                setStrokeWidth = flux.actions.shapes.setStrokeWidth;

            this._setWidthDebounced = synchronization.debounce(setStrokeWidth);
        },

        /**
         * Handle the button click event, call the toggleStrokeEnabled button
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {boolean} isChecked
         */
        _toggleStrokeEnabled: function (event, isChecked) {
            this.getFlux().actions.shapes.toggleStrokeEnabled(
                this.props.activeDocument,
                this.props.index,
                this.props.strokes[0],
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
            this._setWidthDebounced(this.props.activeDocument, this.props.index, width); 
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
            this.getFlux().actions.shapes.setStrokeColor(this.props.activeDocument, this.props.index, color); 
        },

        /**
         * Produce a unified stroke representation from a set of strokes
         * If all the strokes are equivalent, return a representative stroke
         * Else return a synthetic "mixed" stroke
         *
         * @private
         * @param {Array.<Stroke>} strokes
         * @return {Stroke}
         */
        _downsampleStrokes: function (strokes) {
            if (_.size(strokes) === 1) {
                return strokes[0];
            } else if (_.size(strokes) > 1) {
                var firstStroke = strokes[0];

                // Test that all all other strokes are equivalent  
                var similarStrokes = firstStroke &&
                        _.every(strokes, function (stroke) {
                            return stroke && firstStroke.equals(stroke);
                        });
                
                // Set strokes to "mixed" or use the first if they're all the same
                if (similarStrokes) {
                    return strokes[0];
                } else {
                    return {
                        enabled: false,
                        color: null,
                        width: null,
                        mixed: true
                    };
                }
            } else {
                throw new Error ("Bad stroke data provided");
            }
        },

        render: function () {
            var stroke = this._downsampleStrokes(this.props.strokes),
                // readOnly override if mixed
                readOnly = stroke.mixed || this.props.readOnly;

            var strokeClasses = React.addons.classSet({
                "stroke-list__stroke": true,
                "stroke-list__stroke__disabled": readOnly
            });

            if (stroke.mixed) {
                return (
                    <div className={strokeClasses}>
                        <ul>
                            <li className="formline">
                                <ToggleButton
                                    name="toggleStrokeEnabled"
                                    selected={stroke.enabled}
                                    onClick={!readOnly ? this._toggleStrokeEnabled : _.noop}
                                />
                                <Label>
                                    {strings.TRANSFORM.MIXED}
                                </Label>
                            </li>
                        </ul>
                    </div>
                );
            } else {
                // round the width to two decimals
                var widthRounded = stroke.mixed ? strings.TRANSFORM.MIXED : Math.ceil(stroke.width * 100)/100,
                    // display a label for non-solidColor strokes
                    strokeLabel = stroke.type === stroke.contentTypes.SOLID_COLOR ? null : stroke.type;
                return (
                    <div className={strokeClasses}>
                        <ul>
                            <li className="formline">
                                <ToggleButton
                                    name="toggleStrokeEnabled"
                                    selected={stroke.enabled}
                                    onClick={!readOnly ? this._toggleStrokeEnabled : _.noop}
                                />
                                <Gutter />
                                <ColorInput
                                    editable={!readOnly}
                                    defaultColor={stroke.color}
                                    defaultText={strokeLabel}
                                    onChange={this._colorChanged}
                                />
                                <Gutter />
                                <Label size="c-3-25">
                                    width
                                </Label>
                                <Gutter />
                                <NumberInput
                                    value={widthRounded}
                                    onChange={this._widthChanged}
                                    step={1}
                                    bigstep={5}
                                    disabled={readOnly}
                                />
                                <Gutter />
                                <Gutter />
                                <ToggleButton
                                    buttonType="toggle-trash"
                                />
                            </li>
                        </ul>
                    </div>
                );
            }
        }
    });

    /**
     * StrokeList Component maintains a set of strokes components for the selected Layer(s)
     */
    var StrokeList = React.createClass({

        mixins: [FluxMixin, StoreWatchMixin ("stroke", "layer", "document", "application")],

        /**
         * Get the active document selected layers and strokes from flux,
         * ready the strokes for view
         */
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                activeDocument = flux.store("application").getCurrentDocument(),
                activeLayers = activeDocument ? activeDocument.getSelectedLayers() : [],
                readOnly = activeDocument ? activeDocument.selectedLayersLocked() : true;

            // Group into arrays of strokes, by position in each layer
            var strokeGroups = _.zip(_.pluck(activeLayers, "strokes"));

            // Check if all layers are vector type
            var vectorType = activeLayers.length > 0 ? activeLayers[0].layerKinds.VECTOR : null,
                onlyVectorLayers = _.every(activeLayers, {kind: vectorType});    
            
            return {
                activeDocument: activeDocument,
                strokeGroups: strokeGroups,
                readOnly: readOnly,
                onlyVectorLayers: onlyVectorLayers
            };
        },

        /**
         * Handle a NEW stroke
         *
         * @private
         */
        _addStroke: function () {
            this.getFlux().actions.shapes.addStroke(this.state.activeDocument);
        },

        render: function () {
            //short circuit when no active document
            if (!this.state.activeDocument) {
                return null;
            }

            var strokeList = _.map(this.state.strokeGroups, function (strokes, index) {
                return (
                    <Stroke 
                        key={index}
                        index={index}
                        readOnly={this.state.readOnly} 
                        strokes={strokes}
                        activeDocument={this.state.activeDocument} />
                );
            }, this);

            // Add a "new stroke" button if not read only
            var newButton = null;
            if (!this.state.readOnly && _.size(this.state.strokeGroups) < 1 && this.state.onlyVectorLayers) {
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
                    <div className="stroke-list__list-container"> {strokeList} </div>
                </div>
            );
        }
    });

    module.exports.Stroke = Stroke;
    module.exports.StrokeList = StrokeList;
});
