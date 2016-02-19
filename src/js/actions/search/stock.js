/*
 * Copyright (c) 2016 Adobe Systems Incorporated. All rights reserved.
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

define(function (require, exports) {
    "use strict";

    var Immutable = require("immutable");

    var events = require("js/events"),
        locks = require("js/locks"),
        adapter = require("adapter"),
        nls = require("js/util/nls");

    var SEARCH_STOCK_URL = "https://stock.adobe.com/search?k=",
        ADOBE_STOCK_URL = "https://stock.adobe.com/";
    
    /**
     * Executes Adobe Stock search by opening a URL with the search term
     *
     * @return {Promise}
     */
    var _confirmStockSearch = function (searchTerm) {
        var searchURL;
        
        if (searchTerm) {
            searchURL = encodeURI(SEARCH_STOCK_URL + searchTerm);
        } else {
            searchURL = encodeURI(ADOBE_STOCK_URL);
        }

        return adapter.openURLInDefaultBrowser(searchURL);
    };

    /**
     * Find SVG class for Adobe Stock
     * If this needs to vary based on the item, use category list as parameter 
     * (see getSVGCallback type in search store)
     * 
     * @return {string}
     */
    var _getSVGClass = function () {
        return "libraries-stock";
    };

    /**
     * Make list for Stock options to choose from, currently empty
     * 
     * @private
     * @return {Immutable.List.<object>}
     */
    var _adobeStockSearchOptions = function () {
        return Immutable.List();
    };

    /**
     * Creates an object with properties to populate the search bar 
     * datalist when there are no options present. 
     * 
     * @private
     * @return {object}
     */
    var _createNoOptionsDefault = function () {
        return {
            "noOptionsString": nls.localize("strings.SEARCH.NO_OPTIONS_STOCK"),
            "noOptionsExecute": _confirmStockSearch,
            "noOptionsType": "filter"
        };
    };

    /**
     * Register Adobe Stock payload information for search
     *
     * @return {Promise}
     */
    var registerAdobeStock = function () {
        var adobeStockPayload = {
            "type": "ADOBE_STOCK",
            "getOptions": _adobeStockSearchOptions,
            "filters": Immutable.List.of("ADOBE_STOCK"),
            "handleExecute": _confirmStockSearch,
            "shortenPaths": false,
            "getSVGClass": _getSVGClass,
            "noOptionsDefault": _createNoOptionsDefault
        };

        return this.dispatchAsync(events.search.REGISTER_SEARCH_PROVIDER, adobeStockPayload);
    };
    registerAdobeStock.action = {
        reads: [],
        writes: [locks.JS_SEARCH]
    };

    /**
     * Send information about Adobe Stock to search store
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        return this.transfer("search.stock.registerAdobeStock");
    };
    afterStartup.action = {
        reads: [],
        writes: [],
        transfers: ["search.stock.registerAdobeStock"]
    };

    exports.registerAdobeStock = registerAdobeStock;
    exports.afterStartup = afterStartup;
});
