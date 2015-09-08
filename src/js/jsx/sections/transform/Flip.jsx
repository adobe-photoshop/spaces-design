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

    var SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings");

    var Flip = React.createClass({
        mixins: [FluxMixin],
        
        propTypes: {
            document: React.PropTypes.object,
            layers: React.PropTypes.arrayOf(React.PropTypes.object)
        },

        getInitialState: function () {
            return {
                flipDisabled: true,
                swapDisabled: true
            };
        },

        componentWillReceiveProps: function (nextProps) {
            var document = nextProps.document,
                layers = document.layers.selected,
                layersNormalized = document.layers.selectedNormalized,
                flipDisabled = this._flipDisabled(document, layers),
                swapDisabled = this._swapDisabled(document, layersNormalized);

            if (this.state.flipDisabled !== flipDisabled ||
                this.state.swapDisabled !== swapDisabled) {
                this.setState({
                    flipDisabled: flipDisabled,
                    swapDisabled: swapDisabled
                });
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return this.state.flipDisabled !== nextState.flipDisabled ||
                this.state.swapDisabled !== nextState.swapDisabled;
        },

        /**
         * Flips the layer horizontally
         * 
         * @private
         */
        _flipX: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.flipX(document, layers);
        },
        
        /**
         * Flips the layer vertically
         * 
         * @private
         */
        _flipY: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.flipY(document, layers);
        },

        /**
         * Swaps the two selected layers
         * We use the current document version of the action
         * because clicking swap fast too many times will cause old doc model to be used
         * 
         * @private
         */
        _swapLayers: function () {
            this.getFlux().actions.transform.swapLayersCurrentDocument();
        },

        /**
         * Determine if flip operations should be disabled for a given set of layers.
         * TRUE If layers is empty
         * or if either a background or adjustment layer is included
         * (note that adjustment layers are kind of OK, but seem to have subtle issues with bounds afterwards)
         * or if ALL layers are empty groups
         * or if any layers are artboards
         *
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layer>} layers
         * @return {boolean}
         */
        _flipDisabled: function (document, layers) {
            var layerTree = document.layers;
            
            return document.unsupported ||
                layers.isEmpty() ||
                layers.some(function (layer) {
                    if (layer.isBackground ||
                        layer.kind === layer.layerKinds.ADJUSTMENT) {
                        return true;
                    }

                    var childBounds = layerTree.childBounds(layer);
                    return !childBounds || childBounds.empty;
                }) ||
                layers.every(function (layer) {
                    return document.layers.isEmptyGroup(layer);
                });
        },

        /**
         * Determine if swap operations should be disabled for a given set of layers.
         * TRUE if ANY empty groups are included 
         * or if there are not exactly two layers
         * or if the layers are an artboard and a non-artboard
         *
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layer>} layers
         * @return {boolean}
         */
        _swapDisabled: function (document, layers) {
            return document.unsupported ||
                layers.size !== 2 ||
                layers.first().isArtboard !== layers.last().isArtboard ||
                layers.some(function (layer) {
                    return !layer.isArtboard && document.layers.isEmptyGroup(layer) ||
                        layer.isBackground ||
                        layer.kind === layer.layerKinds.ADJUSTMENT;
                });
        },

        render: function () {
            var flipDisabled = this.state.flipDisabled,
                swapDisabled = this.state.swapDisabled;

            return (
                <SplitButtonList className="button-radio__fixed" size="column-9">
                    <SplitButtonItem
                        title={strings.TOOLTIPS.FLIP_HORIZONTAL}
                        iconId="flip-horizontal"
                        selected={false}
                        disabled={flipDisabled}
                        onClick={this._flipX} />
                    <SplitButtonItem
                        title={strings.TOOLTIPS.FLIP_VERTICAL}
                        iconId="flip-vertical"
                        selected={false}
                        disabled={flipDisabled}
                        onClick={this._flipY} />
                    <SplitButtonItem
                        title={strings.TOOLTIPS.SWAP_POSITION}
                        iconId="swap"
                        selected={false}
                        disabled={swapDisabled}
                        onClick={this._swapLayers} />
                </SplitButtonList>
            );
        }
    });

    module.exports = Flip;
});
