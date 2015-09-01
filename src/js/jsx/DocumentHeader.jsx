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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Immutable = require("immutable"),
        classnames = require("classnames");
    
    var DocumentHeaderTab = require("jsx!js/jsx/DocumentHeaderTab");

    var DocumentHeader = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("application", "document")],

        getInitialState: function () {
            return {};
        },

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var applicationStore = this.getFlux().store("application"),
                applicationState = applicationStore.getState(),
                documentIDs = applicationState.documentIDs,
                document = applicationStore.getCurrentDocument(),
                count = applicationStore.getDocumentCount();

            return {
                document: document,
                documentIDs: documentIDs,
                count: count
            };
        },

        /** @ignore */
        _updateTabContainerScroll: function () {
            var currentTab = window.document.querySelector(".document-title__current");
            if (currentTab) {
                var container = React.findDOMNode(this.refs.tabContainer),
                    bounds = currentTab.getBoundingClientRect();

                if (bounds.left < 0) {
                    container.scrollLeft = 0;
                } else if (bounds.right > container.clientWidth) {
                    container.scrollLeft = bounds.right;
                }
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return this.state.count !== nextState.count ||
                this.state.headerWidth !== nextState.headerWidth ||
                !Immutable.is(this.state.documentIDs, nextState.documentIDs) ||
                !Immutable.is(this.state.document, nextState.document);
        },

        componentDidMount: function () {
            this._updateTabContainerScroll();

            this.setState({
                headerWidth: React.findDOMNode(this).clientWidth
            });
            
            window.addEventListener("resize", this._handleWindowResize);
        },
        
        componentWillUnmount: function () {
            window.removeEventListener("resize", this._handleWindowResize);
        },

        componentDidUpdate: function () {
            this._updateTabContainerScroll();
        },

        /**
         * Update the state with the size of the header element on resize
         */
        _handleWindowResize: function () {
            this.setState({
                headerWidth: React.findDOMNode(this).clientWidth
            });
        },
        
        /** @ignore */
        _handleTabClick: function (documentID) {
            var selectedDoc = this.getFlux().store("document").getDocument(documentID);
            if (selectedDoc) {
                this.getFlux().actions.documents.selectDocument(selectedDoc);
            }
        },

        render: function () {
            var documentStore = this.getFlux().store("document"),
                document = this.state.document,
                smallTab = this.state.headerWidth / this.state.documentIDs.size < 175;
            // Above: This number tunes when tabs should be shifted to small tabs

            var containerClassName = classnames({
                "document-container": true,
                "document-container__withdoc": !!document
            });

            var documentTabs = this.state.documentIDs.map(function (docID) {
                var doc = documentStore.getDocument(docID);
                
                if (doc) {
                    return (
                        <DocumentHeaderTab
                            key={"docheader" + docID}
                            smallTab={smallTab}
                            name={doc.name}
                            dirty={doc.dirty}
                            unsupported={doc.unsupported}
                            onClick={this._handleTabClick.bind(this, docID)}
                            current={document && docID === document.id} />
                    );
                }
            }, this);

            return (
                <div className={containerClassName} >
                    <div className="document-header" ref="tabContainer">
                            {documentTabs}
                    </div>
                </div>
            );
        }
    });

    module.exports = DocumentHeader;
});
