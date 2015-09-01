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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        _ = require("lodash"),
        Immutable = require("immutable"),
        collection = require("js/util/collection"),
        strings = require("i18n!nls/strings");

    var Datalist = require("jsx!js/jsx/shared/Datalist"),
        Button = require("jsx!js/jsx/shared/Button");

    /**
     * The ID of the option display when there are no other valid results
     *
     * @const
     * @type {string}
     */
    var PLACEHOLDER_ID = "NO_OPTIONS-placeholder";

    var SearchBar = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("search")],

        propTypes: {
            dismissDialog: React.PropTypes.func,
            // Function to perform an action when an option is confirmed
            executeOption: React.PropTypes.func.isRequired,
            // Unique identifying string for the search module
            searchID: React.PropTypes.string.isRequired
        },

        getStateFromFlux: function () {
            var searchStore = this.getFlux().store("search"),
                searchState = searchStore.getState(this.props.searchID),
                options = searchState.searchItems,

                filterItems = options.filter(function (opt) {
                    return opt.type === "filter";
                }),
                filterIDs = collection.pluck(filterItems, "id").toJS();

            filterIDs.push(PLACEHOLDER_ID);

            return {
                // All possible search options as a flat list
                options: options,
                // All possible search options, grouped in Immutable lists by search type
                groupedOptions: searchState.groupedSearchItems,
                // Broad categories of what SearchBar has as options
                searchTypes: searchState.headers,
                // List of more specific categories that correlate with searchTypes to be used as filters
                // Indicate that there are no categories for a search type with null
                searchCategories: searchState.filters,
                // List of IDs corresponding with the filter options and the placeholder option
                // Gets passed to Datalist as list of option IDs that when selected, should not close the dialog
                filterIDs: filterIDs,
                // Filter names that are user-inputted strings, stored under IDs
                safeFilterNameMap: searchState.safeFilterNameMap
            };
        },

        getDefaultProps: function () {
            return {
                dismissDialog: _.identity,
                searchID: "",
                maxOptions: 30
            };
        },

        getInitialState: function () {
            return {
                // The currently applied filter
                filter: [],
                // SVG class for icon for the currently applied filter
                icon: null
            };
        },

        componentDidMount: function () {
            var searchStore = this.getFlux().store("search");
            searchStore._updateSearchItems(this.props.searchID);
        },

        componentDidUpdate: function (prevProps, prevState) {
            if (prevState.filter !== this.state.filter && this.refs.datalist) {
                this._updateDatalistInput(this.state.filter);
                // Force update because Datalist's state might not change at all
                this.refs.datalist.forceUpdate();
            }
        },

        /**
         * Dismiss the parent dialog
         *
         * @param {SyntheticEvent} event
         */
        _dismissDialog: function (event) {
            if (_.isFunction(this.props.dismissDialog)) {
                this.props.dismissDialog(event);
            }
        },

        /**
         * Updates filter state to be values contained in the provided id of a filter item
         *
         * @param {string} id Filter ID. If null, then reset filter to no value
         */
        _updateFilter: function (id) {
            var idArray = id ? id.split("-") : [],
                filterValues = _.drop(idArray);

            var updatedFilter = id ? _.uniq(this.state.filter.concat(filterValues)) : [],
                filterIcon = id && this.getFlux().store("search").getSVGClass(updatedFilter);
            
            this.setState({
                filter: updatedFilter,
                icon: filterIcon
            });
        },

        /**
         * Removes words from Datalist input that are contained in the ID
         *
         * @param {string} id ID of selected item
         */
        _updateDatalistInput: function (id) {
            if (id) {
                var currFilter = this.refs.datalist.getInputValue().split(" "),
                idString = _.map(id, function (idWord) {
                    var toRemove = strings.SEARCH.CATEGORIES[idWord] || this.state.safeFilterNameMap[idWord];
                    if (toRemove) {
                        return toRemove.toLowerCase().replace(" ", "");
                    }

                    return idWord;
                }, this).join("").toLowerCase(),

                nextFilterMap = _.map(currFilter, function (word) {
                    return idString.indexOf(word.toLowerCase()) > -1 ? "" : word;
                }),
                nextFilter = nextFilterMap.join(" ").trim();

                this.refs.datalist.updateFilter(nextFilter);
            } else {
                this.refs.datalist.updateFilter(null);
            }
        },

        /**
         * Find options to render in the Datalist drop down, limited by the text input value
         * and the applied filter (if there is one)
         *
         * @param {string} searchTerm Term to filter by
         * @param {string} autofillID ID of option that is currently being suggested
         * @param {bool} truncate Whether or not to restrict number of options
         * @return {Immutable.List.<object>}
         */
        _filterSearchOptions: function (searchTerm, autofillID, truncate) {
            var optionGroups = this.state.groupedOptions;

            if (!optionGroups) {
                return Immutable.List();
            }

            // Look at each group of options (grouped by header category), and
            // put all valid options in a list of pairs [option, priority],
            // where option is the option itself and priority is an integer representing
            // how close that option is to the entered search terms (lower integers->better match)
            var filteredOptionGroups = optionGroups.map(function (options) {
                var priorities = [];
                
                // Build list of option, priority pairs
                options.forEach(function (option) {
                    if (option.hidden) {
                        return;
                    }

                    // Always add headers to list of searchable options
                    // The check to not render if there are no options below it is in Select.jsx
                    if (option.type === "header") {
                        priorities.push([option, -1]);
                        return;
                    }

                    var title = option.title.toLowerCase(),
                        category = option.category || [];
 
                    if (option.type === "filter") {
                        // If it is the filter option for something that we already have filtered, don't
                        // show that filter option
                        if (_.isEqual(this.state.filter, category)) {
                            return;
                        }

                        // No document, so don't render document-only filters
                        if (!this.getFlux().stores.application.getCurrentDocument() && option.haveDocument) {
                            return;
                        }
                    }

                    // All terms in this.state.filter must be in the option's category
                    if (this.state.filter && this.state.filter.length > 0) {
                        var dontUseTerm = _.some(this.state.filter, function (filterValue) {
                            return (!_.contains(category, filterValue));
                        });

                        if (dontUseTerm) {
                            return;
                        }
                    }

                    var priority = 1; // Add to priority to indicate less important

                    // If haven't typed anything, want to use everything that fits into the category
                    if (searchTerm === "") {
                        priorities.push([option, priority]);
                        return;
                    }

                    priority++;

                    // If option has a path, search for it with and without '/', '>' characters
                    var pathInfo = option.pathInfo ? option.pathInfo.toLowerCase() + " " : "",
                        searchablePath = pathInfo.concat(pathInfo.replace(/[\/,>]/g, " ")),
                        searchTerms = searchTerm.split(" "),
                        numTermsInTitle = 0,
                        useTerm = false,
                        titleWords = title.split(" ");

                    // At least one term in the search box must be in the option's title
                    // or path. Could add check for if term is somewhere in category list too
                    _.forEach(searchTerms, function (term) {
                        var titleContains = title.indexOf(term) > -1,
                            pathContains = searchablePath.indexOf(term) > -1,
                            titleMatches = titleContains ? titleWords.indexOf(term) > -1 : false;
                        
                        if (term !== "" && (titleContains || pathContains)) {
                            useTerm = true;
                            numTermsInTitle++;

                            // If the title contains the term, then it is a better
                            // priority than if just the path contains the term
                            if (titleContains) {
                                numTermsInTitle++;
                            }

                            // If the title matches the term, then it is an even better priority
                            if (titleMatches) {
                                numTermsInTitle++;
                            }
                        }
                    });

                    // Multiply by 3 so that we are always adding a positive number
                    // since numTermsInTitle is at most 3 times the length of the input
                    priority += (3 * searchTerms.length - numTermsInTitle);
                    
                    // If option is the autofill option, should jump to the top
                    if (option.id === autofillID) {
                        priority = 0;
                    }

                    if (useTerm) {
                        priorities.push([option, priority]);
                    }
                }.bind(this));

                return Immutable.List(priorities);
            }.bind(this));

            // Sort options by priority and put all options together in one list
            var optionList = filteredOptionGroups.reduce(function (filteredOptions, group) {
                // Whether this group of options should be listed first
                var topGroup = false;

                // Sort by priority, then only take the object, without the priority
                // While sorting, figure out which of the categories should be at the top of the 
                // search bar. If a group contains the autofill suggestion, it should move to the top.
                //
                // The filters group should go above all of the other groups of options. Since
                // we can guarentee the filters are the last group in this.state.groupedOptions,
                // they will be moved to the top of the list of options last
                var sortedOptions = group.sortBy(function (opt) {
                        var priority = opt[1];

                        // group contains the autofill suggestion
                        if (priority === 0) {
                            topGroup = true;
                        }
                        return priority;
                    }).map(function (opt) {
                        var option = opt[0];
                        //  group contains the filters so should be at top of list.
                        if (option.type === "filter") {
                            topGroup = true;
                        }
                        return option;
                    });

                if (topGroup) {
                    return sortedOptions.concat(filteredOptions);
                }
                return filteredOptions.concat(sortedOptions);
            }, Immutable.List());

            if (truncate) {
                return optionList.take(this.props.maxOptions);
            }

            return optionList;
        },

        /** @ignore */
        _handleDialogClick: function (event) {
            this.refs.datalist.removeAutofillSuggestion();
            event.stopPropagation();
        },
        
        /**
         * Perform action based on ID
         *
         * @param {string} id
         */
        _handleChange: function (id) {
            if (id === null) {
                this.props.dismissDialog();
                return;
            }

            if (id !== PLACEHOLDER_ID) {
                if (_.contains(this.state.filterIDs, id)) {
                    this._updateFilter(id);
                } else {
                    this.props.executeOption(id);
                }
            }
        },

        /** @ignore */
        _handleKeyDown: function (event) {
            switch (event.key) {
                case "Return":
                case "Enter":
                case "Tab": {
                    var id = this.refs.datalist.getSelected();

                    if (id === PLACEHOLDER_ID) {
                        this._handleDialogClick(event);
                    } else if (_.contains(this.state.filterIDs, id)) {
                        this._updateFilter(id);
                    }
                    break;
                }
                case "Backspace": {
                    if (this.refs.datalist.cursorAtBeginning() && this.state.filter.length > 0) {
                        // Clear filter and icon
                        this._updateFilter(null);
                    }
                    break;
                }
            }
        },

        /** @ignore */
        _clearInput: function () {
            this._updateFilter(null);
            this._updateDatalistInput(null);
        },

        render: function () {
            var searchStrings = strings.SEARCH,
                noMatchesOption = {
                    id: PLACEHOLDER_ID,
                    title: strings.SEARCH.NO_OPTIONS,
                    type: "placeholder"
                };

            var placeholderText = searchStrings.PLACEHOLDER,
                filter = this.state.filter;

            // If we have applied a filter, change the placeholder text
            if (filter.length > 0) {
                var lastFilter = filter[filter.length - 1],
                    categoryString = searchStrings.CATEGORIES[lastFilter],
                    category = categoryString ?
                        categoryString.toLowerCase() : this.state.safeFilterNameMap[lastFilter];
                placeholderText = searchStrings.PLACEHOLDER_FILTER + category;
            }

            return (
                <div
                    onClick={this._handleDialogClick}>
                   <Datalist
                        ref="datalist"
                        live={false}
                        className="dialog-search-bar"
                        options={this.state.options}
                        startFocused={true}
                        placeholderText={placeholderText}
                        placeholderOption={noMatchesOption}
                        filterIcon={this.state.icon}
                        filterOptions={this._filterSearchOptions}
                        dontCloseDialogIDs={this.state.filterIDs}
                        useAutofill={true}
                        neverSelectAllInput={true}
                        onChange={this._handleChange}
                        onClick={this._handleDialogClick}
                        onKeyDown={this._handleKeyDown} />
                    <Button
                        title="Clear Search Input"
                        className="button-clear-search"
                        onClick={this._clearInput} >
                        &times;
                    </Button>
                </div>
            );
        }
    });

    module.exports = SearchBar;
});
