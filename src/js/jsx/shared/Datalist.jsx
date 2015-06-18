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

    var TextInput = require("jsx!js/jsx/shared/TextInput"),
        Select = require("jsx!js/jsx/shared/Select"),
        Dialog = require("jsx!js/jsx/shared/Dialog");

    /**
     * Approximates an HTML <datalist> element. (CEF does not support datalist
     * in off-screen rendering mode.)
     */
    var Datalist = React.createClass({
        propTypes: {
            options: React.PropTypes.instanceOf(Immutable.Iterable),
            live: React.PropTypes.bool,
            startFocused: React.PropTypes.bool,
            placeholderText: React.PropTypes.string
        },

        getDefaultProps: function () {
            return {
                onChange: _.identity,
                defaultSelected: null,
                live: true,
                startFocused: false,
                placeholderText: ""
            };
        },

        getInitialState: function () {
            return {
                active: false,
                filter: null,
                id: this.props.defaultSelected
            };
        },

        componentDidMount: function () {
            if (this.props.startFocused) {
                this.refs.textInput._beginEdit();
            }
        },

        /**
         * Returns true if the TextInput has a value other than ""
         *
         */
        hasNonEmptyInput: function () {
            return this.refs.textInput.hasValue();
        },

        /**
         * On click, if initially inactive, the filter is initialized to the
         * empty string and the dialog that contains the select menu component
         * is opened.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleInputClick: function (event) {
            if (this.props.disabled) {
                return;
            }

            if (!this.state.active) {
                this.setState({
                    active: true,
                    filter: null
                });
            }

            var dialog = this.refs.dialog;
            if (!dialog) {
                return;
            }

            if (dialog.isOpen()) {
                event.stopPropagation();
            } else {
                dialog.toggle(event);
            }
        },

        /**
         * Activate the Datalist on focus.
         *
         * @param {SyntheticEvent} event
         */
        _handleInputFocus: function (event) {
            var select = this.refs.select;
            if (!select) {
                // the select box is not yet open; treat it like an input click
                if (!this.state.active) {
                    this.setState({
                        active: true,
                        filter: null
                    });
                }
            }

            if (this.props.onFocus) {
                this.props.onFocus(event);
            }
        },

        /**
         * Close the dialog if necessary.
         *
         * @param {Event} event
         */
        _handleInputBlur: function (event) {
            var dialog = this.refs.dialog;
            if (!dialog) {
                return;
            }

            if (dialog.isOpen()) {
                dialog.toggle(event);
            }

            if (!this.props.live && this.state.id) {
                this.props.onChange(this.state.id);
            }
        },

        /**
         * Enables keyboard navigation of the open select menu.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleInputKeyDown: function (event) {
            var dialog = this.refs.dialog,
                select = this.refs.select;

            if (!select) {
                switch (event.key) {
                case "Escape":
                    if (!this.props.live) {
                        this.props.onChange(null);
                    }
                    return;
                case "Enter":
                case "Return":
                case "Space":
                case "ArrowUp":
                case "ArrowDown":
                    this._handleInputClick(event);
                    return;
                }
            }

            switch (event.key) {
            case "Tab": {
                if (!this.props.live) {
                    select.close(event, "apply");
                    if (dialog && dialog.isOpen()) {
                        dialog.toggle(event);
                    }
                    event.preventDefault();
                }
                break;
            }
            case "ArrowUp":
                select.selectPrev();
                event.stopPropagation();
                break;
            case "ArrowDown":
                select.selectNext();
                event.stopPropagation();
                break;
            case "Enter":
            case "Return":
                select.close(event, "apply");
                if (dialog && dialog.isOpen()) {
                    dialog.toggle(event);
                }
                break;
            case "Space":
            case "Escape":
                select.close(event, "cancel");
                if (dialog && dialog.isOpen()) {
                    dialog.toggle(event);
                }
                break;
            }

            if (this.props.onKeyDown) {
                this.props.onKeyDown(event);
            }
        },

        /**
         * When the selection changes, if live, fire a change event so the parent can
         * act accordingly.
         * 
         * @param {string} id The id of the currently selected option
         */
        _handleSelectChange: function (id) {
            this.setState({
                id: id
            });
            
            if (this.props.live) {
                this.props.onChange(id);
            }
        },

        /**
         * Deactivates the datalist when the select menu is closed.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {string} action Either "apply" or "cancel"
         */
        _handleSelectClose: function (event, action) {
            var dialog = this.refs.dialog;
            if (dialog && dialog.isOpen()) {
                dialog.toggle(event);
            }

            // If this select component is not live, call onChange handler here
            if (!this.props.live) {
                if (action === "apply") {
                    this.props.onChange(this.state.id);
                } else {
                    this.props.onChange(null);
                }
            }

            this.setState({
                active: false
            });
        },

        /**
         * Deactivates the datalist when the dialog that contains the select
         * menu is closed.
         * 
         * @private
         */
        _handleDialogClose: function () {
            this.setState({
                active: false
            });
        },

        /**
         * When the input changes, update the filter value.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {string} value
         */
        _handleInputChange: function (event, value) {
            this.setState({
                filter: value
            });
        },

        /**
         * If the select menu is closed, open it if the underlying input receives
         * any "change" event.
         *
         * @private
         * @param {Event} event
         */
        _handleInputDOMChange: function (event) {
            var select = this.refs.select;
            if (!select) {
                this._handleInputClick(event);
            }
        },

        _filterOptions: function (filter) {
            var options = this.props.options;

            if (this.props.filter) {
                var toFilter = this.props.filter(options, filter);
                return toFilter;
            }

            return options && options.filter(function (option) {
                    // Always add headers to list of searchable options
                    // The check to not render if there are no options below it is in Select.jsx
                    if (option.type && option.type === "header") {
                        return true;
                    }

                    var title = option.title.toLowerCase();

                    return title.indexOf(filter) > -1 && option.hidden !== true;
                });
        },

        render: function () {
            // HACK - Because Select has no correspondence between ID and title
            // during selection methods, only when the Datalist component is not live
            // we manually set the shown value of the input to the selected option's title
            // This can be an expensive operation when options is big enough, so 
            // use carefully.
            var current;
            if (!this.props.live) {
                current = this.props.options.find(function (option) {
                    return option.id === this.state.id;
                }.bind(this));
            }

            var live = this.props.live,
                currentTitle = current ? current.title : this.props.value,
                value = (live ? this.props.value : currentTitle) || "",
                filter = this.state.filter,
                title = this.state.active && filter !== null ? filter : value,
                searchableFilter = filter ? filter.toLowerCase() : "",
                searchableOptions = this._filterOptions(searchableFilter);

            var dialog = searchableOptions && (
                <Dialog
                    ref="dialog"
                    id={"datalist-" + this.props.list}
                    className={this.props.className}
                    onClose={this._handleDialogClose}>
                    <Select
                        ref="select"
                        options={searchableOptions}
                        defaultSelected={this.props.defaultSelected}
                        sorted={this.props.sorted}
                        onChange={this._handleSelectChange}
                        onClick={this._handleSelectClose}
                        onClose={this._handleSelectClose} />
                </Dialog>
            );

            return (
                <div className="drop-down">
                    <TextInput
                        ref="textInput"
                        disabled={this.props.disabled}
                        editable={!this.props.disabled}
                        size={this.props.size}
                        live={true}
                        continuous={true}
                        value={title}
                        placeholderText={this.props.placeholderText}
                        onFocus={this._handleInputFocus}
                        onKeyDown={this._handleInputKeyDown}
                        onChange={this._handleInputChange}
                        onDOMChange={this._handleInputDOMChange}
                        onClick={this._handleInputClick} />
                    {dialog}
                </div>
            );
        }
    });

    module.exports = Datalist;
});
