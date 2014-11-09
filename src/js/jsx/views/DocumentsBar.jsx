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

    var React = require("react");
    var Fluxxor = require("fluxxor"),
        FluxChildMixin = Fluxxor.FluxChildMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var Toolbar = React.createClass({
        mixins: [FluxChildMixin, StoreWatchMixin("document")],
        
        getInitialState: function () {
            return {};
        },
        
        getStateFromFlux: function () {
            // Just one store for now
            var documentState = this.getFlux().store("document").getState();
            
            return {
                openDocuments: documentState.openDocuments
            };
        },
        
        render: function () {
            var documentItems = Object.keys(this.state.openDocuments).map(function (documentID, index) {
                return (
                    <li key={index}>
                        {this.state.openDocuments[documentID].title}
                    </li>
                );
            }.bind(this));
            
            return (
                <div className="document-bar">
                    <ul>
                        {documentItems}
                    </ul>
                </div>
            );
        }
    });
    
    module.exports = Toolbar;
});


