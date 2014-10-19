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

    var React = require("react");

    module.exports = {
        propTypes: {
            rawValue: React.PropTypes.string
        },
        defaultProps: {
            value: null
        },
        getInitialState: function () {
            var value = this.props.value,
                rawValue = this.formatValue(value);

            return {
                value: value,
                rawValue: rawValue,
                lastRawValue: rawValue
            };
        },
        componentWillMount: function () {
            if (!this.extractValue) {
                throw new Error("extractValue is not defined");
            }

            if (!this.formatValue) {
                throw new Error("formatValue is not defined");
            }
        },
        componentWillReceiveProps: function (nextProps) {
            if (nextProps.hasOwnProperty("value")) {
                var rawValue = this.formatValue(nextProps.value);

                this.setState({
                    value: this.extractValue(nextProps.value),
                    rawValue: rawValue,
                    lastRawValue: rawValue
                });
            }
        },
        handleChange: function (event) {
            var rawValue = event.target.value;

            if (this._updateValue(rawValue, false) && this.props.onChange) {
                this.props.onChange(event);
            }
        },
        handleKeyDown: function (event) {
            var key = event.key;

            if (key === "Enter" || key === "Return") {
                var rawValue = event.target.value;

                if (this._updateValue(rawValue, true)) {
                    this.setState({
                        lastRawValue: rawValue
                    });

                    if (this.props.onValueAccept) {
                        this.props.onValueAccept(event);
                    }
                }
            } else if (key === "Escape") {
                // Reset back to old value
                this.setState({
                    rawValue: this.state.lastRawValue
                });

                if (this.props.onValueCancel) {
                    this.props.onValueCancel(event);
                }
            }
        },
        handleBlur: function (event) {
            var rawValue = event.target.value;

            if (this._updateValue(rawValue, true)) {
                this.setState({
                    lastRawValue: rawValue
                });
                if (this.props.onBlur) {
                    this.props.onBlur(event);
                }
            }
        },
        _updateValue: function (rawValue, force) {
            var value = this.extractValue(rawValue);

            if (value !== null) {
                this.setState({
                    value: value,
                    rawValue: rawValue
                });

                if (this.props.onValueChange) {
                    this.props.onValueChange(value);
                }

                return true;
            } else {
                if (force) {
                    rawValue = this.formatValue(this.state.value);
                }

                this.setState({
                    rawValue: rawValue
                });

                return false;
            }
        },
        getValue: function () {
            return this.state.value;
        },
        setValue: function (value) {
            var rawValue = this.formatValue(value);

            this.setState({
                value: value,
                rawValue: rawValue
            });
        }
    };
});
