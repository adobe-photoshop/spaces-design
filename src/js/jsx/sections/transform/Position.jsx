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
        
    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection"),
        uiUtil = require("js/util/ui");

    var MAX_LAYER_POS = 32000,
        MIN_LAYER_POS = -32000;

    var Position = React.createClass({
        mixins: [FluxMixin],
        propTypes: {
            referencePoint: React.PropTypes.string.isRequired
        },

        /**
         *@private variables for storing inital srub value to determine correct offset.
         */
        _xScrubbyValue: null,
        _yScrubbyValue: null,

        getDefaultProps: function () {
            return {
                referencePoint: "lt"
            };
        },

        shouldComponentUpdate: function (nextProps) {
            var getSelectedChildBounds = function (props) {
                return props.document.layers.selectedRelativeChildBounds;
            };

            var getRelevantProps = function (props) {
                var layers = props.document.layers.selected;

                return collection.pluckAll(layers, ["kind", "locked", "isBackground"]);
            };

            return this.props.referencePoint !== nextProps.referencePoint ||
                !Immutable.is(getSelectedChildBounds(this.props), getSelectedChildBounds(nextProps)) ||
                !Immutable.is(getRelevantProps(this.props), getRelevantProps(nextProps));
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
                positionObj, this.props.referencePoint);
        },

        /**
         * Update the current X position of the selected layers.
         *
         * @private
         */
        _handleXScrubBegin: function () {
            var document = this.props.document,
                bounds = document.layers.selectedRelativeChildBounds,
                positionKeys = uiUtil.getPositionKeysByRefPoint(this.props.referencePoint),
                xValues = collection.pluck(bounds, positionKeys.x),
                value = collection.uniformValue(xValues);

            this._xScrubbyValue = value;
        },

        /**
         * Update the current X position of the selected layers.
         *
         * @private
         * @param {number} newX
         */
        _handleXScrub: function (newX) {
            if (_.isNumber(this._xScrubbyValue)) {
                var document = this.props.document,
                    uiStore = this.getFlux().store("ui"),
                    resolution = document.resolution,
                    positionObj = {
                        x: (uiStore.zoomCanvasToWindow(newX * resolution) / resolution) + this._xScrubbyValue,
                        relative: true
                    };

                    
                this.getFlux().actions.transform.setPositionThrottled(document, document.layers.selected,
                    positionObj, this.props.referencePoint);
            }
        },

        /**
         * Update the current X position of the selected layers.
         *
         * @private
         */
        _handleYScrubBegin: function () {
            var document = this.props.document,
                bounds = document.layers.selectedRelativeChildBounds,
                positionKeys = uiUtil.getPositionKeysByRefPoint(this.props.referencePoint),
                yValues = collection.pluck(bounds, positionKeys.y),
                value = collection.uniformValue(yValues);

            this._yScrubbyValue = value;
        },
        /**
         * Update the current X position of the selected layers.
         *
         * @private
         * @param {number} newY
         */
        _handleYScrub: function (newY) {
            if (_.isNumber(this._yScrubbyValue)) {
                var document = this.props.document,
                    uiStore = this.getFlux().store("ui"),
                    resolution = document.resolution,
                    positionObj = {
                        y: (uiStore.zoomCanvasToWindow(newY * resolution) / resolution) + this._yScrubbyValue,
                        relative: true
                    };

                this.getFlux().actions.transform.setPositionThrottled(document, document.layers.selected,
                    positionObj, this.props.referencePoint);
            }
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
                    positionObj, this.props.referencePoint);
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
                        layer.kind === layer.layerKinds.ADJUSTMENT ||
                        (!childBounds || childBounds.empty) ||
                        (!layer.isArtboard && document.layers.isEmptyGroup(layer));
                }) ||
                (artboardLayers.size !== layers.size && artboardLayers.size !== 0);
        },

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected,
                bounds = document.layers.selectedRelativeChildBounds;

            var disabled = this._disabled(document, layers),
                positionKeys = uiUtil.getPositionKeysByRefPoint(this.props.referencePoint),
                xValues = collection.pluck(bounds, positionKeys.x),
                yValues = collection.pluck(bounds, positionKeys.y);

            return (
                <div className="control-group__horizontal">
                    <Label
                        title={nls.localize("strings.TOOLTIPS.SET_X_POSITION")}
                        className="label__medium__left-aligned"
                        size="column-1"
                        onScrub={this._handleXScrub}
                        onScrubStart={this._handleXScrubBegin}>
                        {nls.localize("strings.TRANSFORM.X")}
                    </Label>
                    <NumberInput
                        disabled={disabled}
                        value={xValues}
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
                        onScrubStart={this._handleYScrubBegin}>
                        {nls.localize("strings.TRANSFORM.Y")}
                    </Label>
                    <NumberInput
                        disabled={disabled}
                        value={yValues}
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
