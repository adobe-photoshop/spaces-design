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

    var os = require("adapter/os"),
        Dialog = require("jsx!./shared/Dialog"),
        SearchBar = require("jsx!./search/SearchBar");

    /**
     * Unique identifier for the Search Dialog
     *
     * @const
     * @type {string}
     */
    var SEARCH_BAR_DIALOG_ID = "search-bar-dialog";

    var Search = React.createClass({
        mixins: [FluxMixin],

        componentWillMount: function () {
            var searchStore = this.getFlux().store("search");
            searchStore.registerSearch(SEARCH_BAR_DIALOG_ID,
                ["LIBRARY", "ALL_LAYER", "CURRENT_DOC", "RECENT_DOC", "MENU_COMMAND"]);
        },

        /**
         * Dismiss the Search Bar Dialog.
         * TODO Note that in React v13 this could be injected by the Dialog directly into the children components
         *
         * @private
         * @return {Promise}
         */
        _closeSearchBar: function () {
            return this.getFlux().actions.dialog.closeDialog(SEARCH_BAR_DIALOG_ID);
        },

        /**
         * When confirmed, perform action based on what type of option has been selected.
         * Then, close the search dialog.
         * 
         * @private
         * @param {string} itemID ID of selected option
         */
        _handleOption: function (itemID) {
            this._closeSearchBar()
                .bind(this)
                .then(function () {
                    var searchStore = this.getFlux().store("search");
                    searchStore.handleExecute(itemID);
                });
        },

        render: function () {
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
                            searchID={SEARCH_BAR_DIALOG_ID}
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
