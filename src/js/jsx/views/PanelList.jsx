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

    var PanelList = React.createClass({
        getInitialState: function () {
            return {};
        },
        
        render: function () {
            var transformHeight = this.state.transformCollapsed ? 3 : 15;
            var styleHeight = this.state.styleCollapsed ? 3: 60;
            var pagesHeight = this.props.windowHeightInRem - transformHeight - styleHeight;

            var tools = "newSelect,rectangle,ellipse,pen,layout,,typeCreateOrEdit,eyedropper,code,hideShowPS".split(",");
            
            // allPanels div used to be AutoScrollPanelContainer
            return (
                <div className="properties-toolbar-container">
                    <Toolbar tools={tools} />
                    <div id="allPanels" className="properties"> 
                        <Transform onCollapse={this.onCollapseTransform}/>
                        <Style onCollapse={this.onCollapseStyle}/>
                        <Pages onCollapse={this.onCollapsePages} remHeight={pagesHeight}/>
                        <PopoverHost/>
                    </div>
                </div>
            );
        },
        
        onCollapseTransform: function (collapsed) {
            this.setState({transformCollapsed: collapsed});
        },
        onCollapseStyle: function (collapsed) {
            this.setState({styleCollapsed: collapsed});
        },
        onCollapsePages: function (collapsed) {
            this.setState({pagesCollapsed: collapsed});
        }
    });

    module.exports = PanelList;
});
