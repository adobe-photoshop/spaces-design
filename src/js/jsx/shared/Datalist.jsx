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
        _ = require("lodash"),
        collection = require("js/util/collection");

    var TextInput = require("jsx!js/jsx/shared/TextInput"),
        Select = require("jsx!js/jsx/shared/Select"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon");

    /**
     * Approximates an HTML <datalist> element. (CEF does not support datalist
     * in off-screen rendering mode.)
     */
    var Datalist = React.createClass({
        propTypes: {
            options: React.PropTypes.instanceOf(Immutable.Iterable),
            live: React.PropTypes.bool,
            startFocused: React.PropTypes.bool,
            placeholderText: React.PropTypes.string,
            useAutofill: React.PropTypes.bool
        },

        getDefaultProps: function () {
            return {
                onChange: _.identity,
                defaultSelected: null,
                live: true,
                startFocused: false,
                placeholderText: "",
                useAutofill: false
            };
        },

        getInitialState: function () {
            return {
                active: false,
                filter: null,
                id: this.props.defaultSelected,
                suggestTitle: "",
                width: 0
            };
        },

        componentDidMount: function () {
            if (this.props.startFocused) {
                this.refs.textInput._beginEdit(true);
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            // Update autofill here so that can check options based on the updated filter
            if (this.state.filter !== nextState.filter) {
                this._updateAutofill(nextState.filter, nextProps.filterIcons.length);
            }
            return true;
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
            case "ArrowUp":
                select.selectPrev();
                event.stopPropagation();
                break;
            case "ArrowDown":
                select.selectNext();
                event.stopPropagation();
                break;
            case "Tab":
                if (!this.props.live && this.props.onKeyDown &&
                        this.state.id.indexOf("filter") === 0) {
                    this.props.onKeyDown(event);
                    event.preventDefault();
                    return;
                } else if (!this.props.live) {
                    select.close(event, "apply");
                    if (dialog && dialog.isOpen()) {
                        dialog.toggle(event);
                    }
                }
                break;
            case "Enter":
            case "Return":
                if (!this.props.live && this.props.onKeyDown &&
                        this.state.id.indexOf("filter") === 0) {
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
            if (this.state.id && this.state.id.indexOf("filter") === 0) {
                this.props.onChange(this.state.id);
                event.stopPropagation();
                return;
            }

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

        /**
         * Find options that are valid for the current text input value (filter)
         *
         * @private
         * @param {string} filter
         * @return {Array<Object>}
         */
        _filterOptions: function (filter) {
            var options = this.props.options;

            if (this.props.filterOptions) {
                return this.props.filterOptions(options, filter);
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

        /**
         * Update state for autofill. Finds the new width of the hidden input and new autofill suggestion
         *
         * @private
         * @param {string} value The current value of the input
         * @param {number} iconCount The number of SVG icons for the input
         */
        _updateAutofill: function (value, iconCount) {
            if (this.props.useAutofill) {
                var hiddenInput = React.findDOMNode(this.refs.hiddenTextInput);
                hiddenInput.innerHTML = value;
                
                // Find width for hidden text input
                var elRect = hiddenInput.getBoundingClientRect(),
                    parentEl = hiddenInput.offsetParent,
                    parentRect = parentEl.getBoundingClientRect(),
                    width = elRect.width + (elRect.left - parentRect.left);
                
                width += 20 * iconCount; // 20 pixels is the computed width + padding of an svg icon

                // Find new autofill suggestion
                // First check if there's anything based on the whole search value
                // Otherwise suggest based on last word typed
                var valueLowerCase = value ? value.toLowerCase() : "",
                    lastWord = valueLowerCase.split(" ").pop(),
                    options = this._filterOptions(valueLowerCase),

                    suggestion = (options && valueLowerCase !== "") ? options.find(function (opt) {
                            return (opt.type === "item" && opt.title.toLowerCase().indexOf(valueLowerCase) === 0);
                        }) : null;

                if (!suggestion) {
                    suggestion = (options && lastWord !== "") ? options.find(function (opt) {
                        return (opt.type === "item" && opt.title.toLowerCase().indexOf(lastWord) === 0);
                    }) : null;
                }

                var suggestionID = suggestion ? suggestion.id : this.state.id,
                    suggestionTitle = suggestion ? suggestion.title : this.state.suggestTitle;
               
                this.setState({
                    filter: value,
                    width: width,
                    id: suggestionID,
                    suggestTitle: suggestionTitle
                });

                if (this.refs.select) {
                    this.refs.select._setSelected(suggestionID);
                }
            }
        },

        /**
         * Returns the currently selected id
         * 
         * @return {string} id
         */
        getSelected: function () {
            return this.state.id;
        },

        /**
         * Removes words from filter that are also in the ID
         *
         * @param {Array.<string>} id
         * @param {number} iconCount
         */
        resetInput: function (id, iconCount) {
            var currFilter = this.state.filter.split(" "),
                idString = id.join(""),

                nextFilterMap = _.map(currFilter, function (word) {
                    if (idString.indexOf(word.toLowerCase()) > -1) {
                        return "";
                    }
                    return word;
                });

            var nextFilter = nextFilterMap.join(" ").trim();

            this._updateAutofill(nextFilter, iconCount);

            if (this.props.startFocused) {
                this.refs.textInput._beginEdit(false);
            }
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
                if (this.props.useAutofill && this.state.suggestTitle !== "") {
                    currentTitle = this.state.suggestTitle;
                } else {
                    current = this.props.options.find(function (option) {
                        return option.id === this.state.id;
                    }.bind(this));

                    currentTitle = current ? current.title : this.props.value;
                }
            }

            var value = currentTitle || "",
                filter = this.state.filter,
                title = this.state.active && filter !== null ? filter : value,
                searchableFilter = filter ? filter.toLowerCase() : "",
                searchableOptions = this._filterOptions(searchableFilter);
            
            var autocomplete,
                hiddenTI;

            if (this.props.useAutofill) {
                hiddenTI = (
                    <div ref="hiddenTextInput"
                        className="hiddeninput">
                    </div>
                );
                
                var autocompStyle = { left: this.state.width + "px" },
                    suggestTitle = this.state.suggestTitle,
                    suggestTitleLC = suggestTitle.toLowerCase(),
                    titleLC = title.toLowerCase(),
                    wordToComplete = titleLC.split(" ").pop(),
                    suggestion = "";

                if (title.length > 0) {
                    if (wordToComplete !== "" && suggestTitleLC.indexOf(wordToComplete) === 0) {
                        suggestion = suggestTitle.substring(wordToComplete.length);
                    } else if (suggestTitleLC.indexOf(titleLC) === 0) {
                        suggestion = suggestTitle.substring(titleLC.length);
                    }
                }

                autocomplete = (
                    <div
                        className="autocomplete"
                        style={autocompStyle}>
                        {suggestion}
                    </div>
                );
            }

            var hasItems = searchableOptions && !collection.uniformValue(collection.pluck(searchableOptions, "type")),
                dialog = hasItems && (
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
                            onClick={this._handleSelectClose}
                            onClose={this._handleSelectClose} />
                    </Dialog>
                );

            var size = this.props.size,
                svg = [];

            if (this.props.filterIcons) {
                _.forEach(this.props.filterIcons, function (icon) {
                    svg.push((<SVGIcon
                            className="datalist__svg"
                            CSSID={icon}
                            viewbox="0 0 24 24"/>));
                });
                // sneakily resize text box when svg is added
                size = "column-" + (25 - (2 * this.props.filterIcons.length));
            }

            return (
                <div className="drop-down">
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
