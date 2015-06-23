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
        collection = require("js/util/collection");
    
    var MAX_OPTIONS = 5;

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
                filter: []
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

            var idArray = id.split("_"),
                type = idArray.length > 0 ? idArray[0] : "",
                idInt = idArray.length > 1 ? parseInt(idArray[1]) : parseInt(id),
                flux = this.getFlux();

            switch (type) {
            case "filter":
                this._updateFilter(idArray);
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
                var fileName = idArray[1];
                
                if (idArray.length > 2) {
                    // There are underscores in the file name, so calling split separated the file name
                    fileName = id.substring(id.indexOf("_") + 1);
                }

                flux.actions.documents.open(fileName);
                break;
            }
            this.props.dismissDialog();
        },

        /**
         * Updates this.state.filter to be values contained in the filter id
         *
         * @param {Array.<string>} id, ie ["filter", "layer", "text"]
         */
        _updateFilter: function (id) {
            var filterValues = _.drop(id),
                updatedFilter = this.state.filter.concat(filterValues);
                
            this.setState({
                filter: _.uniq(updatedFilter)
            });

            this.refs.datalist.resetInput();
        },

        /**
         * Get the class name for the layer face icon for the layer
         *
         * @private
         * @param {Layer} layer
         * @return {string}
         */
        _getSVGInfo: function (layer) {
            var iconID = "layer-";
            if (layer.isArtboard) {
                iconID += "artboard";
            } else if (layer.kind === layer.layerKinds.BACKGROUND) {
                iconID += layer.layerKinds.PIXEL;
            } else if (layer.kind === layer.layerKinds.SMARTOBJECT && layer.isLinked) {
                iconID += layer.kind + "-linked";
            } else {
                iconID += layer.kind;
            }
            
            return iconID;
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

            ancestors.skip(1).forEach(function (ancestor) {
                ancestorNames += ("/" + ancestor.name);
            });
            return ancestorNames;
        },

        /**
         * Get the layer type
         *
         * @private
         * @param {Layer} layer
         * @return {Array.<string>}
         */
        _getLayerType: function (layer) {
            var layerType = ["layer"];
            _.forEach(Object.keys(layer.layerKinds), function (kind) {
                if (layer.kind === layer.layerKinds[kind]) {
                    if (kind === "SMARTOBJECT") {
                        layerType.push("smart object");
                    } else if (kind === "SOLIDCOLOR") {
                        layerType.push("solid color");
                    } else {
                        layerType.push(kind.toLowerCase());
                    }
                }
            });
            return layerType;
        },

        /**
         * Make list of layers in the current document to be used as dropdown options
         * 
         * @return {Array.<Object>}
         */
        _getLayerOptions: function () {
            // Get list of layers
            var appStore = this.getFlux().store("application"),
                document = appStore.getCurrentDocument(),
                layers = document.layers.allVisible.reverse(),
                layerMap = layers.map(function (layer) {
                    // Used to determine the layer face icon
                    var iconID = this._getSVGInfo(layer),
                        ancestry = this._formatLayerAncestry(layer),
                        layerType = this._getLayerType(layer);

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
                shortenedPaths = pathUtil.getShortestUniquePaths(ancestors.toArray());

            layerMap.map(function (layerItem, index) {
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
                    title: "Layers",
                    type: "header"
                },
                layerOptions = layerMap.unshift(layerLabel);

            return layerOptions;
        },

        /**
         * Make list of currently open documents to be used as dropdown options
         * 
         * @return {Array.<Object>}
         */
        _getCurrDocOptions: function () {
            var appStore = this.getFlux().store("application"),
                docStore = this.getFlux().store("document"),
                document = appStore.getCurrentDocument(),
                openDocs = Immutable.fromJS(appStore.getOpenDocumentIDs()).filterNot(function (doc) {
                                return doc === document.id;
                            }),
                docMap = openDocs.map(function (doc) {
                    return {
                        id: "curr-doc_" + doc.toString(),
                        title: docStore.getDocument(doc).name,
                        type: "item",
                        category: ["document", "current"]
                    };
                }),
                docLabel = {
                    id: "curr-doc_header",
                    title: "Current Documents",
                    type: "header"
                },

                docOptions = docMap.unshift(docLabel);

            return docOptions;
        },

        /**
         * Make list of recent documents to be used as dropdown options
         * 
         * @return {Array.<Object>}
         */
        _getRecentDocOptions: function () {
            var appStore = this.getFlux().store("application"),
                recentFiles = appStore.getRecentFiles(),
                recentDocMap = recentFiles.map(function (doc) {
                    return {
                        id: "recent-doc_" + doc,
                        title: pathUtil.getShortestUniquePaths([doc])[0],
                        type: "item",
                        info: doc,
                        displayInfo: doc,
                        category: ["document", "recent"]
                    };
                });
            
            // Get shortest unique file path
            var paths = collection.pluck(recentDocMap, "info"),
                shortenedPaths = pathUtil.getShortestUniquePaths(paths);

            recentDocMap.map(function (docItem, index) {
                docItem.displayInfo = shortenedPaths[index];
            });

            var recentDocLabel = {
                    id: "recent-doc_header",
                    title: "Recent Documents",
                    type: "header"
                };

            recentDocMap.unshift(recentDocLabel);

            return recentDocMap;
        },

        /**
         * Make list of search category dropdown options based on header
         * 
         * @param {string} header, either "layer" or "document"
         * @return {Array.<Object>}
         */
        _getFilterOptions: function (header) {
            if (header !== "layer" && header !== "document") {
                return;
            }
            var categoryList = header === "document" ? ["current", "recent"] : Object.keys(layerLib.layerKinds),
                categories = Immutable.fromJS(categoryList).filterNot(function (kind) {
                                                return (kind === "ANY" || kind === "GROUPEND" ||
                                                    kind === "3D" || kind === "VIDEO");
                                            }),
                                   
                filters = categories.map(function (kind) {
                    var idType = kind.toLowerCase(),
                        title = kind.toLowerCase();

                    title = title.charAt(0).toUpperCase() + title.slice(1) + "s";

                    switch (idType) {
                    case "smartobject":
                        title = "Smart Objects";
                        break;
                    case "solidcolor":
                        title = "Solid Colors";
                        break;
                    case "text":
                        title = "Text";
                        break;
                    }

                    return {
                        id: "filter_" + header + "_" + idType,
                        title: title,
                        category: [header, title.toLowerCase()],
                        type: "item"
                    };
                }),

                // To search for all layers, documents, etc
                headerTitle = header.charAt(0).toUpperCase() + header.slice(1) + "s",
                headerFilter = {
                    id: "filter_" + header,
                    title: headerTitle,
                    category: [header],
                    type: "item"
                };
            
            filters = filters.unshift(headerFilter);

            return filters;
        },

        /**
         * Make list of items and headers to be used as dropdown options
         * @return {Array.<Object>}
         */
        _getAllSelectOptions: function () {
            var filterOptions = this._getFilterOptions("layer").concat(this._getFilterOptions("document")),
                layerOptions = this._getLayerOptions(),
                currentDocOptions = this._getCurrDocOptions(),
                recentDocOptions = this._getRecentDocOptions();
           
            return filterOptions.concat(layerOptions)
                                .concat(currentDocOptions).concat(recentDocOptions);
        },

        /**
         * Find options to show in the Datalist drop down
         *
         * @return {Array.<Object>}
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

                // Removing this for now because it makes search too broad
                // If option has info, search for it with and without '/' characters
                // Don't check each word individually because want search to preserve order of layer hierarchy
                // var info = option.info ? option.info.toLowerCase() : "",
                //     searchableInfo = info.concat(info.replace(/\//g, " "));
                
                // if (searchableInfo.indexOf(searchTerm) > -1) {
                //     return true;
                // }

                // Check each word of search term for category and title
                var useTerm = true,
                    title = option.title.toLowerCase(),
                    category = option.category || [];
            
                if (option.id.indexOf("filter") === 0) {
                    // Don't want to show filter options based on whole title, just the category itself
                    title = option.category.join(" ");

                    // If it is the filter option for something that we already have filtered, don't
                    // show that filter option
                    if (_.isEqual(this.state.filter, option.category)) {
                        return false;
                    }
                }

                var searchTerms = searchTerm.split(" ");

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

                useTerm = false;
                // At least one term in the search box must be in the option's title
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
                    var id = this.refs.datalist.getSelected(),
                        idArray = id ? id.split("_") : [],
                        type = idArray.length > 0 ? idArray[0] : "";
                    
                    if (type === "filter") {
                        this._updateFilter(idArray);
                    }
                    
                    break;
                }
                case "Backspace": {
                    if (!this.refs.datalist.hasNonEmptyInput() && this.state.filter.length > 0) {
                        var newFilter = this.state.filter;
                        newFilter.pop();
                        this.setState({
                            filter: newFilter
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
                    <div
                        className="label">
                        {this.state.filter}
                    </div>
                   <Datalist
                    ref="datalist"
                    live={false}
                    className="dialog-search-bar"
                    options={searchOptions}
                    size="column-25"
                    startFocused={true}
                    placeholderText="Type to search"
                    filter={this._filterSearch}
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
