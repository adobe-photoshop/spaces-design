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
        OS = require("adapter/os"),
        Focusable = require("../mixin/Focusable");

    // some business about numeric vs free text field and whether that
    // enables up and down arrows or not.
    var _typeToClass = {
        simple: "c-4-25",
        percent: "c-3-25",
        degree: "c-3-25",
        color: "c-6-25",
        shadow: "c-9-25",
        radii: "c-3-25",
        size: "c-2-25",
        combo: "c-16-25 button-combo",
        smallCombo: "c-12-25 button-combo",
        mediumCombo: "c-14-25 button-combo"
    };

    var TextField = React.createClass({
        mixins: [Focusable, React.addons.PureRenderMixin],

        propTypes: {
            value: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        },

        getDefaultProps: function () {
            return {
                value: ""
            };
        },

        getInitialState: function () {
            return {
                value: this.props.value,
                editing: false
            };
        },

        componentWillReceiveProps: function (nextProps) {
            if (nextProps.hasOwnProperty("value")) {
                this.setState({
                    value: nextProps.value
                });
            }
        },

        /**
         * When we switch from non editing to editing state, this highlights the field
         */
        componentDidUpdate: function (oldProps, oldState) {
            if (oldState.editing === false && this.state.editing === true) {
                this.refs.input.getDOMNode().select();
            }
        },

        _handleChange: function (event) {
            this.setState({
                value: event.target.value
            });
        },

        /**
         * Resets the text field to it's last given value
         *
         * @private
         * @param  {SyntheticEvent} event
         */
        _reset: function (event) {
            this.setState({
                value : this.props.value
            });

            event.stopPropagation();
        },

        /**
         * Commits the current value by calling the external onChange handler.
         * @param  {[type]} event     [description]
         * @param  {[type]} nextValue [description]
         * @return {[type]}           [description]
         */
        _commit: function (event, nextValue) {
            event.stopPropagation();

            this.props.onChange(event, nextValue);
        },

        /**
         * Calls onAccept handler when focus is taken from the TextField
         * @private
         */
        _handleBlur: function (event) {
            var newValue = event.target.value;

            this.setState({
                editing: false,
                value: newValue
            });

            this._commit(event, newValue);

            if (this.props.onBlur) {
                this.props.onBlur(event);
            }
        },

        /**
         * Handler for various special keys
         * On Enter/Return, calls onAccept handler, if provided
         * On Escape, resets to last given value from props
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleKeyDown: function (event) {
            var key = event.key;
            
            switch (key) {
                case "Escape":
                    this._reset(event);
                    return;
                case "Return":
                case "Enter":
                    this._commit(event, event.target.value);
                    break;
            }

            if (this.props.onKeyDown) {
                this.props.onKeyDown(event);
            }
        },

        /**
         * If the value is editable, goes into edit mode
         *
         * @private
         * @param  {SyntheticEvent} event 
         */
        _handleDoubleClick: function (event) {
            if (!this.props.editable) {
                return;
            }
            this.refs.input.getDOMNode().removeAttribute("readOnly");
            this.setState({
                editing: true
            });
        },

        render: function () {
            if (this.state.editing) {
                return (
                    <input
                        {...this.props}
                        type="text"
                        ref="input"
                        value={this.state.value}
                        className={_typeToClass[this.props.valueType]}
                        onChange={this._handleChange}
                        onKeyDown={this._handleKeyDown}
                        onBlur={this._handleBlur}>
                    </input>
                );
            } else {
                return this.transferPropsTo(
                    <input
                        {...this.props}
                        type="text"
                        ref="input"
                        value={this.state.value}
                        readOnly={true}
                        className={_typeToClass[this.props.valueType]}
                        onDoubleClick={this._handleDoubleClick}>
                    </input>
                );
            }
        },

        

        
    });

    module.exports = TextField;
});
