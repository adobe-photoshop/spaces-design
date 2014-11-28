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
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var DocumentHeader = require("jsx!./sections/DocumentHeader"),
        TransformPanel = require("jsx!./sections/transform/TransformPanel"),
        StylePanel = require("jsx!./sections/style/StylePanel"),
        PagesPanel = require("jsx!./sections/pages/PagesPanel");
        
    var Panel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("layer", "document", "application")],

        getInitialState: function () {
            return {
                styleVisible: true,
                pagesVisible: true
            };
        },

        /**
         * Get the active document and active/selected layers from flux, and put in state
         */
        getStateFromFlux: function () {
            var applicationStore = this.getFlux().store("application"),
                document = applicationStore.getCurrentDocument();

            return {
                document: document,
            };
        },

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

            this.setState(nextState);
        },
        
        render: function () {
            var document = this.state.document,
                layers = document ? document.getSelectedLayers() : [];

            return (
                <div className="properties">
                    <DocumentHeader
                        document={document} />
                    <TransformPanel
                        document={document}
                        layers={layers} />
                    <StylePanel 
                        document={document}
                        layers={layers}
                        visible={this.state.styleVisible}
                        visibleSibling={this.state.pagesVisible}
                        onVisibilityToggle={this._handleVisibilityToggle.bind(this, false)} />
                    <PagesPanel 
                        document={document} 
                        layers={layers}
                        visible={this.state.pagesVisible}
                        visibleSibling={this.state.styleVisible}
                        onVisibilityToggle={this._handleVisibilityToggle.bind(this, true)} />
                </div>
            );
        },
        


    });

    module.exports = Panel;
});
