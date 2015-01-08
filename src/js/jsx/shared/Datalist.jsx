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
            options: React.PropTypes.instanceOf(Immutable.Iterable)
        },

        getDefaultProps: function () {
            return {
                onChange: _.identity,
                defaultSelected: null
            };
        },

        getInitialState: function () {
            return {
                active: false,
                filter: "",
                id: this.props.defaultSelected
            };
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
                    filter: ""
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
         * Enables keyboard navigation of the open select menu.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleInputKeyDown: function (event) {
            var dialog = this.refs.dialog,
                select = this.refs.select;

            switch (event.key) {
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
            case "Space":
            case "Escape":
                select.close(event);
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
         * When the selection changes, fire a change event so the parent can
         * act accordingly.
         * 
         * @param {string} id The id of the currently selected option
         */
        _handleSelectChange: function (id) {
            this.setState({
                id: id
            });

            this.props.onChange(id);
        },

        /**
         * Deactivates the datalist when the select menu is closed.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleSelectClose: function (event) {
            var dialog = this.refs.dialog;
            if (dialog && dialog.isOpen()) {
                dialog.toggle(event);
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

        render: function () {
            var value = this.props.value || "",
                title = this.state.active ? this.state.filter : value,
                filter = this.state.filter.toLowerCase(),
                options = this.props.options,
                searchableOptions = options && options.filter(function (option) {
                    return option.title.toLowerCase().indexOf(filter) > -1;
                });

            var dialog;
            if (!searchableOptions) {
                dialog = null;
            } else {
                dialog = (
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
                            onClose={this._handleSelectClose} />
                    </Dialog>
                );
            }

            return (
                <div className="drop-down">
                    <TextInput
                        title={this.props.title}
                        disabled={this.props.disabled}
                        editable={!this.props.disabled}
                        size={this.props.size}
                        live={true}
                        value={title}
                        onKeyDown={this._handleInputKeyDown}
                        onChange={this._handleInputChange}
                        onClick={this._handleInputClick} />
                    {dialog}
                </div>
            );
        },
    });

    module.exports = Datalist;
});
