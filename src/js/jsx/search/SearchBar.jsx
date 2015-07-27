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
        Datalist = require("jsx!js/jsx/shared/Datalist"),
        Immutable = require("immutable");

    var svgUtil = require("js/util/svg"),
        strings = require("i18n!nls/strings");

    /**
     * Strings for labeling search options
     *  
     * @const
     * @type {object} 
    */
    var CATEGORIES = strings.SEARCH.CATEGORIES;

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
                searchState = searchStore.getState(this.props.searchID);

            return {
                // All possible search options as a flat list
                options: searchState.searchItems,
                // All possible search options, grouped in Immutable lists by search type
                groupedOptions: searchState.groupedSearchItems,
                // Broad categories of what SearchBar has as options
                searchTypes: searchState.headers,
                // List of more specific categories that correlate with searchTypes to be used as filters
                // Indicate that there are no categories for a search type with null
                searchCategories: searchState.filters
            };
        },

        getDefaultProps: function () {
            return {
                dismissDialog: _.identity,
                searchID: "",
                maxOptions: 14
            };
        },

        getInitialState: function () {
            return {
                filter: [],
                icon: null
            };
        },

        componentDidMount: function () {
            var searchStore = this.getFlux().store("search");
            searchStore._updateSearchItems(this.props.searchID);
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
         * Perform action based on ID
         *
         * @param {string} id
         */
        _handleChange: function (id) {
            if (id === null) {
                this.props.dismissDialog();
                return;
            }

            if (id.indexOf("FILTER") === 0) {
                this._updateFilter(id);
            } else {
                this.props.executeOption(id);
            }
        },

        /**
         * Updates this.state.filter to be values contained in the filter id
         *
         * @param {string} id Filter ID. If null, then reset filter to no value
         */
        _updateFilter: function (id) {
            var idArray = id ? id.split("-") : [],
                filterValues = _.drop(idArray),
                updatedFilter = id ? _.uniq(this.state.filter.concat(filterValues)) : [],
                filterIcon = svgUtil.getSVGClassesFromFilter(updatedFilter);

            this.setState({
                filter: updatedFilter,
                icon: filterIcon
            });

            this.refs.datalist.resetInput(idArray, filterIcon);
        },
        
        /**
         * Make list of search category dropdown options
         * 
         * @return {Immutable.List.<object>}
         */
        _getFilterOptions: function () {
            var allFilters;

            this.state.searchTypes.forEach(function (types, header, index) {
                var allCategories = this.state.searchCategories,
                    filters = Immutable.List();
                if (allCategories) {
                    var categories = allCategories[index];
                                       
                    filters = categories ? categories.map(function (kind) {
                        var idType = kind,
                            title = CATEGORIES[kind];
                            
                        if (CATEGORIES[kind] !== CATEGORIES[header]) {
                            title += " " + CATEGORIES[header];
                        }

                        var categories = [header],
                            id = "FILTER-" + header;

                        if (header !== idType) {
                            categories = [header, idType];
                            id += "-" + idType;
                        }

                        return {
                            id: id,
                            title: title,
                            category: categories,
                            type: "item"
                        };
                    }) : filters;
                }

                allFilters = typeof (allFilters) === "undefined" ? filters : allFilters.concat(filters);
            }.bind(this, allFilters));

            return Immutable.List(allFilters);
        },

        /**
         * Make list of items and headers to be used as dropdown options
         * @return {Immutable.List.<object>}
         */
        _getAllSelectOptions: function () {
            var filterOptions = this._getFilterOptions(),
                options = this.state.options;
            
            return filterOptions.concat(options);
        },

        /**
         * Find the icon corresponding with the filter
         *
         * @private
         * @param {Array.<string>} filter
         * @return {string}
         */
        _getFilterIcon: function (filter) {
            return svgUtil.getSVGClassesFromFilter(filter);
        },

        /**
         * Find options to show in the Datalist drop down
         *
         * @param {string} searchTerm Term to filter by
         * @param {string} autofillID ID of option that is currently being suggested
         * @param {bool} truncate Whether or not to restrict number of options
         * @return {Immutable.List.<object>}
         */
        _filterSearch: function (searchTerm, autofillID, truncate) {
            var optionGroups,
                categories = this._getFilterOptions();

            if (categories.size > 0 && this.state.groupedOptions) {
                optionGroups = this.state.groupedOptions.unshift(categories);
            } else {
                return Immutable.List();
            }

            var filteredOptionGroups = optionGroups.map(function (options) {
                var priorities = Immutable.List();
                
                // Build list of option, priority pairs
                options.forEach(function (option) {
                    if (option.hidden) {
                        return;
                    }

                    // Always add headers to list of searchable options
                    // The check to not render if there are no options below it is in Select.jsx
                    if (option.type === "header") {
                        priorities = priorities.push([option, -1]);
                        return;
                    }

                    var title = option.title.toLowerCase(),
                        category = option.category || [];

                    // If it is the filter option for something that we already have filtered, don't
                    // show that filter option
                    if (option.id.indexOf("FILTER") === 0 && _.isEqual(this.state.filter, category)) {
                        return;
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
                        priorities = priorities.push([option, priority]);
                        return;
                    }

                    priority++;

                    // If option has a path, search for it with and without '/' characters
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
                        priorities = priorities.push([option, priority]);
                    }
                }.bind(this));

                return priorities;
            }.bind(this));

            var optionList = filteredOptionGroups.reduce(function (filteredOptions, group) {
                // Sort by priority, then only take the object, without the priority
                var sortedOptions = group.sortBy(function (opt) {
                        return opt[1];
                    }).map(function (opt) {
                        return opt[0];
                    });
                
                return filteredOptions.concat(sortedOptions);
            }, Immutable.List());

            if (truncate) {
                return optionList.take(this.props.maxOptions);
            }

            return optionList;
        },

        _handleDialogClick: function (event) {
            this.refs.datalist.removeAutofillSuggestion();
            event.stopPropagation();
        },

        _handleKeyDown: function (event) {
            switch (event.key) {
                case "Return":
                case "Enter":
                case "Tab": {
                    var id = this.refs.datalist.getSelected();
                    
                    if (id && id.indexOf("FILTER") === 0) {
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

        render: function () {
            var searchOptions = this._getAllSelectOptions(),
                noMatchesOption = Immutable.List().push({
                    id: "NO_OPTIONS-placeholder",
                    title: strings.SEARCH.NO_OPTIONS,
                    type: "placeholder"
                });

            return (
                <div
                    onClick={this._handleDialogClick}>
                   <Datalist
                        ref="datalist"
                        live={false}
                        className="dialog-search-bar"
                        options={searchOptions}
                        size="column-25"
                        startFocused={true}
                        placeholderText={strings.SEARCH.PLACEHOLDER}
                        placeholderOption={noMatchesOption}
                        filterIcon={this.state.icon}
                        filterOptions={this._filterSearch}
                        useAutofill={true}
                        onChange={this._handleChange}
                        onKeyDown={this._handleKeyDown}
                    />
                </div>
            );
        }
    });

    module.exports = SearchBar;
});
