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
 * The types should correspond with the string keys of strings.SEARCH.HEADERS. 
 * For example, ["LAYER", "CURRENT_DOC"].
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


    /*
     * Properties used to make complete search options objects for SearchBar.jsx
     *
     * @typedef {Object} ItemInfo
     * @property {string} id A number parsed as a string. ID used to perform action if item is selected
     * @property {string} name Displayable title
     * @property {Array.<string>} category Subset of filters that apply to item. All are keys of SEARCH.CATEGORIES
     * @property {string} pathInfo A path separated by '/', or ""
     * @property {string} iconID Class for corresponding SVG
    */

    /**
     * Performs default behavior on item when confirmed in search
     * 
     * @callback handleExecuteCB
     * @param {number} idNumber ID value corresponding with selected item
     */


    /**
     * Gets list of information about search items to create list of search options for SearchBar.jsx
     * 
     * @callback getOptionsCB
     * @return {Immutable.List.<ItemInfo>}
     */
    var SearchStore = Fluxxor.createStore({

        /**
         * Search modules
         *
         * @type {{searchTypes: Array.<string>, searchItems: Immutable.List.<object>, filters: Array.<Array.<string>>}}
         */
        _registeredSearches: {},

        /**
         * Search types
         *
         * @type {{getOptions: getOptionsCB, filters: Immutable.List.<string>, handleExecute: handleExecuteCB}}
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
         * Update the search items for the specified search module
         *
         * @private
         * @param {string} id The search module ID to update
         */
        _update: function (id) {
            this._updateSearchItems(id);
        },

        /**
         * Get the search items for the specified search module
         *
         * @param {string} id The search module ID 
         * @return {Immutable.Iterable.<object>}
         */
        getSearchItems: function (id) {
            return this._registeredSearches[id].searchItems;
        },

        /**
         * Get the filters for the specified search module
         *
         * @param {string} id The search module ID 
         * @return {Array.<Array.<string>>}
         */
        getFilters: function (id) {
            return this._registeredSearches[id].searchFilters;
        },

        /**
         * Get the headers for the specified search module
         *
         * @param {string} id The search module ID
         * @return {Array.<string>}
         */
        getHeaders: function (id) {
            return this._registeredSearches[id].searchHeaders;
        },
        
        /**
         * Perform action for item
         *
         * @param {string} id Search module to use
         * @param {string} itemID Search item to handle
         */
        handleExecute: function (id, itemID) {
            var idArray = itemID.split("-"),
                type = idArray[0],
                idInt = mathUtil.parseNumber(idArray[1]);

            if (this._registeredSearchTypes[type]) {
                this._registeredSearchTypes[type].handleExecute(idInt);
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
         * {getOptionsCB} payload.getOptions 
         * Possible categories for items in this search type. Each string is a key of SEARCH.CATEGORIES
         * {Immutable.List.<string>} payload.filters
         * {handleExecuteCB} payload.handleExecute
         *
         */
        _registerSearchType: function (payload) {
            this._registeredSearchTypes[payload.type] = {
                "getOptions": payload.getOptions,
                "filters": payload.filters,
                "handleExecute": payload.handleExecute
            };
        },

        /**
         * Add all possible options for each of the search headers for the module
         *
         * @param {string} id The search module ID
         */
        _updateSearchItems: function (id) {
            var search = this._registeredSearches[id],
                types = search.searchHeaders;
            
            search.searchFilters = [];
            
            if (types) {
                search.searchItems = _.reduce(types, function (items, type) {
                    var options = this._getOptions(type),
                        filters = this._getFiltersByItems(options, type);
                    
                    search.searchFilters.push(filters);
                    return items.concat(options);
                }.bind(this), Immutable.List());
            }
        },

        /**
         * Call correct get options function
         *
         * @param {string} type
         * @return {Immutable.List}
         */
        _getOptions: function (type) {
            var searchTypeInfo = this._registeredSearchTypes[type];
            if (searchTypeInfo) {
                var items = searchTypeInfo.getOptions();
                
                // Get shortest unique paths
                var ancestors = collection.pluck(items, "pathInfo"),
                    shortenedPaths = pathUtil.getShortestUniquePaths(ancestors).toJS();

                var itemMap = items.map(function (item, index) {
                    var newPathInfo = shortenedPaths[index];
                    // Don't show the path info if it is just the same as the item name 
                    if (item.name === newPathInfo) {
                        newPathInfo = "";
                    }

                    return {
                        id: type + "-" + item.id,
                        title: item.name,
                        pathInfo: newPathInfo,
                        svgType: item.iconID,
                        category: item.category,
                        type: "item"
                    };
                }.bind(this));

                // Label to separate groups of options
                var headerLabel = {
                    id: type + "-header",
                    title: strings.SEARCH.HEADERS[type],
                    category: [],
                    type: "header"
                };

                return itemMap.unshift(headerLabel);
            }
            return Immutable.List();
        },

        /**
         * Get filters that should be displayed 
         * Don't include filters that don't have items or that aren't valid for the search type
         *
         * @param {Immutable.List} items
         * @param {string} type For looking up the search
         * @return {Array.<string>}
         */
        _getFiltersByItems: function (items, type) {
            if (items.size === 0) {
                return [];
            }
            var moduleFilters = this._registeredSearchTypes[type].filters.toJS(),
                possibleFilters = _.flatten(collection.pluck(items, "category").toJS());

            // Only use filters that are also permitted by the search type
            return _.intersection(possibleFilters, moduleFilters);
        }
    });
        
    module.exports = SearchStore;
});
