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
        Immutable = require("immutable");

    var TransformPanel = require("jsx!./sections/transform/TransformPanel"),
        StylePanel = require("jsx!./sections/style/StylePanel"),
        PagesPanel = require("jsx!./sections/pages/PagesPanel");
        
    var Properties = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("document", "application", "preferences")],

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var applicationStore = this.getFlux().store("application"),
                document = applicationStore.getCurrentDocument(),
                preferencesStore = this.getFlux().store("preferences"),
                preferences = preferencesStore.getState(),
                styleVisible = preferences.get("styleVisible", true),
                pagesVisible = preferences.get("pagesVisible", true);

            return {
                document: document,
                styleVisible: styleVisible,
                pagesVisible: pagesVisible
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return this.state.styleVisible !== nextState.styleVisible ||
                this.state.pagesVisible !== nextState.pagesVisible ||
                !Immutable.is(this.state.document, nextState.document);
        },

        /**
         * Toggle visibility of either the pages or the style section.
         *
         * @private
         * @param {boolean} pages Whether the pages or style section is being toggled
         */
        _handleVisibilityToggle: function (pages) {
            var primary = pages ? "pagesVisible" : "styleVisible",
                secondary = pages ? "styleVisible" : "pagesVisible",
                nextState = {};

            if (this.state[primary]) {
                nextState[primary] = false;
                nextState[secondary] = true;
            } else {
                nextState[primary] = true;
            }

            this.getFlux().actions.preferences.setPreferences(nextState);
            this.setState(nextState);
        },
        
        render: function () {
            var document = this.state.document;

            return (
                <div className="properties">
                    <TransformPanel
                        document={document} />
                    <StylePanel 
                        document={document}
                        visible={this.state.styleVisible}
                        visibleSibling={this.state.pagesVisible}
                        onVisibilityToggle={this._handleVisibilityToggle.bind(this, false)} />
                    <PagesPanel 
                        document={document} 
                        visible={this.state.pagesVisible}
                        visibleSibling={this.state.styleVisible}
                        onVisibilityToggle={this._handleVisibilityToggle.bind(this, true)} />
                </div>
            );
        },
        


    });

    module.exports = Properties;
});
