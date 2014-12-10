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
        _ = require("lodash");
        
    var Label = require("jsx!js/jsx/shared/Label"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        Range = require("jsx!js/jsx/shared/Range"),
        synchronization = require("js/util/synchronization"),
        math = require("js/util/math"),
        strings = require("i18n!nls/strings");

    var Radius = React.createClass({
        mixins: [FluxMixin],

        _setRadiusDebounced: null,

        componentWillMount: function () {
            var flux = this.getFlux(),
                setRadius = flux.actions.transform.setRadius;

            this._setRadiusDebounced = synchronization.debounce(setRadius);
        },

        /**
         * Update the radius of the selected layers in response to user input.
         *
         * @param {SyntheticEvent} event
         * @param {number=} value
         */
        _handleRadiusChange: function (event, value) {
            if (value === undefined) {
                // In this case, the value is coming from the DOM element
                value = math.parseNumber(event.target.value);
            }

            this._setRadiusDebounced(this.props.document, this.props.layers, value);
        },

        render: function () {
            var document = this.props.document,
                layers = this.props.layers;

            var locked = !document || document.selectedLayersLocked() ||
                _.any(layers, function (layer) {
                    return layer.kind !== layer.layerKinds.VECTOR || layer.isAncestorLocked();
                });

            var scalars = layers.reduce(function (allRadii, layer) {
                if (layer.radii) {
                    var scalar = layer.radii.scalar();
                    if (scalar) {
                        scalar = Math.round(scalar);
                    }
                    allRadii.push(scalar);
                }
                return allRadii;
            }, []);

            // The maximum border radius is one-half of the shortest side of
            // from all the selected shapes.
            var maxRadius;
            if (layers.length === 0) {
                maxRadius = 0;
            } else {
                maxRadius = _.chain(layers)
                    .pluck("bounds")
                    .filter(function (bounds) {
                        return !!bounds;
                    })
                    .reduce(function (sides, bounds) {
                        sides.push(bounds.width / 2);
                        sides.push(bounds.height / 2);
                        return sides;
                    }, [])
                    .reduce(function (min, side) {
                        if (side <= min) {
                            return side;
                        } else {
                            return min;
                        }
                    }, Number.POSITIVE_INFINITY)
                    .value();
            }

            return (
                <li className="formline">
                    <Label
                        title={strings.TOOLTIPS.SET_RADIUS}>
                        {strings.TRANSFORM.RADIUS}
                    </Label>
                    <Gutter />
                    <NumberInput
                        disabled={locked}
                        valueType="simple"
                        value={scalars}
                        onChange={this._handleRadiusChange}
                    />
                    <Gutter />
                    <Range
                        disabled={locked}
                        min={0}
                        max={maxRadius}
                        value={scalars}
                        onChange={this._handleRadiusChange} />
                </li>
            );
        }
    });

    module.exports = Radius;
});
