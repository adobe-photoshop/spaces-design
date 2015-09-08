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

    var SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * The set of possible stroke alignment types
     * 
     * @private
     * @type {Immutable.OrderedMap.<Select.OptionRec>}
     */
    var _alignmentModes = Immutable.OrderedMap({
        "INSIDE": {
            id: "INSIDE",
            title: strings.STYLE.STROKE.ALIGNMENT_MODES.INSIDE
        },
        "CENTER": {
            id: "CENTER",
            title: strings.STYLE.STROKE.ALIGNMENT_MODES.CENTER
        },
        "OUTSIDE": {
            id: "OUTSIDE",
            title: strings.STYLE.STROKE.ALIGNMENT_MODES.OUTSIDE
        }
    });

    var StrokeAlignment = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            var sameLayerIDs = collection.pluck(this.props.layers, "id")
                .equals(collection.pluck(nextProps.layers, "id"));

            return !sameLayerIDs ||
                !Immutable.is(this.props.alignments, nextProps.alignments) ||
                this.props.disabled !== nextProps.disabled;
        },

        getDefaultProps: function () {
            // The id is used to distinguish among Dialog instances
            return {
                id: "main"
            };
        },

        /**
         * Set the stroke alignment  of the selected layers
         *
         * @private
         * @param {string} alignment new stroke alignment either CENTER, INSIDE, or OUTSIDE
         */
        _handleChange: function (alignment) {
            this.getFlux().actions.shapes
                .setStrokeAlignmentThrottled(this.props.document, this.props.layers, alignment);
        },

        render: function () {
            var alignments = this.props.alignments,
                alignment = collection.uniformValue(alignments),
                alignmentTitle = _alignmentModes.has(alignment) ? _alignmentModes.get(alignment).title :
                    (alignments.size > 1 ? strings.TRANSFORM.MIXED : alignment);

            // Hack to disable the Fill BlendMode instance
            if (this.props.disabled) {
                alignmentTitle = null;
            }

            return (
                <SplitButtonList size="column-9">
                    <SplitButtonItem
                        title={strings.STYLE.STROKE.ALIGNMENT_MODES.INSIDE}
                        iconId="stroke-inner"
                        selected={alignment === "INSIDE"}
                        onClick={this._handleChange.bind(this, "INSIDE")}
                        className={"split-button__item__fixed"}
                        disabled={this.props.disabled} />
                    <SplitButtonItem
                        title={strings.STYLE.STROKE.ALIGNMENT_MODES.CENTER}
                        iconId="stroke-middle"
                        selected={alignment === "CENTER"}
                        className={"split-button__item__fixed"}
                        onClick={this._handleChange.bind(this, "CENTER")}
                        disabled={this.props.disabled} />
                    <SplitButtonItem
                        title={strings.STYLE.STROKE.ALIGNMENT_MODES.OUTSIDE}
                        iconId="stroke-outer"
                        selected={alignment === "OUTSIDE"}
                        className={"split-button__item__fixed"}
                        onClick={this._handleChange.bind(this, "OUTSIDE")}
                        disabled={this.props.disabled} />
                </SplitButtonList>
            );
        }
    });

    module.exports = StrokeAlignment;
});
