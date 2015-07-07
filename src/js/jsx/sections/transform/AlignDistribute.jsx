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

    var AlignDistribute = React.createClass({
        mixins: [FluxMixin],
        
        propTypes: {
            document: React.PropTypes.object
        },

        getInitialState: function () {
            return {
                alignDisabled: true,
                distributeDisabled: true
            };
        },

        componentWillReceiveProps: function (nextProps) {
            var document = nextProps.document,
                layers = document.layers.selected,
                alignDisabled = layers.size < 2,
                distributeDisabled = layers.size < 3;

            if (!alignDisabled || !distributeDisabled) {
                var disabled = this._disabled(document, layers);

                alignDisabled = alignDisabled || disabled;
                distributeDisabled = distributeDisabled || disabled;
            }

            if (this.state.alignDisabled !== alignDisabled ||
                this.state.distributeDisabled !== distributeDisabled) {
                this.setState({
                    alignDisabled: alignDisabled,
                    distributeDisabled: distributeDisabled
                });
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return this.state.alignDisabled !== nextState.alignDisabled ||
                this.state.distributeDisabled !== nextState.distributeDisabled;
        },

        /**
         * Aligns the left edge of the layers 
         * 
         * @private
         */
        _alignLeft: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignLeft(document, layers);
        },

        /**
         * Aligns the right edge of the layers 
         * 
         * @private
         */
        _alignRight: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignRight(document, layers);
        },

        /**
         * Aligns the horizontal Center  of the layers 
         * 
         * @private
         */
        _alignHCenter: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignHCenter(document, layers);
        },

        /**
         * Aligns the top edge of the layers 
         * 
         * @private
         */
        _alignTop: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignTop(document, layers);
        },

        /**
         * Aligns the bottom edge of the layers 
         * 
         * @private
         */
        _alignBottom: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignBottom(document, layers);
        },

        /**
         * Aligns the Vertical Center  of the layers 
         * 
         * @private
         */
        _alignVCenter: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignVCenter(document, layers);
        },

        /**
         * Distributes the layers horizontally
         * 
         * @private
         */
        _distributeX: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.distributeX(document, layers);
        },

        /**
         * Distributes the layers vertically
         * 
         * @private
         */
        _distributeY: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.distributeY(document, layers);
        },

        /**
         * Determine if Align/Distribute operations should be disabled for a given set of layers.
         * TRUE If layers is empty
         * or if either a background or adjustment layer is included
         * (note that adjustment layers are kind of OK, but seem to have subtle issues with bounds afterwards)
         * or if any layers have ancestors which are also selected
         * or if ALL layers are empty groups
         *
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layer>} layers
         * @return {boolean}
         */
        _disabled: function (document, layers) {
            return document.unsupported ||
                layers.isEmpty() ||
                layers.some(function (layer) {
                    return layer.isBackground ||
                        layer.kind === layer.layerKinds.ADJUSTMENT ||
                        document.layers.hasStrictSelectedAncestor(layer);
                }) ||
                layers.every(function (layer) {
                    return document.layers.isEmptyGroup(layer);
                });
        },

        render: function () {
            var alignDisabled = this.state.alignDisabled,
                distributeDisabled = this.state.distributeDisabled;

            return (
                <div className="header-alignment">
                    <SplitButtonList>
                        <SplitButtonItem
                            title={strings.TOOLTIPS.DISTRIBUTE_HORIZONTALLY}
                            className="button-align-distribute"
                            iconId="distribute-horizontally"
                            disabled={distributeDisabled}
                            onClick={this._distributeX} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.DISTRIBUTE_VERTICALLY}
                            className="button-align-distribute"
                            iconId="distribute-vertically"
                            disabled={distributeDisabled}
                            onClick={this._distributeY} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_LEFT}
                            className="button-align-distribute"
                            iconId="align-left"
                            disabled={alignDisabled}
                            onClick={this._alignLeft} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_CENTER}
                            className="button-align-distribute"
                            iconId="align-center"
                            disabled={alignDisabled}
                            onClick={this._alignHCenter} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_RIGHT}
                            className="button-align-distribute"
                            iconId="align-right"
                            disabled={alignDisabled}
                            onClick={this._alignRight} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_TOP}
                            className="button-align-distribute"
                            iconId="align-top"
                            disabled={alignDisabled}
                            onClick={this._alignTop} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_MIDDLE}
                            className="button-align-distribute"
                            iconId="align-middle"
                            disabled={alignDisabled}
                            onClick={this._alignVCenter} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_BOTTOM}
                            className="button-align-distribute"
                            iconId="align-bottom"
                            disabled={alignDisabled}
                            onClick={this._alignBottom} />
                    </SplitButtonList>
                </div>
            );
        }
    });

    module.exports = AlignDistribute;
});
