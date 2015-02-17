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

    var NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        synchronization = require("js/util/synchronization"),
        collection = require("js/util/collection");

    var Opacity = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            var getRelevantProps = function (props) {
                return collection.pluckAll(props.layers, ["id", "opacity"]);
            };

            return !Immutable.is(getRelevantProps(this.props), getRelevantProps(nextProps));
        },

        /**
         * Debounced instance of actions.layers.setOpacity
         * @private
         * @type {function()}
         */
        _setOpacityDebounced: null,

        /**
         * Set the layer opacity.
         *
         * @param {SyntheticEvent} event
         * @param {number} opacity A percentage in [0,100]
         */
        _handleOpacityChange: function (event, opacity) {
            this._setOpacityDebounced(this.props.document, this.props.layers, opacity);
        },

        componentWillMount: function () {
            var flux = this.getFlux();
            
            this._setOpacityDebounced = synchronization.debounce(flux.actions.layers.setOpacity);
        },

        render: function () {
            var opacities = collection.pluck(this.props.layers, "opacity");
            return (
                    <NumberInput
                        value={opacities}
                        onChange={this._handleOpacityChange}
                        min={0}
                        max={100}
                        disabled={this.props.readOnly}
                        size="column-4" />
            );
        }
    });

    module.exports = Opacity;
});
