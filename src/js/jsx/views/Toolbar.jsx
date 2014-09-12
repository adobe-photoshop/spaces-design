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

    var Toolbar = React.createClass({
        mixins: [FluxChildMixin, StoreWatchMixin("tool")],
        
        getInitialState: function () {
            return {
                
            };
        },
        
        getStateFromFlux: function () {
            // Maybe later on contextStore will send us list of context specific tools
            var toolState = this.getFlux().store("tool").getState();
            console.log(toolState.currentTool);
            return {
                currentTool: toolState.currentTool,
                toolList: toolState.toolList
            };
            
        },
        render: function () {
            return this.state.popped ? this.renderPopped() : this.renderCurrent();
        },
        popOpen: function () {
            this.setState({popped: true});
        },
        dismiss: function () {
            this.setState({popped: false});
        },
        
        renderCurrent: function () {
            var currentToolStyle = {
                zIndex: -1000,
                backgroundImage:"url(img/ico-tool-"+this.state.currentTool+"-white.svg)",
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
                                onClick={this.popOpen}
                            />
                        </li>
                    </ul>

                </div>
            );
        },
        
        renderPopped: function () {
            var tools = this.state.toolList.map(function (tool, index) {
                var toolName = tool;
                if (tool === "") {
                    toolName = "spacer"
                }
                
                return (
                    <ToolButton 
                        id={"tool-" + toolName} 
                        toolName={tool} 
                        key={index}
                        parent={this}
                    />
                );
            }.bind(this));
            
            return (
                <div className="toolbar-pop-over" onBlur={this.dismiss}>
                    <ul>
                    {tools}
                    </ul>
                </div>
            );
        }
    });
    
    var ToolButton = React.createClass({
        mixins: [FluxChildMixin],
        
        render: function () {
            return (
                <li>
                    <button id={this.props.id} onClick={this.handleClick}></button>
                </li>
            );
        },

        handleClick:  function() {
            this.getFlux().actions.tools.select(this.props.toolName);

            this.props.parent.dismiss();
        }
    });
    
    module.exports = Toolbar;
});


