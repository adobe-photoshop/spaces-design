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
    var React = require("react");
    var Fluxxor = require("fluxxor"),
        FluxChildMixin = Fluxxor.FluxChildMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var DocumentHeader = React.createClass({
        mixins: [FluxChildMixin, StoreWatchMixin("document", "application")],
        
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                docState = flux.store("document").getState(),
                appState = flux.store("application").getState(),
                currentDocument = docState.openDocuments[appState.selectedDocumentID],
                header = currentDocument ? currentDocument.title : "Photoshop",
                currentDocIndex = appState.selectedDocumentIndex,
                documentIDs = appState.documentIDs;

            
            return {
                header: header,
                currentDocIndex: currentDocIndex,
                documentIDs: documentIDs
            };
        },
        
        /**
         * Scrolls back one document, wrapping around if necessary
         */
        _moveBack: function () {
            var finalIndex = this.state.currentDocIndex - 1,
                docCount = this.state.documentIDs.length;
            
            finalIndex = finalIndex < 0 ? docCount - 1 : finalIndex;

            var documentID = this.state.documentIDs[finalIndex];
            this.getFlux().actions.documents.selectDocument(documentID);
        },
        
        /**
         * Scrolls forward a document, wrapping around if necessary
         */
        _moveForward: function () {
            var finalIndex = this.state.currentDocIndex + 1,
                docCount = this.state.documentIDs.length;

            finalIndex = finalIndex === docCount ? 0 : finalIndex;

            var documentID = this.state.documentIDs[finalIndex];
            this.getFlux().actions.documents.selectDocument(documentID);
        },
    
        render: function () {

            return (
                <header className={this.props.className}>
                    <button className="documentNext" onClick={this._moveBack}>&lt;</button>
                    <h2>
                        {this.state.header}
                    </h2>
                    <button className="documentPrevious" onClick={this._moveForward}>&gt;</button>
                </header>
            );
        },
    });

    module.exports = DocumentHeader;
});