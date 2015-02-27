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

    var Label = require("jsx!js/jsx/shared/Label"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings");

    var RotateFlip = React.createClass({
        
        mixins: [FluxMixin],
        
        propTypes: {
            document: React.PropTypes.object,
            layers: React.PropTypes.arrayOf(React.PropTypes.object)
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
         *
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layer>} layers
         * @return {boolean}
         */
        _flipDisabled: function (document, layers) {
            return layers.isEmpty() ||
                layers.some(function (layer) {
                    return layer.isBackground ||
                        layer.kind === layer.layerKinds.ADJUSTMENT;
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
         *
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layer>} layers
         * @return {boolean}
         */
        _swapDisabled: function (document, layers) {
            return layers
                .some(function (layer) {
                    return document.layers.isEmptyGroup(layer);
                }) ||
                layers.size !== 2;
        },

        render: function () {
            var document = this.props.document,
                layers = document ? document.layers.selected : Immutable.List(),
                flipDisabled = !document || this._flipDisabled(document, layers),
                swapDisabled = flipDisabled || this._swapDisabled(document, layers);

            return (
                <div className="formline">
                    <Label
                        title={strings.TOOLTIPS.SET_ROTATION}>
                        {strings.TRANSFORM.ROTATE}
                    </Label>
                    <Gutter />
                    <TextInput valueType="percent" />
                    <Gutter />
                    <SplitButtonList>
                        <SplitButtonItem
                            title={strings.TOOLTIPS.FLIP_HORIZONTAL}
                            id="ico-flip-horizontal"
                            selected={false}
                            disabled={flipDisabled}
                            onClick={this._flipX} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.FLIP_VERTICAL}
                            id="ico-flip-vertical"
                            selected={false}
                            disabled={flipDisabled}
                            onClick={this._flipY} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SWAP_POSITION}
                            id="ico-swap"
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
