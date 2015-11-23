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
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var Focusable = require("../mixin/Focusable");

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
        mixins: [Focusable, FluxMixin],

        /**
         * Once after focus, whether to suppress mouseup
         * to maintain the initial selection.
         *
         * @private
         * @type {boolean}
         */
        _suppressMouseUp: false,

        propTypes: {
            value: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired,
            onDOMChange: React.PropTypes.func,
            onFocus: React.PropTypes.func,
            editable: React.PropTypes.bool,
            placeholderText: React.PropTypes.string,
            
            // prevent the text input from scrolling horizontally when it is not editable.
            preventHorizontalScrolling: React.PropTypes.bool,
            
            // never highlight text, regardless of this.state.selectDisabled
            neverSelectAll: React.PropTypes.bool
        },

        getDefaultProps: function () {
            return {
                value: "",
                onChange: _.identity,
                onDOMChange: _.identity,
                onFocus: _.identity,
                editable: false,
                live: false,
                continuous: false,
                placeholderText: "",
                neverSelectAll: false
            };
        },

        getInitialState: function () {
            return {
                editing: false,
                value: this.props.value,
                selectDisabled: true
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return !Immutable.is(this.props.value, nextProps.value) ||
                !Immutable.is(this.state.value, nextState.value) ||
                !Immutable.is(this.props.placeholderText, nextProps.placeholderText) ||
                this.props.title !== nextProps.title ||
                this.state.editing !== nextState.editing;
        },

        componentWillReceiveProps: function (nextProps) {
            if (nextProps.hasOwnProperty("value")) {
                this.setState({
                    value: nextProps.value
                });
            }

            var node = React.findDOMNode(this.refs.input);
            if (window.document.activeElement === node &&
                    node.selectionStart === 0 &&
                    node.selectionEnd === node.value.length) {
                this.setState({
                    selectDisabled: false
                });
            }
        },

        componentDidUpdate: function () {
            var node = React.findDOMNode(this.refs.input);

            if (this.state.editing) {
                node.removeAttribute("readOnly");
                node.removeAttribute("disabled");
                node.focus();
            }

            if (!this.state.selectDisabled && !this.props.neverSelectAll) {
                if (window.document.activeElement === node) {
                    // If the component updated and there is selection state, restore it
                    node.setSelectionRange(0, node.value.length);
                }
                this.setState({
                    selectDisabled: true
                });
            }
        },
        
        /**
         * Return the text input's current value
         * 
         * @return {string}
         */
        getValue: function () {
            return this.state.value;
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
                selectDisabled: true
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
            this.releaseFocus()
                .bind(this)
                .finally(function () {
                    // HACK: this needs to wait for the next tick of the event loop,
                    // otherwise the blur handler will be executed before the edit
                    // state has been updated.
                    if (this.refs.input) {
                        React.findDOMNode(this.refs.input).blur();
                    }
                });
        },

        /**
         * Finish editing the text in put and release focus.
         */
        finish: function () {
            this.setState({
                value: this.props.value,
                editing: false,
                selectDisabled: false
            });

            this._releaseFocus();
        },

        /**
         * Resets the text field to its last committed value.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _reset: function (event) {
            event.stopPropagation();
            this.finish();
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

            if (nextValue !== this.props.value) {
                this.props.onChange(event, nextValue);
            }

            if (!this.state.editing) {
                this._releaseFocus();
            } else {
                this.setState({
                    selectDisabled: false
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
            var node = React.findDOMNode(this.refs.input);
            if (!this.props.neverSelectAll) {
                node.selectionStart = 0;
                node.selectionEnd = event.target.value.length;
            }

            this.props.onFocus(event);
        },

        /**
         * Calls onAccept handler when focus is taken from the TextInput
         * @private
         */
        _handleBlur: function (event) {
            if (this.state.editing) {
                this._commit(event);
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
         * Focus the input element and begin editing if necessary.
         */
        focus: function () {
            var node = React.findDOMNode(this.refs.input);
            if (!node) {
                return;
            }

            node.focus();
            if (!this.editing && !this.selectDisabled) {
                this._beginEdit();
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

            this.acquireFocus()
                .bind(this)
                .then(function () {
                    this.setState({
                        editing: true,
                        selectDisabled: false
                    });
                });
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
         * Stop event propagation during editing to prevent drag start. Also
         * record whether or not the successive mouseup event should be suppressed.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseDown: function (event) {
            if (window.document.activeElement !== React.findDOMNode(this)) {
                this._suppressMouseUp = true;
            }

            event.stopPropagation();
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
        
        /**
         * When TextInput is not editable, prevent it from scrolling horizontally 
         * by preventing the default wheel action if there is a non-zero deltaX 
         * and instead firing a new wheel action with deltaX set to 0.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleWheel: function (event) {
            if (this.props.preventHorizontalScrolling) {
                if (event.deltaX) {
                    var nativeEvent = event.nativeEvent,
                        domEvent = new window.WheelEvent(event.type, {
                            deltaX: 0.0,
                            deltaY: nativeEvent.deltaY
                        });

                    event.preventDefault();
                    event.target.dispatchEvent(domEvent);
                }
            }
        },

        render: function () {
            var className = classnames(_typeToClass[this.props.valueType], this.props.className, this.props.size);

            if (this.state.editing || this.props.live) {
                return (
                    <input
                        {...this.props}
                        type="text"
                        ref="input"
                        readOnly={false}
                        spellCheck="false"
                        value={this.state.value}
                        className={className}
                        placeholder={this.props.placeholderText}
                        onChange={this._handleChange}
                        onKeyDown={this._handleKeyDown}
                        onFocus={this._handleFocus}
                        onBlur={this._handleBlur}
                        onCut={this._handleChange}
                        onPaste={this._handleChange}
                        onMouseUp={this._handleMouseUp}
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
                        spellCheck="false"
                        value={this.state.value}
                        disabled="disabled"
                        readOnly={true}
                        className={className}
                        onDoubleClick={this._handleDoubleClick}
                        onClick={this._handleClick}
                        onWheel={this._handleWheel}>
                    </input>
                );
            }
        },

        /**
         * Is the TextInput currently being edited?
         *
         * @return {boolean}
         */
        isEditing: function () {
            return this.state.editing || this.props.live;
        },

        /**
         * Index of cursor within the input
         *
         * @return {number}
         */
        cursorLocation: function () {
            if (this.refs.input) {
                var node = React.findDOMNode(this.refs.input);
                return node.selectionEnd;
            }
            return -1;
        }
    });

    module.exports = TextInput;
});
