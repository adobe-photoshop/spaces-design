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
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var Button = require("jsx!js/jsx/shared/Button"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        strings = require("i18n!nls/strings");

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
                document = applicationStore.getCurrentDocument(),
                count = applicationStore.getDocumentCount();

            return {
                document: document,
                count: count
            };
        },
        /**
         * Scrolls back one document, wrapping around if necessary
         */
        _moveBack: function () {
            this.getFlux().actions.documents.selectPreviousDocument();
        },
        
        /**
         * Scrolls forward a document, wrapping around if necessary
         */
        _moveForward: function () {
            this.getFlux().actions.documents.selectNextDocument();
        },
    
        render: function () {
            var document = this.state.document,
                dirty = document && document.dirty ? "•" : "",
                header = document ? document.name : "",
                disabled = this.state.count < 2,
                warning = document && document.unsupported && (
                    <span
                        title={strings.TOOLTIPS.UNSUPPORTED_FEATURES}
                        className="document-controls__unsupported">
                        !
                    </span>
                );

            var containerClassName = React.addons.classSet({
                "document-container": true,
                "document-container__withdoc": !!document
            });

            var prevClassName = React.addons.classSet({
                "document-controls__previous": true,
                "document-controls__previous__disabled": disabled,
                "column-2": true
            });

            var nextClassName = React.addons.classSet({
                "document-controls__next": true,
                "document-controls__next__disabled": disabled,
                "column-2": true
            });

            return (
                <div className={containerClassName}>
                    <div className="document-controls">
                        <Gutter size="column-half"/>
                        <Button
                            title={strings.TOOLTIPS.SELECT_PREVIOUS_DOCUMENT}
                            className={prevClassName}
                            onClick={this._moveBack} />
                        <Gutter />
                        <Button
                            title={strings.TOOLTIPS.SELECT_NEXT_DOCUMENT}
                            className={nextClassName}
                            onClick={this._moveForward} />
                    </div>
                    <div className="document-header">
                        <div className="document-title" title={header}>
                            {header}
                            {dirty}
                            {warning}
                        </div>
                    </div>
                </div>
            );
        },
    });

    module.exports = DocumentHeader;
});
