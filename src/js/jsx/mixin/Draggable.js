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
    
    /** @jsx React.DOM */
    var React = require("react");
    
    var _createPositionObject = function (draggable) {
        return {
            position: {
                top: draggable.state.clientY,
                left: draggable.state.clientX
            }
        };
    };
    
    var _canDragY = function (draggable) {
        return draggable.props.axis === "both" ||
                draggable.props.axis === "y";
    };
    
    var _canDragX = function (draggable) {
        return draggable.props.axis === "both" ||
                draggable.props.axis === "x";
    };
    
    module.exports = {
        componentWillMount: function () {
            this.props.className = this.props.dragTarget;
        },

        componentWillUnmount: function () {
            // Remove any leftover event handlers
            window.removeEventListener("mousemove", this._handleDragMove, true);
            window.removeEventListener("mouseup", this._handleDragFinish, true);
        },
    
        getDefaultProps: function () {
            return {
                // What axis dragging works in {"both", "x", "y"}
                axis: "both",
                start: {
                    x: 0,
                    y: 0
                },
                dragTarget: "drag_target",
                dragPlaceholder: "drag_placeholder"
            };
        },
    
        getInitialState: function () {
            return {
                // Whether or not currently dragging
                dragging: false,
    
                // Start top/left of this.getDOMNode()
                startX: 0, startY: 0,
    
                // Offset between start top/left and mouse top/left
                offsetX: 0, offsetY: 0,
    
                // Current top/left of this.getDOMNode()
                clientX: this.props.start.x, clientY: this.props.start.y,

                dragClass: this.props.dragTarget
            };
        },
    
        _handleDragStart: function (e) {
            var node = this.getDOMNode();
    
            // Call event handler
            if (this.props.onDragStart) {
                this.props.onDragStart(this, e, _createPositionObject(this));
            }
    
            // Initiate dragging
            this.setState({
                dragging: true,
                offsetX: e.clientX,
                offsetY: e.clientY,
                clientX: this.props.start.x,
                clientY: this.props.start.y,
                startX: parseInt(node.style.left, 10) || 0,
                startY: parseInt(node.style.top, 10) || 0,
                dragClass: this.props.dragPlaceholder
            });
    
            // Add event handlers
            window.addEventListener("mousemove", this._handleDragMove, true);
            window.addEventListener("mouseup", this._handleDragFinish, true);
        },
    
        _handleDragFinish: function (e) {
            // Short circuit if not currently dragging
            if (!this.state.dragging) {
                return;
            }

            // Call event handler
            if (this.props.onDragStop) {
                this.props.onDragStop(this, e, _createPositionObject(this));
            }
    

            // Turn off dragging
            this.setState({
                clientX: this.state.startX,
                clientY: this.state.startY,
                dragging: false,
                dragClass: this.props.dragTarget
            });
    
            
            // Remove event handlers
            window.removeEventListener("mousemove", this._handleDragMove, true);
            window.removeEventListener("mouseup", this._handleDragFinish, true);
        },
    
        _handleDragMove: function (e) {
            // Calculate top and left
            var clientX = (this.state.startX + (e.clientX - this.state.offsetX));
            var clientY = (this.state.startY + (e.clientY - this.state.offsetY));
    
            // Call event handler
            if (this.props.onDragMove) {
                this.props.onDragMove(this, e, _createPositionObject(this));
            }

            // Update top and left
            this.setState({
                clientX: clientX,
                clientY: clientY
            });
    
            
        },
    
        componentWillUpdate: function () {
            var style = {};
    
            if (this.state.dragging) {
                style = {
                    // Set top if vertical drag is enabled
                    top: _canDragY(this) ?
                        this.state.clientY :
                        this.state.startY,
    
                    // Set left if horizontal drag is enabled
                    left: _canDragX(this) ?
                        this.state.clientX :
                        this.state.startX
                };
            }

            this.props.style = style;
        }
    };
});


