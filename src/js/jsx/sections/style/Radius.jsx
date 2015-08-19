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
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        Range = require("jsx!js/jsx/shared/Range"),
        Coalesce = require("js/jsx/mixin/Coalesce"),
        math = require("js/util/math"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    var Radius = React.createClass({
        mixins: [FluxMixin, Coalesce],

        propTypes: {
            document: React.PropTypes.object.isRequired
        },

        shouldComponentUpdate: function (nextProps) {
            var getRelevantProps = function (props) {
                var layers = props.document.layers.selected;

                return collection.pluckAll(layers, ["id", "bounds", "radii"]);
            };

            return !Immutable.is(getRelevantProps(this.props), getRelevantProps(nextProps));
        },

        /**
         * Update the radius of the selected layers in response to user input.
         *
         * @param {Immutable.Iterable.<Layer>} layers
         * @param {SyntheticEvent} event
         * @param {number=} value
         */
        _handleRadiusChange: function (layers, event, value) {
            if (value === undefined) {
                // In this case, the value is coming from the DOM element
                value = math.parseNumber(event.target.value);
            }

            var coalesce = this.shouldCoalesce();
            this.getFlux().actions.transform
                .setRadiusThrottled(this.props.document, layers, value, coalesce);
        },

        render: function () {
            var layers = this.props.document.layers.selected.filter(function (layer) {
                    return layer.radii;
                });

            // If there is not at least one selected vector layer, don't render
            if (layers.isEmpty()) {
                return null;
            }

            var scalars = collection.pluck(layers, "radii")
                .map(function (radii) {
                    return radii.scalar || 0;
                });

            // The maximum border radius is one-half of the shortest side of
            // from all the selected shapes.
            var maxRadius = collection.pluck(layers, "bounds")
                .toSeq()
                .filter(function (bounds) {
                    return !!bounds;
                })
                .reduce(function (sides, bounds) {
                    return sides.concat(Immutable.List.of(bounds.width / 2, bounds.height / 2));
                }, Immutable.List())
                .min();

            return (
                <div className="formline">
                    <Label
                        className="label__medium__left-aligned"
                        size="column-4"
                        title={strings.TOOLTIPS.SET_RADIUS}>
                        {strings.TRANSFORM.RADIUS}
                    </Label>
                    <div className="control-group__vertical">
                        <NumberInput
                            size="column-4"
                            disabled={this.props.disabled}
                            value={scalars}
                            onChange={this._handleRadiusChange.bind(this, layers)} />
                    </div>
                    <Range
                        disabled={this.props.disabled}
                        min={0}
                        max={maxRadius}
                        value={scalars}
                        size="column-14"
                        onMouseDown={this.startCoalescing}
                        onMouseUp={this.stopCoalescing}
                        onChange={this._handleRadiusChange.bind(this, layers)} />
                </div>
            );
        }
    });

    module.exports = Radius;
});
