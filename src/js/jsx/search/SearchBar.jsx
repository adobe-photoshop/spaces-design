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
        _ = require("lodash"),
        Datalist = require("jsx!js/jsx/shared/Datalist"),
        Immutable = require("immutable");

    var svgUtil = require("js/util/svg"),
        strings = require("i18n!nls/strings");
    
    /**
     * Maximum number of options to show per category
     *  
     * @const
     * @type {number} 
    */
    var MAX_OPTIONS = 5;

    /**
     * Strings for labeling search options
     *  
     * @const
     * @type {object} 
    */
    var CATEGORIES = strings.SEARCH.CATEGORIES;

    var SearchBar = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            dismissDialog: React.PropTypes.func,
            // Function to perform an action when an option is confirmed
            executeOption: React.PropTypes.func.isRequired,
            // Unique identifying string for the search module
            searchID: React.PropTypes.string.isRequired
        },

        getDefaultProps: function () {
            return {
                dismissDialog: _.identity,
                searchID: ""
            };
        },

        getInitialState: function () {
            return {
                // All possible search options as a flat list
                options: Immutable.List(),
                // All possible search options, grouped in Immutable lists by search type
                groupedOptions: Immutable.List(),
                // Broad categories of what SearchBar has as options
                searchTypes: [],
                // List of more specific categories that correlate with searchTypes to be used as filters
                // Indicate that there are no categories for a search type with null
                searchCategories: [],

                filter: [],
                icons: []
            };
        },
  
        componentDidMount: function () {
            var searchStore = this.getFlux().store("search");
            
            searchStore._update(this.props.searchID);
            
            this.setState({
                options: searchStore.getSearchItems(this.props.searchID),
                searchTypes: searchStore.getHeaders(this.props.searchID),
                searchCategories: searchStore.getFilters(this.props.searchID),
                groupedOptions: searchStore.getGroupedSearchItems(this.props.searchID)
            });
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
                filterIcons = svgUtil.getSVGClassesFromFilter(updatedFilter);

            this.setState({
                filter: updatedFilter,
                icons: filterIcons
            });

            this.refs.datalist.resetInput(idArray, filterIcons.length);
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
         * Find the icons corresponding with the filter
         *
         * @private
         * @param {Array.<string>} filter
         * @return {Array.<string>}
         */
        _getFilterIcons: function (filter) {
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
            // Use count to keep track of how many options shown so far in a given category
            var count = 0,
                optionGroups,
                categories = this._getFilterOptions();

            if (categories.size > 0 && this.state.groupedOptions) {
                optionGroups = this.state.groupedOptions.unshift(categories);
            } else {
                return Immutable.List();
            }

            var filteredOptionGroups = optionGroups.map(function (options) {
                return options && options.filter(function (option) {
                    option.priority = 1; // Add to priority to indicate less important

                    if (option.hidden) {
                        return false;
                    }

                    // Always add headers to list of searchable options
                    // The check to not render if there are no options below it is in Select.jsx
                    if (option.type === "header") {
                        count = 0;
                        option.priority = -1;
                        return true;
                    }

                    var useTerm = true,
                        title = option.title.toLowerCase(),
                        category = option.category || [];
                
                    // If it is the filter option for something that we already have filtered, don't
                    // show that filter option
                    if (option.id.indexOf("FILTER") === 0 && _.isEqual(this.state.filter, category)) {
                        return false;
                    }
                    
                    option.priority++;

                    if (this.state.filter.length > 0) {
                        // All terms in this.state.filter must be in the option's category
                        _.forEach(this.state.filter, function (filterValue) {
                            if (!_.contains(category, filterValue)) {
                                useTerm = false;
                            }
                        });

                        if (!useTerm) {
                            return false;
                        }
                    }

                    // If haven't typed anything, want to use everything that fits into the category
                    if (searchTerm === "") {
                        count++;
                        return true;
                    }

                    option.priority++;

                    // If option has a path, search for it with and without '/' characters
                    // This first check preserves order. Later we check for every word,
                    // but it will have a lower priority than if it matches perfectly
                    var pathInfo = option.pathInfo ? option.pathInfo.toLowerCase() : "",
                        searchablePath = pathInfo.concat(pathInfo.replace(/\//g, " "));
                    
                    if (searchablePath.indexOf(searchTerm) > -1) {
                        // If option is the autofill option, should jump to the top
                        if (option.id === autofillID) {
                            option.priority = 0;
                        }
                        return true;
                    }

                    option.priority++;
                    
                    var searchTerms = searchTerm.split(" "),
                        numTermsInTitle = 0;
                    useTerm = false;
                    // At least one term in the search box must be in the option's title
                    // or path. Could add check for if term is somewhere in category list too
                    _.forEach(searchTerms, function (term) {
                        var titleContains = title.indexOf(term) > -1,
                            pathContains = searchablePath.indexOf(term) > -1;
                        if (term !== "" && (titleContains || pathContains)) {
                            useTerm = true;
                            count++;
                            numTermsInTitle++;

                            // If the title contains the term, then it is a better
                            // priority than if just the path contains the term
                            if (titleContains) {
                                numTermsInTitle++;
                            }
                        }
                    });

                    option.priority += (searchTerms.length - numTermsInTitle);
                    
                    // If option is the autofill option, should jump to the top
                    if (option.id === autofillID) {
                        option.priority = 0;
                    }

                    return useTerm;
                }.bind(this));
            }.bind(this));

            return filteredOptionGroups.reduce(function (filteredOptions, group) {
                var sortedOptions = group.sortBy(function (opt) {
                    return opt.priority;
                });

                if (truncate) {
                    return filteredOptions.concat(sortedOptions);
                } else {
                    return filteredOptions.concat(sortedOptions.take(MAX_OPTIONS));
                }
            }, Immutable.List());
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
                        // Clear filter and icons
                        this._updateFilter(null);
                        this.refs.datalist.forceUpdate();
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
                    onClick={this.props.dismissDialog}>
                   <Datalist
                    ref="datalist"
                    live={false}
                    className="dialog-search-bar"
                    options={searchOptions}
                    size="column-25"
                    startFocused={true}
                    placeholderText={strings.SEARCH.PLACEHOLDER}
                    placeholderOption={noMatchesOption}
                    filterIcons={this.state.icons}
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
