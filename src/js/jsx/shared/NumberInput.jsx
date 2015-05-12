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
        Immutable = require("immutable"),
        mathjs = require("mathjs"),
        classnames = require("classnames"),
        _ = require("lodash");

    var os = require("adapter/os"),
        log = require("js/util/log");

    var Focusable = require("../mixin/Focusable"),
        math = require("js/util/math"),
        collection = require("js/util/collection"),
        strings = require("i18n!nls/strings"),
        headlights = require("js/util/headlights");

    var NumberInput = React.createClass({
        mixins: [Focusable],

        /**
         * Once after focus, mouseup is suppressed to maintain the initial selection.
         * 
         * @private
         * @type {boolean} Whether the mouse up should be suppressed.
         */
        _suppressMouseUp: false,

        propTypes: {
            value: React.PropTypes.oneOfType([
                React.PropTypes.number,
                React.PropTypes.string,
                React.PropTypes.instanceOf(Immutable.Iterable)
            ]),
            special: React.PropTypes.string,
            onChange: React.PropTypes.func.isRequired,
            step: React.PropTypes.number,
            bigstep: React.PropTypes.number,
            min: React.PropTypes.number,
            max: React.PropTypes.number,
            precision: React.PropTypes.number,
            disabled: React.PropTypes.bool
        },

        getDefaultProps: function () {
            return {
                value: null,
                step: 1,
                bigstep: 10,
                min: Number.NEGATIVE_INFINITY,
                max: Number.POSITIVE_INFINITY,
                onChange: _.identity,
                precision: 1,
                disabled: false
            };
        },

        getInitialState: function () {
            var rawValue = this._formatValue(this.props.value);

            return {
                rawValue: rawValue,
                dirty: false
            };
        },

        componentWillReceiveProps: function (nextProps) {
            var rawValue = this._formatValue(nextProps.value);

            var node = React.findDOMNode(this.refs.input),
                select = window.document.activeElement === node &&
                    node.selectionStart === 0 &&
                    node.selectionEnd === node.value.length;

            this.setState({
                rawValue: rawValue,
                select: select
            });
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return nextState.rawValue !== this.state.rawValue ||
                nextState.dirty !== this.state.dirty ||
                nextProps.disabled !== this.props.disabled ||
                !Immutable.is(nextProps.value, this.props.value);
        },

        componentDidUpdate: function () {
            if (this.state.select) {
                // If the component updated and there is selection state, restore it
                var node = React.findDOMNode(this.refs.input);
                if (window.document.activeElement === node) {
                    node.setSelectionRange(0, node.value.length);
                }

                this.setState({
                    select: false
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
            if (this.props.special && rawValue === this.props.special) {
                return rawValue;
            }

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
         * @param {?number|Immutable.Iterable.<number>} value Value of the input
         * @return {string} empty string if null, number in string otherwise
         */
        _formatValue: function (value) {
            if (Immutable.Iterable.isIterable(value)) {
                if (value.isEmpty()) {
                    return "";
                } else {
                    value = collection.uniformValue(value);

                    if (value === null) {
                        return strings.TRANSFORM.MIXED;
                    }
                }
            }

            switch (typeof value) {
            case "number":
                return String(mathjs.round(value, this.props.precision));
            case "string":
                return value;
            default:
                return "";
            }
        },

        /**
         * Update the rawValue of the text input. We only call the external
         * onChange handler when the rawValue is committed.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleChange: function (event) {
            this.setState({
                rawValue: event.target.value,
                select: false,
                dirty: true
            });
        },

        /**
         * Blur the input and release focus to Photoshop.
         * 
         * @private
         */
        _releaseFocus: function () {
            os.releaseKeyboardFocus()
                .catch(function (err) {
                    var message = err instanceof Error ? (err.stack || err.message) : err;

                    log.error("Failed to release keyboard focus on reset:", message);
                });
            React.findDOMNode(this.refs.input).blur();
        },

        /**
         * Reset the rawValue of the text input according to the external value
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _reset: function (event) {
            if (this.state.dirty) {
                var rawValue = this._formatValue(this.props.value);
                this.setState({
                    rawValue: rawValue,
                    dirty: false,
                    select: true
                });
            } else {
                this._releaseFocus();
            }

            event.stopPropagation();
        },

        /**
         * Commit the current value by calling the external onChange handler.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {number} nextValue
         * @param {boolean} retainFocus
         */
        _commit: function (event, nextValue, retainFocus) {
            if (retainFocus || this.state.dirty) {
                if (typeof nextValue === "number") {
                    if (nextValue > this.props.max) {
                        nextValue = this.props.max;
                    }

                    if (nextValue < this.props.min) {
                        nextValue = this.props.min;
                    }
                }

                // For NumberInput owners that don't immediately re-read values from Flux
                // This ensures that the increment/decrement will show the new value
                var nextRawValue = this._formatValue(nextValue);

                this.setState({
                    dirty: false,
                    select: true,
                    rawValue: nextRawValue
                });
                
                // If input hasn't changed, avoid multiple submits
                var curValue = this.props.value;
                if ((Immutable.Iterable.isIterable(curValue) && nextValue === collection.uniformValue(curValue)) ||
                    nextValue === curValue) {
                    return;
                }

                // If any math operators were used, log in headlights
                if (event.target.value.match(/[\-+/*]/)) {
                    headlights.logEvent("edit", "transform", "math-operator");
                }

                this.props.onChange(event, nextValue);                
            } else {
                this._releaseFocus();
            }

            event.stopPropagation();
        },

        /**
         * Handle non-printable keyboard input:
         * - Enter or Return to attempt to commit the value
         * - Escape to reset the value
         * - Up or down arrow to increment or decrement and commit the value
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleKeyDown: function (event) {
            var key = event.key;
            if (key === "Escape") {
                this._reset(event);
                return;
            }

            var nextValue,
                multiplier,
                increment;

            switch (key) {
            case "Return":
            case "Enter":
                nextValue = this._extractValue(event.target.value);
                if (nextValue === null) {
                    this._reset(event);
                } else {
                    this._commit(event, nextValue);
                }
                break;
            case "ArrowUp":
            case "ArrowDown":
                nextValue = this._extractValue(event.target.value);
                if (nextValue === null) {
                    this._reset(event);
                } else if (typeof nextValue === "number") {
                    multiplier = key === "ArrowUp" ? 1 : -1;
                    multiplier *= event.shiftKey ? this.props.bigstep : 1;
                    increment = this.props.step * multiplier;
                    nextValue += increment;
                    this.setState({
                        select: true
                    });
                    this._commit(event, nextValue, true);
                }
                event.preventDefault();
                break;
            }

            if (this.props.onKeyDown) {
                this.props.onKeyDown(event);
            }
        },

        /**
         * Selects the content of the input on focus.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleFocus: function (event) {
            var node = React.findDOMNode(this.refs.input);

            node.selectionStart = 0;
            node.selectionEnd = event.target.value.length;

            if (this.props.onFocus) {
                this.props.onFocus(event);
            }
        },

        /**
         * Attempt to commit the current value, and call the external onBlur
         * handler.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleBlur: function (event) {
            var nextValue = this._extractValue(event.target.value);
            if (nextValue === null) {
                var rawValue = this._formatValue(this.props.value);
                this.setState({
                    rawValue: rawValue,
                    dirty: false
                });
            } else {
                this._commit(event, nextValue, true);
            }

            if (this.props.onBlur) {
                this.props.onBlur(event);
            }
        },

        /**
         * Record whether or not the successive mouseup event should be suppressed.
         *
         * @private
         */
        _handleMouseDown: function () {
            if (window.document.activeElement !== React.findDOMNode(this)) {
                this._suppressMouseUp = true;
            }
        },

        /**
         * Prevent default browser action to avoid clearing the selection.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseUp: function (event) {
            if (this._suppressMouseUp) {
                event.preventDefault();
                this._suppressMouseUp = false;
            }
        },

        render: function () {
            var size = this.props.size || "column-4";
            var className = classnames({
                    "number-input__dirty": this.state.dirty,
                    "number-input__clean": !this.state.dirty
                });
            className += " " + size + " number-input";
            return (
                <input
                    {...this.props}
                    type="text"
                    ref="input"
                    className={className}
                    disabled={this.props.disabled}
                    value={this.state.rawValue}
                    onMouseDown={this._handleMouseDown}
                    onMouseUp={this._handleMouseUp}
                    onChange={this._handleChange}
                    onFocus={this._handleFocus}
                    onBlur={this._handleBlur}
                    onKeyDown={this._handleKeyDown}>
                </input>
            );
        }
    });

    module.exports = NumberInput;
});
