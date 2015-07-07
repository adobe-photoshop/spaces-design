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
    var MAX_OPTIONS = 10;

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
            // Function to get all possible options
            getOptions: React.PropTypes.isRequired,
            // Function to perform an action when an option is confirmed
            executeOption: React.PropTypes.func.isRequired,
            // Broad categories of what SearchBar has as options
            searchTypes: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
            // List of more specific categories that correlate with searchTypes
            // Indicate that there are no categories for a search type with null
            searchCategories: React.PropTypes.arrayOf(Immutable.List)
        },

        getDefaultProps: function () {
            return {
                dismissDialog: _.identity,
                searchCategories: null
            };
        },

        getInitialState: function () {
            return {
                filter: [],
                icons: []
            };
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

            if (id.indexOf("filter") === 0) {
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
            var idArray = id ? id.split("_") : [],
                filterValues = _.drop(idArray),
                updatedFilter = id ? _.uniq(this.state.filter.concat(filterValues)) : [],
                filterIcons = svgUtil.getSVGClassesFromLayerTypes(updatedFilter);

            this.setState({
                filter: updatedFilter,
                icons: filterIcons
            });

            this.refs.datalist.resetInput(idArray, filterIcons.length);
        },
        
        /**
         * Make list of search category dropdown options
         * 
         * @return {Array.<object>}
         */
        _getFilterOptions: function () {
            var allFilters;

            this.props.searchTypes.forEach(function (types, header, index) {
                var allCategories = this.props.searchCategories,
                    filters = Immutable.List();
                if (allCategories) {
                    var categories = allCategories[index];
                                       
                    filters = categories ? categories.map(function (kind) {
                        var idType = CATEGORIES[kind],
                            title = CATEGORIES[kind];

                        title = title.charAt(0).toUpperCase() + title.slice(1);
                        idType = idType.replace(" ", "");

                        return {
                            id: "filter_" + CATEGORIES[header] + "_" + idType,
                            title: title,
                            category: [CATEGORIES[header], idType],
                            type: "item"
                        };
                    }) : filters;
                }

                // To search for all layers, etc
                var headerTitle = CATEGORIES[header];
                headerTitle = headerTitle.charAt(0).toUpperCase() + headerTitle.slice(1);
                
                var headerFilter = {
                    id: "filter_" + CATEGORIES[header],
                    title: headerTitle,
                    category: [CATEGORIES[header]],
                    type: "item"
                };
                filters = filters.unshift(headerFilter);
                allFilters = typeof (allFilters) === "undefined" ? filters : allFilters.concat(filters);
            }.bind(this, allFilters));

            return Immutable.List(allFilters);
        },

        /**
         * Make list of items and headers to be used as dropdown options
         * @return {Array.<object>}
         */
        _getAllSelectOptions: function () {
            var filterOptions = this._getFilterOptions(),
                options = this.props.getOptions();
            
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
            return svgUtil.getSVGClassesFromLayerTypes(filter);
        },

        /**
         * Find options to show in the Datalist drop down
         *
         * @param {Array.<object>} options Full list of potential options
         * @param {string} searchTerm Term to filter by
         * @return {Array.<object>}
         */
        _filterSearch: function (options, searchTerm) {
            // Keep track of how many options shown so far in a given category
            var count = 0;

            return options && options.filter(function (option) {
                if (option.hidden) {
                    return false;
                }

                // Always add headers to list of searchable options
                // The check to not render if there are no options below it is in Select.jsx
                if (option.type === "header") {
                    count = 0;
                    return true;
                }

                if (count === MAX_OPTIONS) {
                    return false;
                }

                var useTerm = true,
                    title = option.title.toLowerCase(),
                    category = option.category || [];
            
                // If it is the filter option for something that we already have filtered, don't
                // show that filter option
                if (option.id.indexOf("filter") === 0 && _.isEqual(this.state.filter, category)) {
                    return false;
                }

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

                // If option has info, search for it with and without '/' characters
                // Don't check each word of search term individually because want 
                // search to preserve order of layer hierarchy or file path
                var info = option.displayInfo ? option.displayInfo.toLowerCase() : "",
                    searchableInfo = info.concat(info.replace(/\//g, " "));
                
                if (searchableInfo.indexOf(searchTerm) > -1) {
                    return true;
                }
                
                var searchTerms = searchTerm.split(" ");
                useTerm = false;
                // At least one term in the search box must be in the option's title
                // Could add check for if term is somewhere in category list too
                _.forEach(searchTerms, function (term) {
                    if (term !== "" && title.indexOf(term) > -1) {
                        count++;
                        useTerm = true;
                    }
                });

                return useTerm;
            }.bind(this));
        },

        _handleKeyDown: function (event) {
            switch (event.key) {
                case "Return":
                case "Enter":
                case "Tab": {
                    var id = this.refs.datalist.getSelected();
                    
                    if (id && id.indexOf("filter") === 0) {
                        this._updateFilter(id);
                    }
                    
                    break;
                }
                case "Backspace": {
                    if (this.refs.datalist.cursorAtBeginning() && this.state.filter.length > 0) {
                        // Clear filter and icons
                        this._updateFilter(null);
                    }
                    break;
                }
            }
        },

        render: function () {
            var searchOptions = this._getAllSelectOptions();

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
