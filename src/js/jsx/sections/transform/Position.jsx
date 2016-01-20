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
        Immutable = require("immutable");
        
    var Gutter = require("js/jsx/shared/Gutter"),
        Label = require("js/jsx/shared/Label"),
        NumberInput = require("js/jsx/shared/NumberInput"),
        CoalesceMixin = require("js/jsx/mixin/Coalesce"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection"),
        uiUtil = require("js/util/ui");

    var MAX_LAYER_POS = 32000,
        MIN_LAYER_POS = -32000;

    var Position = React.createClass({
        mixins: [FluxMixin, CoalesceMixin],
        propTypes: {
            referencePoint: React.PropTypes.string.isRequired
        },

        getDefaultProps: function () {
            return {
                referencePoint: "lt"
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return !this.state ||
                this.state.disabled !== nextState.disabled ||
                !Immutable.is(this.state.xValues, nextState.xValues) ||
                !Immutable.is(this.state.yValues, nextState.yValues) ||
                !Immutable.is(this.state.absoluteXValues, nextState.absoluteXValues) ||
                !Immutable.is(this.state.absoluteYValues, nextState.absoluteYValues);
        },

        componentWillReceiveProps: function (nextProps) {
            var getSelectedChildBounds = function (props) {
                return props.document.layers.selectedRelativeChildBounds;
            };

            var getRelevantProps = function (props) {
                var layers = props.document.layers.selected;

                return collection.pluckAll(layers, ["kind", "locked", "isBackground"]);
            };

            if (this.state &&
                this.props.referencePoint === nextProps.referencePoint &&
                Immutable.is(getSelectedChildBounds(this.props), getSelectedChildBounds(nextProps)) &&
                Immutable.is(getRelevantProps(this.props), getRelevantProps(nextProps))) {
                return;
            }

            var document = nextProps.document,
                layers = document.layers.selected,
                bounds = document.layers.selectedRelativeChildBounds,
                absoluteBounds = document.layers.selectedChildBounds,
                disabled = this._disabled(document, layers),
                positionKeys = uiUtil.getPositionKeysByRefPoint(nextProps.referencePoint),
                xValues = collection.pluck(bounds, positionKeys.x),
                yValues = collection.pluck(bounds, positionKeys.y),
                absoluteXValues = collection.pluck(absoluteBounds, positionKeys.x),
                absoluteYValues = collection.pluck(absoluteBounds, positionKeys.y);

            this.setState({
                disabled: disabled,
                xValues: xValues,
                yValues: yValues,
                absoluteXValues: absoluteXValues,
                absoluteYValues: absoluteYValues
            });
        },

        /**
         * Update the current X position of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newX
         */
        _handleXChange: function (event, newX) {
            var document = this.props.document,
                positionObj = {
                    x: newX,
                    relative: true
                };
            
            this.getFlux().actions.transform.setPositionThrottled(document, document.layers.selected,
                positionObj, this.props.referencePoint, { translate: true });
        },

        /**
         * Starts scrubbing by saving current X value
         *
         * @private
         */
        _handleXScrubBegin: function () {
            var currentX = collection.uniformValue(this.state.absoluteXValues);

            this.setState({
                scrubX: currentX
            });

            if (currentX !== null) {
                this.startCoalescing();
            }
        },

        /**
         * Update the X position of the selected layers by scrub amount
         *
         * @private
         * @param {number} deltaX
         */
        _handleXScrub: function (deltaX) {
            if (this.state.scrubX === null) {
                return;
            }

            var newX = this.state.scrubX + deltaX,
                currentX = collection.uniformValue(this.state.absoluteXValues);

            if (newX !== currentX) {
                var document = this.props.document,
                    positionObj = {
                        x: newX
                    };

                this.getFlux().actions.transform.setPositionThrottled(
                    document,
                    document.layers.selected,
                    positionObj,
                    this.props.referencePoint,
                    { coalesce: this.shouldCoalesce() }
                );
            }
        },

        /**
         * Resets the scrub initial X value
         *
         * @private
         */
        _handleXScrubEnd: function () {
            this.setState({
                scrubX: null
            });

            this.stopCoalescing();
        },

        /**
         * Starts scrubbing by saving the current Y value
         *
         * @private
         */
        _handleYScrubBegin: function () {
            var currentY = collection.uniformValue(this.state.absoluteYValues);
            
            this.setState({
                scrubY: currentY
            });

            if (currentY !== null) {
                this.startCoalescing();
            }
        },
        
        /**
         * Updates the Y position of the selected layers by scrub amount
         *
         * @private
         * @param {number} deltaX
         */
        _handleYScrub: function (deltaX) {
            if (this.state.scrubY === null) {
                return;
            }

            var newY = this.state.scrubY + deltaX,
                currentY = collection.uniformValue(this.state.absoluteYValues);

            if (newY !== currentY) {
                var document = this.props.document,
                    positionObj = {
                        y: newY
                    };

                this.getFlux().actions.transform.setPositionThrottled(
                    document,
                    document.layers.selected,
                    positionObj,
                    this.props.referencePoint,
                    { coalesce: this.shouldCoalesce() }
                );
            }
        },

        /**
         * Resets the scrub initial Y value
         *
         * @private
         */
        _handleYScrubEnd: function () {
            this.setState({
                scrubX: null,
                scrubY: null
            });

            this.stopCoalescing();
        },

        /**
         * Update the current Y position of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newY
         */
        _handleYChange: function (event, newY) {
            var document = this.props.document,
                positionObj = {
                    y: newY,
                    relative: true
                };
            
            this.getFlux().actions.transform
                .setPositionThrottled(document, document.layers.selected,
                    positionObj, this.props.referencePoint, { translate: true });
        },

        /**
         * Indicates whether the position input should be disabled
         * TRUE if layers is empty
         * or if either a background or adjustment layer is included
         * or if there is zero-bound layer included
         * or if an empty group is included
         * or if the selection is a mixture of artboards and other layers
         * 
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layers>} layers
         */
        _disabled: function (document, layers) {
            var layerTree = document.layers,
                artboardLayers = layers.filter(function (layer) {
                    return layer.isArtboard;
                });

            return document.unsupported ||
                layers.isEmpty() ||
                layers.some(function (layer) {
                    var childBounds = layerTree.childBounds(layer);

                    return layer.isBackground ||
                        layer.isAdjustment ||
                        (!childBounds || childBounds.empty) ||
                        (!layer.isArtboard && document.layers.isEmptyGroup(layer));
                }) ||
                (artboardLayers.size !== layers.size && artboardLayers.size !== 0);
        },

        render: function () {
            if (!this.state) {
                return null;
            }

            return (
                <div className="control-group__horizontal">
                    <Label
                        title={nls.localize("strings.TOOLTIPS.SET_X_POSITION")}
                        className="label__medium__left-aligned"
                        size="column-1"
                        onScrub={this._handleXScrub}
                        onScrubStart={this._handleXScrubBegin}
                        onScrubEnd={this._handleXScrubEnd}>
                        {nls.localize("strings.TRANSFORM.X")}
                    </Label>
                    <NumberInput
                        disabled={this.state.disabled}
                        value={this.state.xValues}
                        onChange={this._handleXChange}
                        ref="xValue"
                        min={MIN_LAYER_POS}
                        max={MAX_LAYER_POS}
                        size="column-5" />
                    <Gutter
                        size="column-4" />
                    <Label
                        title={nls.localize("strings.TOOLTIPS.SET_Y_POSITION")}
                        className="label__medium__left-aligned"
                        size="column-1"
                        onScrub={this._handleYScrub}
                        onScrubStart={this._handleYScrubBegin}
                        onScrubEnd={this._handleYScrubEnd}>
                        {nls.localize("strings.TRANSFORM.Y")}
                    </Label>
                    <NumberInput
                        disabled={this.state.disabled}
                        value={this.state.yValues}
                        onChange={this._handleYChange}
                        ref="yValue"
                        min={MIN_LAYER_POS}
                        max={MAX_LAYER_POS}
                        size="column-5" />
                </div>
            );
        }
    });

    module.exports = Position;
});
