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

    var DocumentHeader = require("jsx!js/jsx/views/PanelList/DocumentHeader"),
        Toolbar = require("jsx!js/jsx/views/Toolbar"),
        TransformPanel = require("jsx!./PanelList/TransformPanel"),
        StylePanel = require("jsx!./PanelList/StylePanel"),
        PagesPanel = require("jsx!./PanelList/PagesPanel"),
        Scrim = require("jsx!js/jsx/views/Scrim");
        
    var PanelList = React.createClass({
        getInitialState: function () {
            return {
                styleVisible: true,
                pagesVisible: true
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
            return (
                <div className="canvas-toolbar-properties">
                    <Scrim/>
                    <Toolbar />
                    <div className="properties">
                        <DocumentHeader />
                        <TransformPanel />
                        <StylePanel
                            visible={this.state.styleVisible}
                            visibleSibling={this.state.pagesVisible}
                            onVisibilityToggle={this._handleVisibilityToggle.bind(this, false)} />
                        <PagesPanel
                            visible={this.state.pagesVisible}
                            visibleSibling={this.state.styleVisible}
                            onVisibilityToggle={this._handleVisibilityToggle.bind(this, true)} />
                    </div>
                </div>
            );
        },
        


    });

    module.exports = PanelList;
});
