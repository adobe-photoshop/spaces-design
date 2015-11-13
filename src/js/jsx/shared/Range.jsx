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
        Immutable = require("immutable");

    var collection = require("js/util/collection"),
        nls = require("js/util/nls");

    var Range = React.createClass({
        propTypes: {
            disabled: React.PropTypes.bool,
            min: React.PropTypes.number,
            max: React.PropTypes.number,
            value: React.PropTypes.oneOfType([
                React.PropTypes.number,
                React.PropTypes.instanceOf(Immutable.Iterable)
            ]),
            onChange: React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                disabled: false
            };
        },

        shouldComponentUpdate: function (nextProps) {
            return this.props.disabled !== nextProps.disabled ||
                this.props.min !== nextProps.min ||
                this.props.max !== nextProps.max ||
                !Immutable.is(this.props.value, nextProps.value);
        },

        /**
         * Blur the range element.
         *
         * @private
         */
        _handleMouseUp: function (event) {
            React.findDOMNode(this.refs.range).blur();

            if (this.props.onMouseUp) {
                this.props.onMouseUp(event);
            }
        },

        render: function () {
            var value = this.props.value,
                size = this.props.size || "column-9";

            size = size + " range";

            if (Immutable.Iterable.isIterable(value)) {
                value = collection.uniformValue(value) || 0;
            }

            return (
                <div
                    title={nls.localize("strings.TOOLTIPS.SET_RADIUS_SLIDER")}
                    className={size}>
                    <input
                        {...this.props}
                        ref="range"
                        onMouseUp={this._handleMouseUp}
                        tabIndex="-1"
                        type="range"
                        value={value} />
                </div>
            );
        },

        componentDidUpdate: function (prevProps) {
            // HACK - Don't try this at home! In Chromium, range elements don't
            // dynamically reposition the slider when the maximum value changes
            // until you click the slider or remove the element from the DOM
            // and reattach it. Simulated clicks don't seem to work, so we opt
            // for latter here.
            if (this.props.max !== prevProps.max) {
                var rangeEl = React.findDOMNode(this.refs.range),
                    siblingEl = rangeEl.nextSibling,
                    parentEl = rangeEl.parentNode;

                parentEl.removeChild(rangeEl);
                if (siblingEl) {
                    parentEl.insertBefore(rangeEl, siblingEl);
                } else {
                    parentEl.appendChild(rangeEl);
                }
            }
        }
    });

    module.exports = Range;
});
