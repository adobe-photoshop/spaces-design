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

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    var Combine = React.createClass({
        mixins: [FluxMixin],
        propTypes: {
            document: React.PropTypes.object.isRequired,
            layers: React.PropTypes.instanceOf(Immutable.Iterable).isRequired
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
            this.getFlux().actions.shapes.combineUnion(this.props.document, this.props.layers);
        },

        /**
         * Handle click of the SUBTRACT combine button
         */
        _combineSubtract: function () {
            this.getFlux().actions.shapes.combineSubtract(this.props.document, this.props.layers);
        },

        /**
         * Handle click of the INTERSECT combine button
         */
        _combineIntersect: function () {
            this.getFlux().actions.shapes.combineIntersect(this.props.document, this.props.layers);
        },

        /**
         * Handle click of the DIFFERENCE combine button
         */
        _combineDifference: function () {
            this.getFlux().actions.shapes.combineDifference(this.props.document, this.props.layers);
        },

        render: function () {
            // The combine operations will behave unexpectedly if non-vector layers are selected
            if (this.props.document.layers.selected.size !== this.props.layers.size) {
                return null;
            }

            return (
                <div className="formline vector-operations">
                    <Label
                        title={strings.TOOLTIPS.SET_COMBINATION}>
                        {strings.STYLE.VECTOR.COMBINE}
                    </Label>
                    <Gutter />
                    <SplitButtonList>
                        <SplitButtonItem
                            iconId="xor-union"
                            disabled={this.props.disabled}
                            onClick={this._combineUnion}
                            onFocus={this.props.onFocus}
                            title={strings.TOOLTIPS.UNITE_SHAPE} />
                        <SplitButtonItem
                            iconId="xor-subtract"
                            disabled={this.props.disabled}
                            onClick={this._combineSubtract}
                            onFocus={this.props.onFocus}
                            title={strings.TOOLTIPS.SUBTRACT_SHAPE} />
                        <SplitButtonItem
                            iconId="xor-intersect"
                            disabled={this.props.disabled}
                            onClick={this._combineIntersect}
                            onFocus={this.props.onFocus}
                            title={strings.TOOLTIPS.INTERSECT_SHAPE} />
                        <SplitButtonItem
                            iconId="xor-difference"
                            disabled={this.props.disabled}
                            onClick={this._combineDifference}
                            onFocus={this.props.onFocus}
                            title={strings.TOOLTIPS.DIFFERENCE_SHAPE} />
                    </SplitButtonList>
                    <Gutter />
                </div>
            );
        }
    });

    module.exports = Combine;
});
