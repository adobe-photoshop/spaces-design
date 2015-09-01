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

/*
 * Handles all search modules.
 *
 * Modules are registered from JSX component that wraps SearchBar.jsx component by calling
 * registerSearch() with a unique string ID and an array of string types as parameters. 
 * the types should correspond with the string keys of strings.SEARCH.HEADERS. 
 * For example, ["ALL_LAYER", "CURRENT_DOC"].
 * 
 * Types of searches are registered using the event search.REGISTER_SEARCH_PROVIDER and passing in
 * a payload from a corresponding action class. (Required contents of payload are detailed in 
 * _registerSearchType). Note that handleExecute() defines the default behavior when an item is confirmed. 
 * It can be overwritten in the component that wraps SearchBar.jsx in what gets passed to SearchBar's 
 * executeOption prop.
 *
 * Logic for filtering and displaying results based on user input is in SearchBar.jsx and its sub-components.
 * 
 */
define(function (require, exports, module) {
    "use strict";

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable"),
        _ = require("lodash");

    var events = require("../events"),
        mathUtil = require("js/util/math"),
        pathUtil = require("js/util/path"),
        collection = require("js/util/collection"),
        strings = require("i18n!nls/strings");
    
    /**
     * Strings for labeling search options
     *  
     * @const
     * @type {object} 
    */
    var CATEGORIES = strings.SEARCH.CATEGORIES,
        HEADERS = strings.SEARCH.HEADERS;

    /*
     * Properties used to make complete search options objects for SearchBar.jsx
     *
     * @typedef {Object} ItemInfo
     * @property {string} id ID used to perform action if item is selected
     * @property {string} name Displayable title
     * 
     * @property {Array.<string>} category Subset of filters applicable to item. Header should be first,
     * then more specific categories. All entries should be keys of SEARCH.CATEGORIES,
     * except when it's the name of something. (e.g., a specific CC Library).
     *
     * @property {string} pathInfo Optional path separated by '/'
     * @property {string} iconID Class for corresponding SVG
    */

    /**
     * Performs default behavior on item when confirmed in search
     * 
     * @callback handleExecuteCallback
     * @param {number} idNumber ID value corresponding with selected item
     */

    /**
     * Gets the SVG class for a given item based on its categories
     * 
     * @callback getSVGCallback
     * @param {Array.<string>} categories If provided, an items's list of categories
     */

    /**
     * Gets list of information about search items to create list of search options for SearchBar.jsx
     * 
     * @callback getOptionsCallback
     * @return {Immutable.List.<ItemInfo>}
     */
    var SearchStore = Fluxxor.createStore({

        /**
         * Search modules: types of searches that exist in the application
         * (For example, Application Search or Layer Search)
         *
         * @type {{searchTypes: Array.<string>, searchItems: Immutable.List.<Immutable.List.<object>>,
         * filters: Array.<Array.<string>>}}
         *
         */
        _registeredSearches: {},

        /**
         * Search types: types of data providers that can be used by the search modules
         * (For example, layers or documents)
         *
         * @type {{getOptions: getOptionsCallback, filters: Immutable.List.<string>,
         * displayFilters: Immutable.List.<string>, handleExecute: handleExecuteCallback,
         * shortenPaths: boolean, haveDocument: boolean, getSVGClass: getSVGCallback}}
         */
        _registeredSearchTypes: {},

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.search.REGISTER_SEARCH_PROVIDER, this._registerSearchType
            );
            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._registeredSearches = {};
            this._registeredSearchTypes = {};
        },

        /**
         * Get state of a particular module.
         *
         * @param {string} id Search module ID
         * @return {object}
        */
        getState: function (id) {
            return {
                searchItems: this.getSearchItems(id),
                groupedSearchItems: this._registeredSearches[id].searchItems,
                headers: this._registeredSearches[id].searchHeaders,
                filters: this._registeredSearches[id].searchFilters,
                safeFilterNameMap: this._registeredSearches[id].safeFilterNameMap
            };
        },

        /**
         * Get the search items for the specified search module as 
         * a one dimensional list
         *
         * @param {string} id The search module ID 
         * @return {Immutable.Iterable.<object>}
         */
        getSearchItems: function (id) {
            var groupedSearchItems = this._registeredSearches[id] ?
                    this._registeredSearches[id].searchItems : Immutable.List(),
                flatSearchItems = groupedSearchItems.reduce(function (flatItems, itemGroup) {
                    return flatItems.concat(itemGroup);
                }.bind(this), Immutable.List());

            return flatSearchItems;
        },
        
        /**
         * Perform action for item
         *
         * @param {string} itemID Search item to handle
         */
        handleExecute: function (itemID) {
            var idArray = itemID.split("-"),
                type = idArray[0],
                parsedID = mathUtil.parseNumber(idArray[1]) || idArray[1];

            if (this._registeredSearchTypes[type]) {
                this._registeredSearchTypes[type].handleExecute(parsedID);
            }
        },

        /**
         * Add search module and find initial items, headers, filters
         *
         * @param {string} id The search module ID
         * @param {Array.<string>} types What to search for
         */
        registerSearch: function (id, types) {
            this._registeredSearches[id] = { "searchHeaders": types };
            this._updateSearchItems(id);
        },

        /**
         * Add search type
         *
         * @param {object} payload
         * {string} payload.type Type of search. Corresponds with key of SEARCH.HEADERS
         * {getOptionsCallback} payload.getOptions
         * {Immutable.List.<string>} payload.filters
         * {Immutable.List.<string>} payload.displayFilters
         * {handleExecuteCallback} payload.handleExecute
         * {boolean} payload.shortenPaths
         * {boolean} payload.haveDocument
         * {getSVGCallback} payload.getSVGClass
         *
         */
        _registerSearchType: function (payload) {
            this._registeredSearchTypes[payload.type] = {
                // Function to get options for this type of search
                "getOptions": payload.getOptions,
                // Categories for items in this search type to make filter options for
                // Each is a key of SEARCH.CATEGORIES or user-inputted string
                "filters": payload.filters,
                // If a filter name is a user-inputted string, store a unique ID in filters, and
                // the display string at the corresponding index of displayFilters 
                "displayFilters": payload.displayFilters,
                // Function to use when confirming an item of this type
                "handleExecute": payload.handleExecute,
                // Whether path info should be shortened or not
                "shortenPaths": payload.shortenPaths,
                // If we need a document to have any options for the type, defaults to false
                "haveDocument": payload.haveDocument,
                // Function to get properly named class for the svg icon
                "getSVGClass": payload.getSVGClass
            };
        },

        /**
         * Add all possible options and filters for each of the search headers for the module
         *
         * @param {string} id The search module ID
         */
        _updateSearchItems: function (id) {
            var search = this._registeredSearches[id],
                types = search.searchHeaders;
            
            if (types) {
                search.safeFilterNameMap = {};
                var filterItems = this._getFilterOptions(id, types),
                    searchItems = _.reduce(types, function (items, type) {
                        var options = this._getOptions(type);

                        return items.concat(options);
                    }.bind(this), []);

                searchItems.push(Immutable.List(filterItems));
                search.searchItems = Immutable.List(searchItems);
            }
            this.emit("change");
        },

        /**
         * Call correct getOptions function and return list of options to use in dropdown
         *
         * @param {string} type
         * @return {Immutable.List.<ItemInfo>}
         */
        _getOptions: function (type) {
            var searchTypeInfo = this._registeredSearchTypes[type];
            if (searchTypeInfo) {
                var items = searchTypeInfo.getOptions();
                
                // Get shortest unique paths
                var ancestors = collection.pluck(items, "pathInfo"),
                    shortenedPaths = searchTypeInfo.shortenPaths ?
                        pathUtil.getShortestUniquePaths(ancestors).toJS() : ancestors.toJS();

                var itemMap = items.map(function (item, index) {
                    var newPathInfo = shortenedPaths[index] || "",
                        name = item.name,
                        style;
                    // Don't show the path info if it is just the same as the item name 
                    if (name === newPathInfo) {
                        newPathInfo = "";
                    }

                    if (name === "") {
                        name = "Untitled";
                        style = { "fontStyle": "italic" };
                    }

                    return {
                        id: type + "-" + item.id,
                        title: name,
                        pathInfo: newPathInfo,
                        svgType: item.iconID,
                        category: item.category,
                        style: style,
                        type: "item"
                    };
                }.bind(this));

                // Label to separate groups of options
                var headerLabel = {
                    id: type + "-header",
                    title: HEADERS[type],
                    category: [],
                    type: "header"
                };

                return itemMap.unshift(headerLabel);
            }
            return Immutable.List();
        },

        /**
         * Find SVG for item with specified categories 
         * 
         * @param {Array.<string>} categories
         * @return {string}
         */
        getSVGClass: function (categories) {
            var header = categories[0],
                searchInfo = this._registeredSearchTypes[header];

            return searchInfo.getSVGClass(categories);
        },

        /**
         * Make list of search category dropdown options
         * 
         * @param {string} id Search module ID
         * @param {Array.<string>} searchTypes Headers to make filters for
         * @return {Array.<object>}
         */
        _getFilterOptions: function (id, searchTypes) {
            var allFilters = [];
            searchTypes.forEach(function (header) {
                var searchInfo = this._registeredSearchTypes[header],
                    categories = searchInfo ? searchInfo.filters : null,
                    filters = [];
                if (categories) {
                    categories.forEach(function (kind, index) {
                        var idType = kind,
                            title = CATEGORIES[kind];

                        // if there is no title, that means that kind is a user inputted string
                        // (for example, the name of a CC Library), so kind is a unique ID, and
                        // use the displayFilters as the title
                        if (!title && searchInfo.displayFilters) {
                            title = searchInfo.displayFilters[index];
                            idType = idType.replace(/-/g, "."); // IDs can't have '-' in them

                            var searchModule = this._registeredSearches[id];
                            searchModule.safeFilterNameMap[idType] = title;
                        }

                        var itemCategories = [header],
                            itemID = "FILTER-" + header;

                        // If filter doesn't correspond with a general header,
                        // then add the category info as well
                        if (header !== idType) {
                            itemCategories = [header, idType];
                            itemID += "-" + idType;
                        }
                        
                        var icon = this.getSVGClass(itemCategories);
                        
                        filters.push({
                            id: itemID,
                            title: title,
                            svgType: icon,
                            category: itemCategories,
                            style: { "fontStyle": "italic" },
                            haveDocument: searchInfo.haveDocument,
                            type: "filter"
                        });
                    }, this);
                }
                allFilters = allFilters.concat(filters);
            }, this);

            var filterHeader = {
                id: "FILTER-header",
                title: HEADERS.FILTER,
                category: [],
                type: "header"
            };

            allFilters.unshift(filterHeader);
            return allFilters;
        }
    });
        
    module.exports = SearchStore;
});
