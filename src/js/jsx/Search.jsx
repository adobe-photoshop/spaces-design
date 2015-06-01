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

    var Dialog = require("jsx!./shared/Dialog"),
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

        render: function () {
            return (
                <div>
                    <Dialog
                        id={SEARCH_BAR_DIALOG_ID}
                        modal
                        position={Dialog.POSITION_METHODS.CENTER}
                        dismissOnWindowResize={false}
                        className={"search-bar__dialog"} >
                        <SearchBar
                            dismissDialog={this._closeSearchBar}
                            />

                    </Dialog>
                </div>
            );
        }

    });

    module.exports = Search;
});
