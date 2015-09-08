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
        FluxMixin = require("fluxxor").FluxMixin(React),
        Immutable = require("immutable");

    var SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    var Combine = React.createClass({
        mixins: [FluxMixin],
        propTypes: {
            document: React.PropTypes.object.isRequired
        },

        shouldComponentUpdate: function (nextProps) {
            var getRelevantProps = function (props) {
                return collection.pluckAll(props.document.layers.selected, ["id"]);
            };

            return !Immutable.is(getRelevantProps(this.props), getRelevantProps(nextProps));
        },

        /**
         * Handle click of the UNION combine button
         */
        _combineUnion: function () {
            this.getFlux().actions.shapes.combineUnion(this.props.document, this.props.document.layers.selected);
        },

        /**
         * Handle click of the SUBTRACT combine button
         */
        _combineSubtract: function () {
            this.getFlux().actions.shapes.combineSubtract(this.props.document, this.props.document.layers.selected);
        },

        /**
         * Handle click of the INTERSECT combine button
         */
        _combineIntersect: function () {
            this.getFlux().actions.shapes.combineIntersect(this.props.document, this.props.document.layers.selected);
        },

        /**
         * Handle click of the DIFFERENCE combine button
         */
        _combineDifference: function () {
            this.getFlux().actions.shapes.combineDifference(this.props.document, this.props.document.layers.selected);
        },

        render: function () {
            var vectorLayers = this.props.document.layers.selected.filter(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                }),
                disabled = this.props.disabled ||
                    vectorLayers.isEmpty() ||
                    (this.props.document.layers.selected.size !== vectorLayers.size);

            return (
                <SplitButtonList className="button-radio__fixed vector-operations" size="column-16">
                    <SplitButtonItem
                        iconId="xor-union"
                        disabled={disabled}
                        onClick={this._combineUnion}
                        onFocus={this.props.onFocus}
                        title={strings.TOOLTIPS.UNITE_SHAPE} />
                    <SplitButtonItem
                        iconId="xor-subtract"
                        disabled={disabled}
                        onClick={this._combineSubtract}
                        onFocus={this.props.onFocus}
                        title={strings.TOOLTIPS.SUBTRACT_SHAPE} />
                    <SplitButtonItem
                        iconId="xor-intersect"
                        disabled={disabled}
                        onClick={this._combineIntersect}
                        onFocus={this.props.onFocus}
                        title={strings.TOOLTIPS.INTERSECT_SHAPE} />
                    <SplitButtonItem
                        iconId="xor-difference"
                        disabled={disabled}
                        onClick={this._combineDifference}
                        onFocus={this.props.onFocus}
                        title={strings.TOOLTIPS.DIFFERENCE_SHAPE} />
                </SplitButtonList>
            );
        }
    });

    module.exports = Combine;
});
