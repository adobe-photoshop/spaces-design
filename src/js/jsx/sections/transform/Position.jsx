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
        
    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    var MAX_LAYER_POS = 32000,
        MIN_LAYER_POS = -32000;

    var Position = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            var getSelectedChildBounds = function (props) {
                return props.document.layers.selectedChildBounds;
            };

            var getRelevantProps = function (props) {
                var layers = props.document.layers.selected;

                return collection.pluckAll(layers, ["kind", "locked", "isBackground"]);
            };

            return !Immutable.is(getSelectedChildBounds(this.props), getSelectedChildBounds(nextProps)) ||
                !Immutable.is(getRelevantProps(this.props), getRelevantProps(nextProps));
        },

        /**
         * Update the left position of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newX
         */
        _handleLeftChange: function (event, newX) {
            var document = this.props.document;
            
            this.getFlux().actions.transform
                .setPositionThrottled(document, document.layers.selected, { x: newX });
        },

        /**
         * Update the top position of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newY
         */
        _handleTopChange: function (event, newY) {
            var document = this.props.document;
            
            this.getFlux().actions.transform
                .setPositionThrottled(document, document.layers.selected, { y: newY });
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
                bounds = document.layers.selectedChildBounds;

            var disabled = this._disabled(document, layers),
                tops = collection.pluck(bounds, "top"),
                lefts = collection.pluck(bounds, "left");

            return (
                <div className="formline">
                    <Label
                        title={strings.TOOLTIPS.SET_X_POSITION}>
                        {strings.TRANSFORM.X}
                    </Label>
                    <Gutter />
                    <NumberInput
                        disabled={disabled}
                        value={lefts}
                        onChange={this._handleLeftChange}
                        ref="left"
                        min={MIN_LAYER_POS}
                        max={MAX_LAYER_POS}
                        size="column-5" />
                    <Gutter
                        size="column-4" />
                    <Label
                        title={strings.TOOLTIPS.SET_Y_POSITION}
                        size="column-1">
                        {strings.TRANSFORM.Y}
                    </Label>
                    <Gutter />
                    <NumberInput
                        disabled={disabled}
                        value={tops}
                        onChange={this._handleTopChange}
                        ref="top"
                        min={MIN_LAYER_POS}
                        max={MAX_LAYER_POS}
                        size="column-5" />
                    <Gutter />
                </div>
            );
        }
    });

    module.exports = Position;
});
