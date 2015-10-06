/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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
        classnames = require("classnames");
        
    var strings = require("i18n!nls/strings"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon");

    var DocumentHeaderTab = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool")],

        getInitialState: function () {
            return {};
        },

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var toolStore = this.getFlux().store("tool"),
                vectorMode = toolStore.getVectorMode();

            return {
                vectorMode: vectorMode
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            var currentDoc = this.props.document,
                nextDoc = nextProps.document;

            return currentDoc.id !== nextDoc.id ||
                currentDoc.name !== nextDoc.name ||
                currentDoc.dirty !== nextDoc.dirty ||
                currentDoc.unsupported !== nextDoc.unsupported ||
                this.props.current !== nextProps.current ||
                this.props.smallTab !== nextProps.smallTab ||
                this.state.vectorMode !== nextState.vectorMode;
        },

        /**
         * Activate the given document on click.
         *
         * @private
         */
        _handleTabClick: function (documentID) {
            var selectedDoc = this.getFlux().store("document").getDocument(documentID);
            if (selectedDoc) {
                this.getFlux().actions.documents.selectDocument(selectedDoc);
            }
        },

        /**
         * Close the given document on click.
         *
         * @private
         */
        _handleTabCloseClick: function (documentID, event) {
            var selectedDoc = this.getFlux().store("document").getDocument(documentID);
            if (selectedDoc) {
                this.getFlux().actions.documents.close(selectedDoc);
            }

            // Prevents _handleTabClick from being triggered as well
            event.stopPropagation();
        },

        render: function () {
            var doc = this.props.document,
                name = doc.name,
                dirty = doc.dirty,
                unsupported = doc.unsupported,
                warning;

            if (unsupported) {
                warning = (
                    <span
                        title={strings.TOOLTIPS.UNSUPPORTED_FEATURES}
                        className="document-controls__unsupported">
                        !
                    </span>
                );
            }

            return (
                <div
                    className={classnames({
                        "document-title": true,
                        "document-title__current": this.props.current,
                        "document-title__small": this.props.smallTab,
                        "document-title__mask": this.state.vectorMode && this.props.current
                    })}
                    onClick={this._handleTabClick.bind(this, doc.id)}>
                    {dirty ? "*" : ""}
                    {name}
                    {warning}
                    <Button
                        className="doc-tab-close"
                        onClick={this._handleTabCloseClick.bind(this, doc.id)}>
                        <SVGIcon
                            viewbox="0 0 18 16"
                            CSSID="close" />
                    </Button>
                </div>
            );
        }
    });

    module.exports = DocumentHeaderTab;
});
