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

define(function (require, exports) {
    "use strict";

    var Immutable = require("immutable");

    var events = require("js/events"),
        pathUtil = require("js/util/path");

    /**
     * Make list of current documents info so search store can create search options
     * 
     * @private
     * @return {Immutable.List.<object>}
     */
    var _currDocSearchOptions = function () {
        var appStore = this.flux.store("application"),
            docStore = this.flux.store("document"),
            openDocs = appStore.getOpenDocumentIDs(),
            docMap = openDocs.map(function (doc) {
                return {
                    id: doc.toString(),
                    name: docStore.getDocument(doc).name,
                    category: ["CURRENT_DOC"],
                    iconID: "document"
                };
            });

        return docMap;
    };

    /**
     * Make list of recent documents info so search store can create search options
     * 
     * @private
     * @return {Immutable.List.<object>}
     */
    var _recentDocSearchOptions = function () {
        var appStore = this.flux.store("application"),
            recentFiles = appStore.getRecentFiles(),
            recentDocMap = recentFiles.map(function (doc, index) {
                return {
                    id: index.toString(),
                    name: pathUtil.getShortestUniquePaths(Immutable.List.of(doc)).toJS()[0],
                    category: ["RECENT_DOC"],
                    pathInfo: doc,
                    iconID: "document"
                };
            });
        
        return recentDocMap;
    };
    
    /**
     * Switch to document when its item is confirmed in search
     *
     * @private
     * @param {number} idInt ID of document to switch to
     */
    var _confirmCurrDocSearch = function (idInt) {
        var selectedDoc = this.flux.store("document").getDocument(idInt);
        if (selectedDoc) {
            this.flux.actions.documents.selectDocument(selectedDoc);
        }
    };
    
    /**
     * Open recent document when its item is confirmed in search
     *
     * @private
     * @param {number} idInt ID of recent document to switch to
     */
    var _confirmRecentDocSearch = function (idInt) {
        var recentFiles = this.flux.store("application").getRecentFiles(),
            fileName = recentFiles.get(idInt);
        this.flux.actions.documents.open(fileName);
    };

    /**
     * Find SVG class for documents
     * If this needs to vary based on the item, use category list as parameter 
     * (see getSVGCallback type in search store)
     * 
     * @return {string}
     */
    var _getSVGClass = function () {
        return "document";
    };

    /**
     * Register current document info for search
     */
    var registerCurrentDocumentSearch = function () {
        var currentDocPayload = {
            "type": "CURRENT_DOC",
            "getOptions": _currDocSearchOptions.bind(this),
            "filters": Immutable.List.of("CURRENT_DOC"),
            "handleExecute": _confirmCurrDocSearch.bind(this),
            "shortenPaths": false,
            "haveDocument": true,
            "getSVGClass": _getSVGClass
        };

        this.dispatch(events.search.REGISTER_SEARCH_PROVIDER, currentDocPayload);
    };
    
    /**
     * Register recent document info for search
     */
    var registerRecentDocumentSearch = function () {
        var recentDocPayload = {
            "type": "RECENT_DOC",
            "getOptions": _recentDocSearchOptions.bind(this),
            "filters": Immutable.List.of("RECENT_DOC"),
            "handleExecute": _confirmRecentDocSearch.bind(this),
            "shortenPaths": true,
            "getSVGClass": _getSVGClass
        };

        this.dispatch(events.search.REGISTER_SEARCH_PROVIDER, recentDocPayload);
    };

    exports.registerCurrentDocumentSearch = registerCurrentDocumentSearch;
    exports.registerRecentDocumentSearch = registerRecentDocumentSearch;
});
