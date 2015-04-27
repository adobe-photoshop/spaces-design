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

    var Rotate = require("jsx!./Rotate"),
        Label = require("jsx!js/jsx/shared/Label"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    var RotateFlip = React.createClass({
        mixins: [FluxMixin],
        
        propTypes: {
            document: React.PropTypes.object,
            layers: React.PropTypes.arrayOf(React.PropTypes.object)
        },

        componentWillReceiveProps: function () {
            // Reset this flag every time we receive new props
            this.setState({
                undo: false
            });
        },

        getInitialState: function () {
            return {
                undo: false
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            if (nextState.undo) {
                return true;
            }

            var curDocument = this.props.document,
                nextDocument = nextProps.document,
                curLayers = curDocument ? curDocument.layers.selected : Immutable.List(),
                nextLayers = nextDocument ? nextDocument.layers.selected : Immutable.List(),
                curLayerProps = collection.pluckAll(curLayers, ["id", "bounds"]),
                nextLayerProps = collection.pluckAll(nextLayers, ["id", "bounds"]);

            return !Immutable.is(curLayerProps, nextLayerProps);
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
         * 
         * @private
         */
        _swapLayers: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.swapLayers(document, layers);
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
                    var childBounds = layerTree.childBounds(layer);

                    return layer.isBackground ||
                        layer.kind === layer.layerKinds.ADJUSTMENT ||
                        (!childBounds || childBounds.empty) ||
                        layer.isArtboard;
                }) ||
                layers.every(function (layer) {
                    return document.layers.isEmptyGroup(layer);
                });
        },

        /**
         * Determine if swap operations should be disabled for a given set of layers.
         * This only includes conditions IN ADDITION TO _flipDisabled
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
                layers.some(function (layer) {
                    return !layer.isArtboard && document.layers.isEmptyGroup(layer);
                }) ||
                layers.first().isArtboard !== layers.last().isArtboard;
        },

        render: function () {
            var document = this.props.document,
                layers = document ? document.layers.selected : Immutable.List(),
                layersNormalized = document ? document.layers.selectedNormalized : Immutable.List(),
                flipDisabled = !document || this._flipDisabled(document, layers),
                swapDisabled = flipDisabled || this._swapDisabled(document, layersNormalized);

            return (
                <div className="formline">
                    <Label
                        title={strings.TOOLTIPS.SET_ROTATION}>
                        {strings.TRANSFORM.ROTATE}
                    </Label>
                    <Gutter />
                    <Rotate {...this.props} />
                    <Gutter />
                    <SplitButtonList>
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
                    <Gutter />
                </div>
            );
        }
    });

    module.exports = RotateFlip;
});
