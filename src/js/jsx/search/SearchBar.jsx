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
                type = idArray.length === 2 ? idArray[0] : "",
                idInt = idArray.length === 2 ? parseInt(idArray[1]) : parseInt(id),
                flux = this.getFlux();

            switch (type) {
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
            }
            this.props.dismissDialog();
        },


        /**
         * Make list of items and headers to be used as dropdown options
         * @return {Array.<Object>}
         */
        _getSelectOptions: function () {
            // get list of layers
            var appStore = this.getFlux().store("application"),
                document = appStore.getCurrentDocument(),
                layers = document.layers.allVisible,
                layerMap = layers.map(function (layer) {
                    return { id: "layer_" + layer.id.toString(), title: layer.name, type: "item" };
                }),
                layerLabel = { id: "layer_header", title: "Layers", type: "header" },
                layerOptions = layerMap.unshift(layerLabel);

            // get list of currently open documents
            var docStore = this.getFlux().store("document"),
                openDocs = Immutable.fromJS(appStore.getOpenDocumentIDs()).filterNot(function (doc) {
                                return doc === document.id;
                            }),
                docMap = openDocs.map(function (doc) {
                    return { id: "curr-doc_" + doc.toString(), title: docStore.getDocument(doc).name, type: "item" };
                }),
                docLabel = { id: "curr-doc_header", title: "Documents", type: "header" },
                docOptions = docMap.unshift(docLabel);

            return layerOptions.concat(docOptions);
        },

        render: function () {
            var searchOptions = this._getSelectOptions();

            return (
                <div
                    onClick={this.props.dismissDialog}>
                   <Datalist
                    live={false}
                    className="dialog-search-bar"
                    options={searchOptions}
                    size="column-25"
                    startFocused={true}
                    placeholderText="Type to search"
                    onChange={this._handleChange}
                    />
                </div>
            );
        }
    });

    module.exports = SearchBar;
});
