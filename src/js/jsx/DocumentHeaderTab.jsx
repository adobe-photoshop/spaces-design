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
            return this.props.current !== nextProps.current ||
                this.props.dirty !== nextProps.dirty ||
                this.props.name !== nextProps.name ||
                this.props.smallTab !== nextProps.smallTab ||
                this.props.maskMode !== nextProps.maskMode ||
                this.state.vectorMode !== nextState.vectorMode;
        },

        render: function () {
            var warning;

            if (this.props.unsupported) {
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
                    onClick={this.props.onClick}>
                    {this.props.dirty ? "*" : ""}
                    {this.props.name}
                    {warning}
                    <Button
                        className="doc-tab-close">
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
