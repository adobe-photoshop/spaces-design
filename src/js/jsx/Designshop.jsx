/** @jsx React.DOM */
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
        Fluxxor = require("fluxxor");

    var FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;
        
    var HUD = require("jsx!js/jsx/views/HUD"),
        DocumentsBar = require("jsx!js/jsx/views/DocumentsBar"),
        PanelList = require("jsx!js/jsx/views/PanelList");

    var DesignShop = React.createClass({
        mixins: [FluxMixin],

        /**
         * We handle keydown events through the adapter if and only if the
         * active element is the body.
         * 
         * @param {KeyboardEvent} event
         */
        _suppressBodyKeydown: function (event) {
            if (event.target === document.body) {
                event.preventDefault();
            }
        },
        
        componentWillMount: function() {
            document.body.addEventListener("keydown", this._suppressBodyKeydown, true);
        },

        componentWillUnmount: function() {
            document.body.removeEventListener("keydown", this._suppressBodyKeydown);
        },

        render: function () {
            return (
                <div>
                    <DocumentsBar />
                    <HUD/>
                    <PanelList />
                </div>
            );
        }
    });

    module.exports = DesignShop;
});
