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
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    var MAX_LAYER_SIZE = 32000,
        MIN_LAYER_SIZE = 0.1;

    var Size = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            var getSelectedChildBounds = function (props) {
                return props.document.layers.selectedChildBounds;
            };

            var getRelevantProps = function (props) {
                var layers = props.document.layers.selected;
                return collection.pluckAll(layers, ["kind", "locked", "isBackground", "proportionalScaling"]);
            };

            var getBounds = function (props) {
                return props.document.bounds;
            };

            return !Immutable.is(getBounds(this.props), getBounds(nextProps)) ||
                !Immutable.is(getSelectedChildBounds(this.props), getSelectedChildBounds(nextProps)) ||
                !Immutable.is(getRelevantProps(this.props), getRelevantProps(nextProps));
        },

        /**
         * Update the width of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newWidth
         */
        _handleWidthChange: function (event, newWidth) {
            var document = this.props.document;
            
            this.getFlux().actions.transform
                .setSizeThrottled(document, document.layers.selected, { w: newWidth });
        },

        /**
         * Update the height of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newHeight
         */
        _handleHeightChange: function (event, newHeight) {
            var document = this.props.document;
            
            this.getFlux().actions.transform
                .setSizeThrottled(document, document.layers.selected, { h: newHeight });
        },

        /**
         * Update the proportional transformation lock 
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {bool} proportional
         */
        _handleProportionChange: function (event, proportional) {
            var document = this.props.document;
            
            this.getFlux().actions.layers
                .setProportional(document, document.layers.selected, proportional);
        },

        /**
         * Indicates whether the size input should be disabled
         * TRUE if layers is non-empty while the boundsShown is empty
         * or if layers are empty and the document has Artboards
         * or if either a background, adjustment or text layer is included
         * or if there is zero-bound layer included
         * or if an empty group is included
         * or if the selection is a mixture of artboards and other layers
         * 
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layers>} layers
         * @param {Immutable.List.<Bounds>} boundsShown
         * @return {boolean}
         */
        _disabled: function (document, layers, boundsShown) {
            var layerTree = document.layers,
                artboardLayers = layers.filter(function (layer) {
                    return layer.isArtboard;
                });

            return document.unsupported ||
                (layers.isEmpty() && document.layers.hasArtboard) ||
                (!layers.isEmpty() && boundsShown.isEmpty()) ||
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
                documentBounds = document.bounds,
                layers = document.layers.selected,
                boundsShown = document.layers.selectedChildBounds,
                proportionalToggle = null,
                hasArtboard = document.layers.hasArtboard,
                disabled = this._disabled(document, layers, boundsShown),
                proportional = layers.map(function (layer) {
                    return layer.proportionalScaling;
                });
            
            // document resizing
            if (layers.isEmpty() || disabled) {
                if (!disabled) {
                    boundsShown = documentBounds && !hasArtboard ?
                        Immutable.List.of(documentBounds) :
                        boundsShown;
                }
                
                proportionalToggle = (
                    <Gutter
                        size="column-4" />
                );
            } else {
                var connectedClass = "toggle-connected",
                    disconnectedClass = "toggle-disconnected";
                
                proportionalToggle = (
                    <ToggleButton
                        size="column-4"
                        buttonType={disconnectedClass}
                        title={strings.TOOLTIPS.LOCK_PROPORTIONAL_TRANSFORM}
                        selected={proportional}
                        selectedButtonType = {connectedClass}
                        onClick={this._handleProportionChange} />
                );
            }

            var widths = collection.pluck(boundsShown, "width"),
                heights = collection.pluck(boundsShown, "height");

            return (
                <div className="formline">
                    <Label
                        title={strings.TOOLTIPS.SET_WIDTH}
                        className="label__medium__left-aligned"
                        size="column-1">
                        {strings.TRANSFORM.W}
                    </Label>
                    <NumberInput
                        disabled={disabled}
                        value={widths}
                        onChange={this._handleWidthChange}
                        ref="width"
                        min={MIN_LAYER_SIZE}
                        max={MAX_LAYER_SIZE}
                        size="column-5" />
                    {proportionalToggle}
                    <Label
                        size="column-1"
                        className="label__medium__left-aligned"
                        title={strings.TOOLTIPS.SET_HEIGHT}>
                        {strings.TRANSFORM.H}
                    </Label>
                    <div className="column-6">
                    <NumberInput
                        value={heights}
                        disabled={disabled}
                        onChange={this._handleHeightChange}
                        ref="height"
                        min={MIN_LAYER_SIZE}
                        max={MAX_LAYER_SIZE}
                        size="column-5" />
                    </div>
                </div>
            );
        }
    });

    module.exports = Size;
});
