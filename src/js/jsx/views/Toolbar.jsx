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

    var Toolbar = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool")],

        /**
         * Ordered list of toolIDs that make up the toolbar layout
         * 
         * @private
         * @type {Array.<string>}
         */
        _layout: [
            "newSelect",
            "typeCreateOrEdit",
            null,
            "rectangle",
            "ellipse",
            "pen",
            "eyedropper"
        ],

        getInitialState: function () {
            return {
                expanded: false
            };
        },
        
        getStateFromFlux: function () {
            // Maybe later on contextStore will send us list of context specific tools
            var toolState = this.getFlux().store("tool").getState();

            return {
                currentTool: toolState.current,
                previousTool: toolState.previous
            };
        },

        render: function () {
            if (this.state.expanded) {
                return this._renderExpanded();
            } else {
                return this._renderCollapsed();
            }
        },

        /**
         * Get a CSS ID for the given tool
         * 
         * @private
         * @param {Tool} tool
         * @return {string}
         */
        _getToolCSSID: function (tool) {
            return "tool-" + tool.id;
        },

        /**
         * Render the collapsed toolbar
         * 
         * @private
         * @return {ReactComponent}
         */
        _renderCollapsed: function () {
            var tool = this.state.currentTool;

            if (!tool) {
                return (<div className="toolbar-current"/>);
            }

            var CSSID = this._getToolCSSID(tool),
                currentToolStyle = {
                zIndex: -1000,
                backgroundImage:"url(img/ico-" + CSSID + "-white.svg)",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center"
            };

            return (
                <div className="toolbar-current">
                    <ul>
                        <li>
                            <button 
                                className="tool-current"
                                style={currentToolStyle}
                                onClick={this._expandToolbar}
                            />
                        </li>
                    </ul>
                </div>
            );
        },
        
        /**
         * Render the expanded toolbar
         * 
         * @private
         * @return {ReactComponent}
         */
        _renderExpanded: function () {
            var toolStore = this.getFlux().store("tool"),
                tools = this._layout.map(function (toolID, index) {
                    // Return spacer for null elements
                    if (!toolID) {
                        return (<li key={index} className='tool-spacer'/>);
                    }

                    var tool = toolStore.getToolByID(toolID),
                        CSSID = this._getToolCSSID(tool);

                    return (
                        <li key={index}>
                            <button 
                                id={CSSID}
                                onClick={this._handleToolbarButtonClick.bind(this, tool)}
                            />
                        </li>
                    );

                }, this);
            
            return (
                <div className="toolbar-pop-over" onBlur={this._collapseToolbar}>
                    <ul>
                    {tools}
                    </ul>
                </div>
            );
        },

        /**
         * Expand the toolbar
         * 
         * @private
         */
        _expandToolbar: function () {
            this.setState({expanded: true});
        },

        /**
         * Collapse the toolbar
         *
         * @private
         */
        _collapseToolbar: function () {
            this.setState({expanded: false});
        },

        /**
         * Handle toolbar button clicks by selecting the given tool and
         * collapsing the toolbar.
         * 
         * @private
         */
        _handleToolbarButtonClick: function (tool) {
            if (tool) {
                this.getFlux().actions.tools.select(tool);
            }

            this._collapseToolbar();
        }
    });
    
    module.exports = Toolbar;
});


