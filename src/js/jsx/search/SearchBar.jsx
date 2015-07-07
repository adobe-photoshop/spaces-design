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

    var layerLib = require("adapter/lib/layer"),
        pathUtil = require("js/util/path"),
        svgUtil = require("js/util/svg"),
        mathUtil = require("js/util/math"),
        collection = require("js/util/collection"),
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
    var HEADERS = strings.SEARCH.HEADERS,
        CATEGORIES = strings.SEARCH.CATEGORIES;

    var SearchBar = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            dismissDialog: React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                dismissDialog: _.identity
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
         * Select the layer or document specified and dismiss the dialog
         *
         * @param {string} id
         */
        _handleChange: function (id) {
            if (id === null) {
                this.props.dismissDialog();
                return;
            }

            // ID has type as first word, followed by the layer/document ID
            var idArray = id.split("_"),
                type = idArray[0],
                idInt = mathUtil.parseNumber(idArray[1]),
                flux = this.getFlux();

            switch (type) {
            case "filter":
                this._updateFilter(id);
                return;
            case "layer":
                var document = flux.store("application").getCurrentDocument(),
                    selected = document.layers.byID(idInt);

                if (selected) {
                    flux.actions.layers.select(document, selected);
                }
                break;
            case "curr-doc":
                var selectedDoc = flux.store("document").getDocument(idInt);
                
                if (selectedDoc) {
                    flux.actions.documents.selectDocument(selectedDoc);
                }
                break;
            case "recent-doc":
                var appStore = this.getFlux().store("application"),
                    recentFiles = appStore.getRecentFiles(),
                    fileName = recentFiles.get(idInt);

                flux.actions.documents.open(fileName);
                break;
            }
            this.props.dismissDialog();
        },

        /**
         * Updates this.state.filter to be values contained in the filter id
         *
         * @param {string} id Filter ID
         */
        _updateFilter: function (id) {
            var idArray = id.split("_"),
                filterValues = _.drop(idArray),
                updatedFilter = _.uniq(this.state.filter.concat(filterValues)),
                filterIcons = this._getFilterIcons(updatedFilter);
                
            this.setState({
                filter: updatedFilter,
                icons: filterIcons
            });

            this.refs.datalist.resetInput(idArray, filterIcons.length);
        },

        /**
         * Get the layer ancestry
         *
         * @private
         * @param {Layer} layer
         * @return {string}
         */
        _formatLayerAncestry: function (layer) {
            var layerTree = this.getFlux().store("application").getCurrentDocument().layers,
                ancestors = layerTree.ancestors(layer),
                ancestorNames = ancestors.first().name;
                
            return ancestors.skip(1).reduce(function (ancestors, ancestor) {
                return ancestorNames += ("/" + ancestor.name);
            }, ancestorNames);
        },

        /**
         * Get the layer type and if it is linked or an artboard, as an array of strings
         *
         * @private
         * @param {Layer} layer
         * @return {Array.<string>}
        */
        _getLayerCategory: function (layer) {
            var layerType = [CATEGORIES.LAYER];

            if (layer.kind === layer.layerKinds.GROUP && layer.isArtboard) {
                layerType.push(CATEGORIES.ARTBOARD);
            } else {
                layerType.push(CATEGORIES.LAYER_KIND[layer.kind].replace(" ", ""));
            }

            if (layer.isLinked) {
                layerType.push(CATEGORIES.LINKED);
            }

            return layerType;
        },

        /**
         * Make list of layers in the current document to be used as dropdown options
         * 
         * @return {Array.<object>}
         */
        _getLayerOptions: function () {
            // Get list of layers
            var appStore = this.getFlux().store("application"),
                document = appStore.getCurrentDocument(),
                layers = document.layers.allVisibleReversed,
                layerMap = layers.map(function (layer) {
                    var ancestry = this._formatLayerAncestry(layer),
                        layerType = this._getLayerCategory(layer),
                        iconID = svgUtil.getSVGFromLayer(layer);

                    return {
                        id: "layer_" + layer.id.toString(),
                        title: layer.name,
                        info: ancestry,
                        displayInfo: ancestry,
                        svgType: iconID,
                        category: layerType,
                        type: "item"
                    };
                }.bind(this)),

                // Get shortest unique layer ancestry
                ancestors = collection.pluck(layerMap, "info"),
                shortenedPaths = pathUtil.getShortestUniquePaths(ancestors).toJS();

            layerMap.forEach(function (layerItem, index) {
                var newInfo = shortenedPaths[index];
                
                // Only show ancestry if other layers have the same name
                if (layerItem.title === newInfo) {
                    layerItem.displayInfo = "";
                } else {
                    layerItem.displayInfo = newInfo;
                }
            });

            var layerLabel = {
                id: "layer_header",
                title: HEADERS.LAYERS,
                type: "header"
            },
            layerOptions = layerMap.unshift(layerLabel);

            return layerOptions;
        },

        /**
         * Make list of currently open documents to be used as dropdown options
         * 
         * @return {Array.<object>}
         */
        _getCurrDocOptions: function () {
            var appStore = this.getFlux().store("application"),
                docStore = this.getFlux().store("document"),
                document = appStore.getCurrentDocument(),
                openDocs = appStore.getOpenDocumentIDs().filterNot(function (doc) {
                                return doc === document.id;
                            }),
                docMap = openDocs.map(function (doc) {
                    return {
                        id: "curr-doc_" + doc.toString(),
                        title: docStore.getDocument(doc).name,
                        type: "item",
                        category: [CATEGORIES.DOCUMENT, CATEGORIES.CURRENT]
                    };
                }),
                docLabel = {
                    id: "curr-doc_header",
                    title: HEADERS.CURRENT_DOCS,
                    type: "header"
                },

                docOptions = docMap.unshift(docLabel);

            return docOptions;
        },

        /**
         * Make list of recent documents to be used as dropdown options
         * 
         * @return {Array.<object>}
         */
        _getRecentDocOptions: function () {
            var appStore = this.getFlux().store("application"),
                recentFiles = appStore.getRecentFiles(),
                recentDocMap = recentFiles.map(function (doc, index) {
                    return {
                        id: "recent-doc_" + index.toString(),
                        title: pathUtil.getShortestUniquePaths(Immutable.List.of(doc)).toJS()[0],
                        type: "item",
                        info: doc,
                        displayInfo: doc,
                        category: [CATEGORIES.DOCUMENT, CATEGORIES.RECENT]
                    };
                });
            
            // Get shortest unique file path
            var paths = collection.pluck(recentDocMap, "info"),
                shortenedPaths = pathUtil.getShortestUniquePaths(paths).toJS();

            recentDocMap.forEach(function (docItem, index) {
                docItem.displayInfo = shortenedPaths[index];
            });

            var recentDocLabel = {
                id: "recent-doc_header",
                title: HEADERS.RECENT_DOCS,
                type: "header"
            };

            return recentDocMap.unshift(recentDocLabel);
        },

        /**
         * Make list of search category dropdown options based on header
         * 
         * @param {string} header, either "layer" or "document"
         * @return {Array.<object>}
         */
        _getFilterOptions: function (header) {
            if (header !== "layer" && header !== "document") {
                return;
            }
            var categoryList = header === "document" ? ["current", "recent"] : layerLib.layerKinds,
                categories = Immutable.fromJS(categoryList).filterNot(function (kind) {
                                return (kind === layerLib.layerKinds.ANY || kind === layerLib.layerKinds.GROUPEND ||
                                    kind === layerLib.layerKinds["3D"] || kind === layerLib.layerKinds.VIDEO);
                            }).toList(),
                                   
                filters = categories.map(function (kind) {
                    var title,
                        idType;

                    if (header === "layer") {
                        idType = CATEGORIES.LAYER_KIND[kind];
                        title = CATEGORIES.LAYER_KIND[kind];
                    } else {
                        idType = CATEGORIES[kind.toUpperCase()];
                        title = CATEGORIES[kind.toUpperCase()];
                    }

                    title = title.charAt(0).toUpperCase() + title.slice(1);
                    idType = idType.replace(" ", "");

                    return {
                        id: "filter_" + header + "_" + idType,
                        title: title,
                        category: [header, idType.toLowerCase()],
                        type: "item"
                    };
                }),

                // To search for all layers, documents, etc
                headerTitle = CATEGORIES[header.toUpperCase()];
            headerTitle = headerTitle.charAt(0).toUpperCase() + headerTitle.slice(1);
            var headerFilter = {
                id: "filter_" + header,
                title: headerTitle,
                category: [CATEGORIES[header.toUpperCase()]],
                type: "item"
            };
            
            filters = filters.unshift(headerFilter);

            return filters;
        },

        /**
         * Make list of items and headers to be used as dropdown options
         * @return {Array.<object>}
         */
        _getAllSelectOptions: function () {
            var filterOptions = this._getFilterOptions("layer").concat(this._getFilterOptions("document")),
                layerOptions = this._getLayerOptions(),
                docOptions = this._getCurrDocOptions().concat(this._getRecentDocOptions());
           
            return filterOptions.concat(layerOptions).concat(docOptions);
        },

        /**
         * Find the icons corresponding with the filter
         *
         * @private
         * @param {Array.<string>} filter
         * @return {Array.<string>}
         */
        _getFilterIcons: function (filter) {
            // currently only have icons for layers
            if (filter.length > 1 && filter.join(" ").indexOf("layer") > -1) {
                return svgUtil.getSVGFromLayerType(filter);
            } else {
                return ["tool-rectangle"]; // standin for non-layers
            }
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
                // search to preserve order of layer hierarchy
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
                    
                    if (id.indexOf("filter") === 0) {
                        this._updateFilter(id);
                    }
                    
                    break;
                }
                case "Backspace": {
                    // TODO: should change this to check for if the cursor is at beginning of input,
                    // not just if the input is empty
                    if (!this.refs.datalist.hasNonEmptyInput() && this.state.filter.length > 0) {
                        // For when want to have multiple SVGs, remove them one at a time:
                        // var newFilter = this.state.filter,
                        //     newIcons = this.state.icons;
                        // newFilter.pop();
                        // newIcons.pop();

                        // Clear filter and icons
                        var newFilter = [],
                            newIcons = [];

                        this.setState({
                            filter: newFilter,
                            icons: newIcons
                        });
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
