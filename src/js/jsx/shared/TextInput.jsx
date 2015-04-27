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
        _ = require("lodash");

    var os = require("adapter/os");

    var Focusable = require("../mixin/Focusable"),
        log = require("js/util/log");

    var _typeToClass = {
        simple: "column-4",
        percent: "column-3",
        degree: "column-3",
        color: "column-11",
        shadow: "column-9",
        radii: "column-3",
        size: "column-2",
        combo: "column-16 button-combo",
        smallCombo: "column-12 button-combo",
        mediumCombo: "column-14 button-combo"
    };

    var TextInput = React.createClass({
        mixins: [Focusable],

        propTypes: {
            value: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired,
            onDOMChange: React.PropTypes.func,
            onFocus: React.PropTypes.func,
            editable: React.PropTypes.bool
        },

        getDefaultProps: function () {
            return {
                value: "",
                onChange: _.identity,
                onDOMChange: _.identity,
                onFocus: _.identity,
                editable: false,
                live: false,
                continuous: false
            };
        },

        getInitialState: function () {
            return {
                editing: false,
                value: this.props.value,
                select: false
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return !Immutable.is(this.props.value, nextProps.value) ||
                !Immutable.is(this.state.value, nextState.value) ||
                this.state.editing !== nextState.editing;
        },

        componentWillReceiveProps: function (nextProps) {
            if (nextProps.hasOwnProperty("value")) {
                this.setState({
                    value: nextProps.value
                });
            }

            var node = this.refs.input.getDOMNode();
            if (document.activeElement === node &&
                    node.selectionStart === 0 &&
                    node.selectionEnd === node.value.length) {
                this.setState({
                    select: true
                });
            }
        },

        componentDidUpdate: function () {
            if (this.state.select) {
                // If the component updated and there is selection state, restore it
                var node = this.refs.input.getDOMNode();
                if (document.activeElement === node) {
                    node.setSelectionRange(0, node.value.length);
                }

                this.setState({
                    select: false
                });
            }
        },

        /**
         * Update the value of the text input.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleChange: function (event) {
            var nextValue = event.target.value;
            this.setState({
                value: nextValue,
                editing: true,
                select: false
            });

            if (this.state.editing && this.props.live && this.props.continuous) {
                this.props.onChange(event, nextValue);
            }

            this.props.onDOMChange(event);
        },

        /**
         * Release focus to Photoshop.
         * 
         * @private
         */
        _releaseFocus: function () {
            os.releaseKeyboardFocus()
                .bind(this)
                .finally(function () {
                    // HACK: this needs to wait for the next tick of the event loop,
                    // otherwise the blur handler will be executed before the edit
                    // state has been updated.
                    this.refs.input.getDOMNode().blur();
                })
                .catch(function (err) {
                    var message = err instanceof Error ? (err.stack || err.message) : err;

                    log.error("Failed to release keyboard focus:", message);
                });
        },

        /**
         * Resets the text field to its last committed value.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _reset: function (event) {
            this.setState({
                value : this.props.value,
                editing: false,
                select: true
            });

            event.stopPropagation();
            this._releaseFocus();
        },

        /**
         * Commits the current value by calling the external onChange handler.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _commit: function (event) {
            var nextValue = event.target.value;
            this.setState({
                value: nextValue,
                editing: false
            });

            event.stopPropagation();
            this.props.onChange(event, nextValue);

            if (!this.state.editing) {
                this._releaseFocus();
            } else {
                this.setState({
                    select: true
                });
            }
        },

        /**
         * Selects the content of the input on focus.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleFocus: function (event) {
            var node = this.refs.input.getDOMNode();

            node.selectionStart = 0;
            node.selectionEnd = event.target.value.length;

            this.props.onFocus(event);
        },

        /**
         * Calls onAccept handler when focus is taken from the TextInput
         * @private
         */
        _handleBlur: function (event) {
            if (this.state.editing) {
                this._commit(event, true);
            }

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
                    break;
                case "Return":
                case "Enter":
                    this._commit(event);
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
         */
        _beginEdit: function () {
            if (!this.props.editable) {
                return;
            }

            var node = this.refs.input.getDOMNode();
            node.removeAttribute("readOnly");
            node.removeAttribute("disabled");
            node.focus();

            this.setState({
                editing: true,
                select: true
            });
            this.acquireFocus();
        },

        /**
         * Begin editing if not in single-click-edit mode.
         *
         * @param {SyntheticEvent} event
         */
        _handleDoubleClick: function (event) {
            if (!this.props.singleClick) {
                this._beginEdit();
            }

            if (this.props.onDoubleClick) {
                this.props.onDoubleClick(event);
            }
        },

        /**
         * Begin editing if in single-click-edit mode.
         *
         * @param {SyntheticEvent} event
         */
        _handleClick: function (event) {
            if (this.props.singleClick) {
                this._beginEdit();
            }

            if (this.props.onClick) {
                this.props.onClick(event);
            }
        },

        /**
         * Stop event propagation during editing to prevent drag start.
         *
         * @param {SyntheticEvent} event
         */
        _handleMouseDown: function (event) {
            event.stopPropagation();
        },

        render: function () {
            var classNameSet = {};
            
            if (_typeToClass.hasOwnProperty()) {
                classNameSet[_typeToClass[this.props.valueType]] = true;
            }

            if (this.props.className) {
                classNameSet[this.props.className] = true;
            }

            if (this.props.size) {
                classNameSet[this.props.size] = true;
            }

            var className = React.addons.classSet(classNameSet);
            if (this.state.editing || this.props.live) {
                return (
                    <input
                        {...this.props}
                        type="text"
                        ref="input"
                        readOnly={false}
                        value={this.state.value}
                        className={className}
                        onChange={this._handleChange}
                        onKeyDown={this._handleKeyDown}
                        onFocus={this._handleFocus}
                        onBlur={this._handleBlur}
                        onPaste={this._handleChange}
                        onMouseDown={this._handleMouseDown}>
                    </input>
                );
            } else {
                return (
                    <input
                        {...this.props}
                        type="text"
                        tabIndex="-1"
                        ref="input"
                        value={this.state.value}
                        disabled="disabled"
                        readOnly={true}
                        className={className}
                        onDoubleClick={this._handleDoubleClick}
                        onClick={this._handleClick}>
                    </input>
                );
            }
        }
    });

    module.exports = TextInput;
});
