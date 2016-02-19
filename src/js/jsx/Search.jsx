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
        FluxMixin = Fluxxor.FluxMixin(React);

    var os = require("adapter").os,
        Dialog = require("./shared/Dialog"),
        SearchBar = require("./search/SearchBar"),
        search = require("js/stores/search");

    var Search = React.createClass({
        mixins: [FluxMixin],

        /**
         * Dismiss the Search Bar Dialog.
         * TODO Note that in React v13 this could be injected by the Dialog directly into the children components
         *
         * @private
         * @return {Promise}
         */
        _closeSearchBar: function () {
            return this.getFlux().actions.dialog.closeDialog(search.SEARCH_BAR_DIALOG_ID);
        },

        /**
         * When confirmed, perform action based on what type of option has been selected.
         * Then, close the search dialog.
         * 
         * @private
         * @param {string} itemID ID of selected option
         * @param {function=} noOptionsFn function to execute if there are no options
         */
        _handleOption: function (itemID, noOptionsFn) {
            var searchStore = this.getFlux().store("search");
            this._closeSearchBar()
                .bind(this)
                .then(function () {
                    // If there is a noOptionsFn, this indicates we want the default option,
                    // that is present in the datalist when there are no results available,
                    // to execute some behavior if selected. E.g. Selecting the filter
                    // "Adobe Stock" defaults into "Search Adobe Stock..." and upon selection
                    // we want it to execute a function to open the Stock homepage 
                    if (noOptionsFn) {
                        noOptionsFn(itemID);
                    }
                    // If there is noOptionsFn, this indicates the datalist has results available.
                    else {
                        if (itemID) {
                            searchStore.handleExecute(itemID);
                        }
                    }
                });
        },

        render: function () {
            return (
                <div>
                    <Dialog
                        id={search.SEARCH_BAR_DIALOG_ID}
                        modal
                        position={Dialog.POSITION_METHODS.CENTER}
                        dismissOnCanvasClick={true}
                        dismissOnWindowClick={true}
                        dismissOnWindowResize={false}
                        dismissOnDialogOpen={false}
                        dismissOnKeys={[{ key: os.eventKeyCode.ESCAPE, modifiers: null }]}
                        className={"search-bar__dialog"} >
                        <SearchBar
                            ref="searchBar"
                            searchID={search.SEARCH_BAR_DIALOG_ID}
                            dismissDialog={this._closeSearchBar}
                            executeOption={this._handleOption}
                            />
                    </Dialog>
                </div>
            );
        }
    });

    module.exports = Search;
});
