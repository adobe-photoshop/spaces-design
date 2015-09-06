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
        classnames = require("classnames"),
        _ = require("lodash");

    var TextInput = require("jsx!js/jsx/shared/TextInput"),
        Select = require("jsx!js/jsx/shared/Select"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        collection = require("js/util/collection");

    /**
     * Approximates an HTML <datalist> element. (CEF does not support datalist
     * in off-screen rendering mode.)
     */
    var Datalist = React.createClass({
        propTypes: {
            options: React.PropTypes.instanceOf(Immutable.List),
            // ID of the item that should initially be selected
            defaultSelected: React.PropTypes.string,
            // Initial text value to display.  TODO: explain how this behaves differently based on other options
            value: React.PropTypes.string,
            // Callback to handle change of selection. Return false will cancel the selection.
            onChange: React.PropTypes.func,
            // If true, mouse over selection will fire invoke the onChange callback.
            live: React.PropTypes.bool,
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
            // If true, mouse over an item will automatically select it and trigger the onChange callback.
            autoSelect: React.PropTypes.bool,
            // IDs of items that, when selected, won't close the dialog
            dontCloseDialogIDs: React.PropTypes.arrayOf(React.PropTypes.string),
            // SVG class for an icon to show next to the Text Input
            filterIcon: React.PropTypes.string
        },

        getDefaultProps: function () {
            return {
                onChange: _.identity,
                defaultSelected: null,
                live: true,
                startFocused: false,
                placeholderText: "",
                useAutofill: false,
                neverSelectAllInput: false,
                dontCloseDialogIDs: [],
                filterIcon: null,
                autoSelect: true
            };
        },

        getInitialState: function () {
            return {
                active: false,
                // Corresponds with value of the text input
                filter: "",
                // ID of the selected item
                id: this.props.defaultSelected,
                // If using autofill, the full title of the suggested option
                suggestTitle: ""
            };
        },

        componentWillReceiveProps: function (nextProps) {
            if (nextProps.defaultSelected && nextProps.defaultSelected !== this.state.id) {
                this.setState({
                    id: null
                });
            }
        },

        componentDidMount: function () {
            if (this.props.startFocused) {
                this.refs.textInput._beginEdit();
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            if (this.props.live && this.state.id !== nextState.id) {
                return true;
            }

            return (this.props.options !== nextProps.options ||
                this.state.filter !== nextState.filter ||
                this.state.active !== nextState.active ||
                this.state.suggestTitle !== nextState.suggestTitle ||
                this.props.value !== nextProps.value);
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
                case "Tab":
                    this._handleInputClick(event);
                    event.preventDefault();
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
            case "Tab":
                // Check if ID should close the dialog or not
                if (!this.props.live && this.props.onKeyDown &&
                        this.state.id && _.contains(this.props.dontCloseDialogIDs, this.state.id)) {
                    this.props.onKeyDown(event);
                    event.preventDefault();
                    return;
                } else {
                    select.close(event, "apply");
                    if (dialog && dialog.isOpen()) {
                        dialog.toggle(event);
                    }
                }
                break;
            case "Enter":
            case "Return":
                // Check if ID should close the dialog or not
                if (!this.props.live && this.props.onKeyDown &&
                        this.state.id && _.contains(this.props.dontCloseDialogIDs, this.state.id)) {
                    this.props.onKeyDown(event);
                    return;
                } else {
                    select.close(event, "apply");
                    if (dialog && dialog.isOpen()) {
                        dialog.toggle(event);
                    }
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
         * act accordingly. Returning false from the change event callback will discard the
         * change.
         *
         * @param {string} id - The id of the currently selected option
         * @param {boolean} force - Force to trigger a change event and accept the new id.
         */
        _handleSelectChange: function (id, force) {
            var confirmSelection = true;

            if ((this.props.live || force) && (!this.props.defaultSelected || this.props.defaultSelected !== id)) {
                confirmSelection = (this.props.onChange(id) !== false);
            }

            if (confirmSelection) {
                if (this.props.autoSelect || force) {
                    this.setState({
                        id: id
                    });
                } else {
                    this._lastSelectedID = id;
                }
            }
        },

        /**
         * Deactivates the datalist when the select menu is closed.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {string} action Either "apply" or "cancel"
         */
        _handleSelectClick: function (event, action) {
            // If this select component is not live, call onChange handler here
            if (!this.props.live || !this.props.autoSelect) {
                var selectedID = action !== "apply" ? null : this._lastSelectedID || this.state.id;

                this._handleSelectChange(selectedID, true);
                this._lastSelectedID = null;
            }

            var dontCloseDialog = _.contains(this.props.dontCloseDialogIDs, this.state.id);

            if (!dontCloseDialog) {
                var dialog = this.refs.dialog;
                if (dialog && dialog.isOpen()) {
                    dialog.toggle(event);
                }

                this._handleDialogClose();
            }
        },

        /** @ignore */
        _handleSelectClose: function (event, action) {
            if (this.props.autoSelect) {
                this._handleSelectClick(event, action);
            }
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

            if (this.state.filter !== value) {
                this._updateAutofill(value);
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
                return this.props.filterOptions(filter, this.state.id, truncate);
            }

            if (filter.length === 0) {
                return options;
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
            var hiddenInput = React.findDOMNode(this.refs.hiddenTextInput),
                textInput = React.findDOMNode(this.refs.textInput);
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
                        var style = React.findDOMNode(this.refs.autocomplete).style;
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
                            opt.title.toLowerCase().indexOf(lastWord) === 0);
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
                    id: suggestionID,
                    suggestTitle: suggestionTitle
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
                this.refs.textInput._beginEdit();
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
                this.refs.textInput._beginEdit();
            }
        },

        /**
         * Returns the currently selected id
         *
         * @return {string}
         */
        getSelected: function () {
            return this.state.id;
        },

        /**
         * Returns the currently filter
         *
         * @return {string}
         */
        getInputValue: function () {
            return this.state.filter;
        },

        render: function () {
            // HACK - Because Select has no correspondence between ID and title
            // during selection methods, only when the Datalist component is not live
            // we manually set the shown value of the input to the selected option's title
            // This can be an expensive operation when options is big enough, so
            // use carefully. If we are using autocomplete, then we can use the suggestion
            // title, since it corresponds with the current ID.
            var current,
                currentTitle = this.props.value;

            if (!this.props.live) {
                if (this.state.suggestTitle !== "") {
                    currentTitle = this.state.suggestTitle;
                } else if (!this.props.useAutofill) {
                    current = this.props.options.find(function (option) {
                        return option.id === this.state.id;
                    }.bind(this));

                    currentTitle = current ? current.title : this.props.value;
                }
            }

            var value = currentTitle || "",
                filter = this.state.filter,
                title = this.state.active && filter !== "" ? filter : value,
                searchableFilter = filter.toLowerCase(),
                filteredOptions = this._filterOptions(searchableFilter, true),
                searchableOptions = filteredOptions;

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
                        id={"datalist-" + this.props.list}
                        className={this.props.className}
                        onClose={this._handleDialogClose}>
                        <Select
                            ref="select"
                            options={searchableOptions}
                            defaultSelected={this.props.defaultSelected || this.state.id}
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
                <div className={dropDownClasses}>
                    {svg}
                    {hiddenTI}
                    <TextInput
                        ref="textInput"
                        disabled={this.props.disabled}
                        editable={!this.props.disabled}
                        size={size}
                        live={true}
                        continuous={true}
                        value={title}
                        placeholderText={this.props.placeholderText}
                        neverSelectAll={this.props.neverSelectAllInput}
                        onFocus={this._handleInputFocus}
                        onKeyDown={this._handleInputKeyDown}
                        onChange={this._handleInputChange}
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
