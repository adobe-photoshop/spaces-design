/** @jsx React.DOM */
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
        mathjs = require("mathjs"),
        _ = require("lodash");

    var Focusable = require("../mixin/Focusable"),
        math = require("js/util/math"),
        strings = require("i18n!nls/strings");

    var NumberInput = React.createClass({
        mixins: [Focusable, React.addons.PureRenderMixin],

        propTypes: {
            value: React.PropTypes.oneOfType([
                React.PropTypes.number,
                React.PropTypes.array
            ]),
            onChange: React.PropTypes.func,
            onAccept: React.PropTypes.func,
            onStep: React.PropTypes.func,
            step: React.PropTypes.number.isRequired
        },

        getDefaultProps: function () {
            return {
                value: null,
                step: 1
            };
        },

        getInitialState: function () {
            var value = this.props.value,
                rawValue = this._formatValue(value);

            return {
                rawValue: rawValue,     // String
                lastRawValue: rawValue  // String, for cancellation purposes
            };
        },

        // This call guarantees to call _formatValue
        componentWillReceiveProps: function (nextProps) {
            if (nextProps.hasOwnProperty("value")) {
                var rawValue = this._formatValue(nextProps.value);

                this.setState({
                    rawValue: rawValue,
                    lastRawValue: rawValue
                });
            }
        },

        /**
         * Parses the input string to a valid number
         *
         * @param {string} rawValue value of the input field
         * @return {number} Value of the input field as a number or null if invalid
         */
        _extractValue: function (rawValue) {
            var value;
            try {
/*jslint evil: true */
                value = mathjs.eval(rawValue);
/*jslint evil: false */
                // Run it through our simple parser to get rid of complex and big numbers
                value = math.parseNumber(value);
            } catch (err) {
                value = null;
            }

            if (_.isFinite(value)) {
                return value;
            } else {
                return null;
            }
        },
        
        /*
         * Formats the number value into a string
         *
         * @param {number} value Value of the input
         * @return {string} empty string if null, number in string otherwise
         */
        _formatValue: function (value) {
            if (value === null) {
                return "";
            } else if (!_.isArray(value)) {
                return value.toString();
            } else if (_.every(value, function (v) { return v === value[0]; })) {
                return value[0].toString();
            } else {
                return strings.TRANSFORM.MIXED;
            }
        },

        /**
         * When the input field changes, 
         * we test here to see if the entered value is valid
         * and call the onChange handler, if passed one
         */
        handleChange: function (event) {
            var rawValue = event.target.value,
                value = this._extractValue(rawValue);

            this.setState({
                rawValue: rawValue
            });

            if (value !== null && this.props.onChange) {
                this.props.onChange(value);
            }
        },

        /**
         * Handle various function keys here
         * Enter to accept
         * Esc to cancel
         * Up-down arrow keys to step
         */
        handleKeyDown: function (event) {
            var key = event.key,
                value = this._extractValue(event.target.value);

            if (key === "Return" || key === "Enter") {
                if (value !== null && this.props.onAccept) {
                    this.props.onAccept(value);
                }
            } else if (key === "Escape") {
                // Reset it to last good valid value
                this.setState({ rawValue: lastRawValue });
            } else if (key === "ArrowUp") {
                if (value !== null && this.props.onAccept) {
                    this.props.onAccept(value + this.props.step);
                }
            } else if (key === "ArrowDown") {
                if (value !== null && this.props.onAccept) {
                    this.props.onAccept(value - this.props.step);
                }
            }
        },

        /**
         * When we lose focus, this may be used by the client of component
         * to accept the new valid value, or reset it
         */
        handleBlur: function (event) {
            var value = this._extractValue(event.target.value);

            if (value !== null) {
                if (this.props.onAccept) {
                    this.props.onAccept(value);
                }
            } else {
                this.setState({
                    rawValue: this.state.lastRawValue
                });
            }
        },

        render: function () {
            return this.transferPropsTo(
                <input
                    type="text"
                    value={this.state.rawValue}
                    onChange={this.handleChange}
                    onBlur={this.handleBlur}
                    onKeyDown={this.handleKeyDown}>
                </input>
            );
        },
        

    });

    module.exports = NumberInput;
});
