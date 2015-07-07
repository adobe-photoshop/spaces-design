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
        Immutable = require("immutable");

    var os = require("adapter/os"),
        layerLib = require("adapter/lib/layer"),
        mathUtil = require("js/util/math"),
        searchUtil = require("js/util/search"),
        Dialog = require("jsx!./shared/Dialog"),
        SearchBar = require("jsx!./search/SearchBar");

    /**
     * Unique identifier for the Search Bar Dialog
     *
     * @const {String}
     */
    var SEARCH_BAR_DIALOG_ID = "search-bar-dialog";

    var Search = React.createClass({
        mixins: [FluxMixin],

        /**
         * Dismiss the Search Bar Dialog.
         * TODO Note that in React v13 this could be injected by the Dialog directly into the children components
         */
        _closeSearchBar: function () {
            this.getFlux().actions.dialog.closeDialog(SEARCH_BAR_DIALOG_ID);
        },

        /**
         * Make list of items to be used as dropdown options
         * 
         * @return {Array.<object>}
        */
        _getOptions: function () {
            var appStore = this.getFlux().store("application"),
                docStore = this.getFlux().store("document");

            var layers = searchUtil.getLayerOptions(appStore),
                currDocs = searchUtil.getCurrentDocOptions(appStore, docStore),
                recentDocs = searchUtil.getRecentDocOptions(appStore);

            return layers.concat(currDocs).concat(recentDocs);
        },

        /**
         * When confirmed, perform action based on what type of option has been selected.
         * Then, close the search dialog.
         * 
         * @param {string} id ID of selected option
        */
        _handleOption: function (id) {
            // ID has type as first word, followed by the layer/document ID
            var idArray = id.split("_"),
                type = idArray[0],
                idInt = mathUtil.parseNumber(idArray[1]),
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
            case "recent-doc":
                var appStore = this.getFlux().store("application"),
                    recentFiles = appStore.getRecentFiles(),
                    fileName = recentFiles.get(idInt);

                flux.actions.documents.open(fileName);
                break;
            }
            this.refs.searchBar._dismissDialog();
        },

        render: function () {
            var layerCategories = Immutable.List(Object.keys(layerLib.layerKinds)).filterNot(function (kind) {
                return (kind === "ANY" || kind === "GROUPEND" || kind === "3D" || kind === "VIDEO");
            }),
                docCategories = Immutable.List(["CURRENT", "RECENT"]);

            return (
                <div>
                    <Dialog
                        id={SEARCH_BAR_DIALOG_ID}
                        modal
                        position={Dialog.POSITION_METHODS.CENTER}
                        dismissOnCanvasClick={true}
                        dismissOnWindowClick={true}
                        dismissOnWindowResize={false}
                        dismissOnKeys={[{ key: os.eventKeyCode.ESCAPE, modifiers: null }]}
                        className={"search-bar__dialog"} >
                        <SearchBar
                            ref="searchBar"
                            dismissDialog={this._closeSearchBar}
                            searchTypes={["LAYER", "DOCUMENT"]}
                            searchCategories={[layerCategories, docCategories]}
                            getOptions={this._getOptions}
                            executeOption={this._handleOption}
                            />

                    </Dialog>
                </div>
            );
        }

    });

    module.exports = Search;
});
