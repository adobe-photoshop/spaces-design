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
        ReactDOM = require("react-dom"),
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var TextInput = require("js/jsx/shared/TextInput"),
        Select = require("js/jsx/shared/Select"),
        Dialog = require("js/jsx/shared/Dialog"),
        SVGIcon = require("js/jsx/shared/SVGIcon"),
        collection = require("js/util/collection");

    /**
     * Approximates an HTML <datalist> element. (CEF does not support datalist
     * in off-screen rendering mode.)
     */
    var Datalist = React.createClass({
        propTypes: {
            options: React.PropTypes.instanceOf(Immutable.List),
            // ID of the item that is currently selected
            selected: React.PropTypes.string,
            // Initial text value to display.  TODO: explain how this behaves differently based on other options
            value: React.PropTypes.string,
            // If true, text input will get focus when Datalist is mounted or reset
            startFocused: React.PropTypes.bool,
            // Filler text for input when nothing has been typed
            placeholderText: React.PropTypes.string,
            // Option to render when there are no other valid options to display
            placeholderOption: React.PropTypes.object,
            // If true, displays a suggested option next to the inputted text
            useAutofill: React.PropTypes.bool,
            // If true, will not highlight input text on commit
            neverSelectAllInput: React.PropTypes.bool,
            // SVG class for an icon to show next to the Text Input
            filterIcon: React.PropTypes.string,
            // Release keyboard focus when the text input is blurred.
            releaseOnBlur: React.PropTypes.bool,
            // Emit a change event when the input blurs
            changeOnBlur: React.PropTypes.bool,
            
            /**
             * Callback to handle change of selection. This event is fired when the user confirm selection of the 
             * highlighted option. For example, when user click on the option, or hit Return/Enter/Tab.
             * 
             * @callback Datalist~onChange
             * @param {string} selectedID - the ID of the selected option
             * @return {{dontCloseDialog: boolean}=} - if dontCloseDialog is true, the dropdown list will not 
             *                                         close automatically. 
             */
            onChange: React.PropTypes.func,

            /**
             * Callback to handle input change
             * 
             * @callback Datalist~onChange
             * @param {string} value - the current value of the input
             */
            onInputChange: React.PropTypes.func,
            
            /**
             * Callback to handle input keydown
             * 
             * @callback Datalist~onKeyDown
             * @param {SyntheticEvent} event
             * @param {string} highlightedID - the current highlighted ID
             * @return {{preventListDefault: boolean}=} - use preventListDefault option to prevent the default action 
             *                                            of the list.
             */
            onKeyDown: React.PropTypes.func,

            /**
             * Callback to handle change of highlighted option.
             * 
             * @callback Datalist~onHighlightedChange
             * @param {string} highlightedID
             */
            onHighlightedChange: React.PropTypes.func,

            /**
             * Callback to handle input focus
             * 
             * @callback Datalist~onFocus
             * @param {SyntheticEvent} event
             */
            onFocus: React.PropTypes.func,
            
            /**
             * Callback to handle dropdown list close.
             * 
             * @callback Datalist~onClose
             * @param {boolean} applied - true if confirm selection of the highlighted option.
             * @param {string} initialSelectedID - the initial selected ID when the dropdown list is opened.
             * @param {string} lastHighlightedID - the last highlighted ID. This is equal to initialSelectedID 
             *                                     if the selection is confirmed (with onChange event fired).
             */
            onClose: React.PropTypes.func
        },

        /**
         * A unique key to append the Dialog ID. 
         * This is a simple solution to prevent collision of dialog ID names when
         * a component doesn't unmount before another instance mounts
         *
         * @private
         * @type {Number}
         */
        _uniqkey: null,
        
        /**
         * The initial selected ID when the dropdown list is open. 
         *
         * @private
         * @type {string}
         */
        _initialSelectedID: null,
        
        /**
         * True if the last highlighted ID is applied.
         *
         * @private
         * @type {boolean}
         */
        _isApplied: false,

        getDefaultProps: function () {
            return {
                selected: null,
                startFocused: false,
                placeholderText: "",
                useAutofill: false,
                neverSelectAllInput: false,
                dontCloseDialogIDs: [],
                filterIcon: null,
                changeOnBlur: true,
                onChange: _.noop,
                onHighlightedChange: _.noop,
                onListOpen: _.noop,
                onClose: _.noop,
                onKeyDown: _.noop
            };
        },

        getInitialState: function () {
            return {
                active: false,
                // Corresponds with value of the text input
                filter: "",
                // If using autofill, the full title of the suggested option
                suggestTitle: "",
                suggestID: null,
                lastHighlightedID: null
            };
        },

        componentWillReceiveProps: function (nextProps) {
            if (this.props.selected !== nextProps.selected) {
                this.setState({
                    lastHighlightedID: nextProps.selected
                });
            }
        },

        componentWillMount: function () {
            this._uniqkey = (new Date()).getTime();
        },

        componentDidMount: function () {
            if (this.props.startFocused) {
                this.focus();
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return (
                (this.props.selected !== nextProps.selected && nextProps.selected !== nextState.lastHighlightedID) ||
                this.props.value !== nextProps.value ||
                this.props.placeholderText !== nextProps.placeholderText ||
                this.state.filter !== nextState.filter ||
                this.state.active !== nextState.active ||
                this.state.suggestTitle !== nextState.suggestTitle ||
                this.state.lastHighlightedID !== nextState.lastHighlightedID ||
                !Immutable.is(this.props.options, nextProps.options)
            );
        },

        componentDidUpdate: function () {
            this._updateAutofillPosition();
        },

        /**
         * Returns true if the TextInput has a value other than ""
         *
         */
        cursorAtBeginning: function () {
            return this.refs.textInput.cursorLocation() === 0;
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
                        filter: ""
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

            if (dialog.isOpen() && this.props.changeOnBlur) {
                dialog.toggle(event);
            }

            if (this.props.releaseOnBlur) {
                // Blur the text input and release focus.
                this.refs.textInput.finish();
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
                    this.props.onKeyDown(event, this.state.lastHighlightedID);
                    return;
                case "Tab":
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

            var cbOptions = this.props.onKeyDown(event, this.state.lastHighlightedID),
                options = _.merge({ preventListDefault: false }, cbOptions);

            if (!options.preventListDefault) {
                switch (event.key) {
                case "ArrowUp":
                    select.selectPrev();
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                case "ArrowDown":
                    select.selectNext();
                    event.preventDefault();
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
                case "Tab":
                    select.close(event, "cancel");
                    if (dialog && dialog.isOpen()) {
                        dialog.toggle(event);
                    }
                    break;
                }
            }
        },

        /**
         * Handle change of higlighted option.
         * 
         * @param {string} id - The id of the currently selected option
         */
        _handleSelectChange: function (id) {
            this.setState({
                lastHighlightedID: id
            });

            this.props.onHighlightedChange(id);
        },

        /**
         * Deactivates the datalist when the select menu is clicked.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {string} action Either "apply" or "cancel"
         */
        _handleSelectClick: function (event, action) {
            var selectedID = action !== "apply" ? null : this.state.lastHighlightedID,
                options = _.merge({ dontCloseDialog: false }, this.props.onChange(selectedID));

            if (!options.dontCloseDialog) {
                var dialog = this.refs.dialog;
                if (dialog && dialog.isOpen()) {
                    dialog.toggle(event);
                }
                
                this._isApplied = true;
                this._handleDialogClose();
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
            if (action === "apply") {
                this._handleSelectClick(event, action);
            }
            
            this._isApplied = false;
        },

        /**
         * Deactivates the datalist when the dialog that contains the select
         * menu is closed.
         *
         * @private
         */
        _handleDialogClose: function () {
            this.props.onClose(this._isApplied, this._initialSelectedID, this.state.lastHighlightedID);
            this._initialSelectedID = null;
            this._isApplied = false;
            
            this.setState({
                active: false,
                lastHighlightedID: null
            });
        },
        
        /**
         * Handle dialog open.
         * 
         * @private
         */
        _handleDialogOpen: function () {
            this._initialSelectedID = this.props.selected;
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

            if (this.state.filter !== value) {
                this._updateAutofill(value);
            }
            
            if (this.props.onInputChange) {
                this.props.onInputChange(value);
            }
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

        /**
         * Find options that are valid for the current text input value (filter)
         *
         * @private
         * @param {string} filter
         * @param {boolean} truncate Whether or not to restrict number of options
         * @return {Immutable.List.<object>}
         */
        _filterOptions: function (filter, truncate) {
            var options = this.props.options;

            if (this.props.filterOptions) {
                return this.props.filterOptions(filter, this.state.suggestID, truncate);
            }

            if (filter.length === 0) {
                return options && options.filter(function (option) {
                    return !option.hidden;
                });
            }

            return options && options.filter(function (option) {
                if (option.searchable === false) {
                    return false;
                }

                // Always add headers to list of searchable options
                // The check to not render if there are no options below it is in Select.jsx
                if (option.type === "header" || option.type === "placeholder") {
                    return true;
                }

                var title = option.title.toLowerCase();

                return title.indexOf(filter) > -1 && option.hidden !== true;
            });
        },

        /**
         * Updates position and width of autofill using hidden HTML element.
         *
         * @private
         */
        _updateAutofillPosition: function () {
            // Base position and width off of hidden element width
            var hiddenInput = ReactDOM.findDOMNode(this.refs.hiddenTextInput),
                textInput = ReactDOM.findDOMNode(this.refs.textInput);
            if (hiddenInput) {
                // Find width for hidden text input
                var hiddenElRect = hiddenInput.getBoundingClientRect(),
                    parentEl = hiddenInput.offsetParent;
                // parentEl may not exist, for example when hitting escape
                if (parentEl) {
                    var parentRect = parentEl.getBoundingClientRect(),
                        hiddenWidth = hiddenElRect.width + (hiddenElRect.left - parentRect.left);

                    var suggestionWidth = textInput.getBoundingClientRect().width - hiddenElRect.width;

                    if (this.refs.autocomplete) {
                        var style = ReactDOM.findDOMNode(this.refs.autocomplete).style;
                        if (suggestionWidth > 0) {
                            style.left = hiddenWidth + "px";
                            style.width = suggestionWidth + "px";
                            style.visibility = "visible";
                        } else {
                            style.visibility = "hidden";
                        }
                    }
                }
            }
        },

        /**
         * Update state for autofill. Finds new suggestion and sets its position
         *
         * @private
         * @param {string} value The current value of the input
         */
        _updateAutofill: function (value) {
            if (this.props.useAutofill) {
                // Find new autofill suggestion
                var valueLowerCase = value ? value.toLowerCase() : "",
                    lastWord = valueLowerCase.split(" ").pop(),
                    options = this._filterOptions(valueLowerCase, false),

                    // First check if there's anything based on the whole search value
                    suggestion = (options && valueLowerCase !== "") ? options.find(function (opt) {
                        return ((opt.type === "item" || opt.type === "filter") &&
                                opt.title.toLowerCase().indexOf(valueLowerCase) === 0);
                    }) : null;

                // Otherwise suggest based on last word typed
                if (!suggestion) {
                    suggestion = (options && lastWord !== "") ? options.find(function (opt) {
                        return ((opt.type === "item" || opt.type === "filter") &&
                            opt.title.toLowerCase().indexOf(lastWord) !== -1);
                    }) : null;
                }

                var suggestionID = suggestion && suggestion.id,
                    suggestionTitle = suggestion ? suggestion.title : "";

                // If all the options are headers (no confirmable options, then set selected ID to null or placeholder
                if (!suggestion && collection.uniformValue(collection.pluck(options, "type"))) {
                    suggestionID = this.props.placeholderOption && this.props.placeholderOption.id;
                }

                this.setState({
                    filter: value,
                    suggestTitle: suggestionTitle,
                    suggestID: suggestionID,
                    lastHighlightedID: suggestionID
                });

                if (this.refs.select) {
                    if (suggestionID) {
                        this.refs.select._setSelected(suggestionID);
                    } else { // If there is no suggestion, select the first selectable option
                        this.refs.select._selectExtreme(options, "next", 0);
                    }
                }
            }
        },

        /**
         * Sets autofill suggestion to empty string and re-renders
         *
         */
        removeAutofillSuggestion: function () {
            if (this.props.useAutofill) {
                this.setState({
                    suggestTitle: ""
                });
            }

            if (this.props.startFocused && this.refs.textInput) {
                this.focus();
            }
        },

        /**
         * Sets filter value without having changed the text input directly
         *
         * @param {Array.<string>} filter
        */
        updateFilter: function (filter) {
            if (filter || filter === "") {
                this._updateAutofill(filter);
            } else {
                this.setState({
                    filter: ""
                });
            }

            if (this.props.startFocused && this.refs.textInput) {
                this.focus();
            }
        },

        /**
         * Returns the current input value
         *
         * @return {string}
         */
        getInputValue: function () {
            return this.refs.textInput.getValue();
        },

        /**
         * Ensure that the child text input has focus.
         */
        focus: function () {
            this.refs.textInput.focus();
        },

        render: function () {
            var currentTitle = this.props.value;

            if (this.state.suggestTitle !== "") {
                currentTitle = this.state.suggestTitle;
            }

            var value = currentTitle || "",
                filter = this.state.filter,
                title = this.state.active && filter !== "" ? filter : value,
                searchableFilter = filter.toLowerCase(),
                filteredOptions = this._filterOptions(searchableFilter, true),
                searchableOptions = filteredOptions,
                selectedID = this.state.lastHighlightedID || this.props.selected;

            // If we only have headers as options, only display the placeholder option, if one exists
            if (filteredOptions && collection.uniformValue(collection.pluck(filteredOptions, "type"))) {
                searchableOptions = Immutable.List.of(this.props.placeholderOption);
            }

            // Use hidden text input to find position of suggestion. It gets the same value as the text input.
            // Then the suggestion gets moved based on its width (in componentDidUpdate), since the TextInput
            // component doesn't have a bounding box that corresponds with the width of the text.
            var hiddenTI = null,
                autocomplete = null;

            if (this.props.useAutofill) {
                hiddenTI = (
                    <div ref="hiddenTextInput"
                        className="hidden-input">
                        {title}
                    </div>
                );

                // Take substring of this.state.suggestTitle so that only display
                // the remaining portion of the title that the user hasn't typed yet
                var suggestTitle = this.state.suggestTitle,
                    suggestTitleLC = suggestTitle.toLowerCase(),
                    titleLC = title.toLowerCase(),
                    wordToComplete = titleLC.split(" ").pop(),
                    suggestion = "";

                if (title.length > 0) {
                    // Take substring based on if autocompleting from whole input or just the last word of input
                    if (wordToComplete !== "" && suggestTitleLC.indexOf(wordToComplete) === 0) {
                        suggestion = suggestTitle.substring(wordToComplete.length);
                    } else if (suggestTitleLC.indexOf(titleLC) === 0) {
                        suggestion = suggestTitle.substring(titleLC.length);
                    }
                }

                autocomplete = (
                    <div ref="autocomplete"
                        className="autocomplete">
                        {suggestion}
                    </div>
                );
            }

            var dialog = searchableOptions && (
                    <Dialog
                        ref="dialog"
                        id={"datalist-" + this.props.list + this._uniqkey}
                        className={this.props.className}
                        onOpen={this._handleDialogOpen}
                        onClose={this._handleDialogClose}>
                        <Select
                            ref="select"
                            options={searchableOptions}
                            defaultSelected={selectedID}
                            useAutofill={this.props.useAutofill}
                            sorted={this.props.sorted}
                            onChange={this._handleSelectChange}
                            onClick={this._handleSelectClick}
                            onClose={this._handleSelectClose} />
                    </Dialog>
                );

            var size = this.props.size,
                svg = null;

            if (this.props.filterIcon) {
                svg = (
                    <SVGIcon
                        className="datalist__svg"
                        ref="svg"
                        CSSID={this.props.filterIcon}
                        viewbox="0 0 24 24"/>
                );
            }

            var dropDownClasses = classnames({
                "drop-down": true,
                "hasIcon": this.props.filterIcon
            });

            return (
                <div
                    className={dropDownClasses}
                    disabled={this.props.disabled}>
                    {svg}
                    {hiddenTI}
                    <TextInput
                        ref="textInput"
                        disabled={this.props.disabled}
                        size={size}
                        value={title}
                        placeholder={this.props.placeholderText}
                        neverSelectAll={this.props.neverSelectAllInput}
                        onFocus={this._handleInputFocus}
                        onBlur={this._handleInputBlur}
                        onKeyDown={this._handleInputKeyDown}
                        onInputChange={this._handleInputChange}
                        onDOMChange={this._handleInputDOMChange}
                        onClick={this._handleInputClick} />
                    {autocomplete}
                    {dialog}
                </div>
            );
        }
    });

    module.exports = Datalist;
});
