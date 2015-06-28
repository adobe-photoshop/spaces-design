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
 *
 * Portions of this code are adapted from react-draggable
 * https://github.com/mzabriskie/react-draggable
 *
 * (MIT License)
 *
 * Copyright (c) 2014 Matt Zabriskie. All rights reserved.
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
 */

define(function (require, exports, module) {
    "use strict";

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React);

    /**
     * Create a composed Droppoable component
     *
     * @param {ReactComponent} Component to wrap
     * @param {string} axis is either "x", "y" or "both" for which axis dragging is allowed
     * @return {ReactComponent}
     */
    var createWithComponent = function (Component, axis) {
        if (typeof axis === "undefined") {
            axis = "both";
        }
        
        var _canDragY = function () {
            return axis === "both" || axis === "y";
        };

        var _canDragX = function () {
            return axis === "both" ||
                axis === "x";
        };

        var Draggable = React.createClass({
            mixins: [FluxMixin],

            componentWillUnmount: function () {
                // Remove any leftover event handlers
                window.removeEventListener("mousemove", this._handleDragMove, true);
                window.removeEventListener("mouseup", this._handleDragFinish, true);
            },

            getDefaultProps: function () {
                return {
                    // What axis dragging works in {"both", "x", "y"}
                    axis: axis,
                    dragTargetClass: "drag_target",
                    dragPlaceholderClass: "drag_placeholder"
                };
            },

            getInitialState: function () {
                return {
                    // Whether or not currently dragging
                    dragging: false,

                    // Start top/left of the DOM node
                    startX: 0, startY: 0,

                    dragClass: this.props.dragTargetClass,

                    dragStyle: {
                        top: null,
                        left: null
                    }
                };
            },

            componentWillReceiveProps: function (nextProps) {
                if (nextProps.dragTarget && nextProps.dragPosition) {
                    if (this.state.offsetY && this.state.offsetX) {
                        var startY = this.state.startY,
                            startX = this.state.startX;

                        this.setState({
                            dragStyle: {
                                top: _canDragY() ? startY + (nextProps.dragPosition.y - this.state.offsetY) : startY,
                                left: _canDragX() ? startX + (nextProps.dragPosition.x - this.state.offsetX) : startX
                            }
                        });
                    } else {
                        this.setState({
                            offsetY: nextProps.dragPosition.y,
                            offsetX: nextProps.dragPosition.x
                        });
                    }
                } else if (this.props.dragTarget && !nextProps.dragTarget) {
                    this.setState({
                        wasDragTarget: true,
                        offsetY: null,
                        offsetX: null
                    });
                } else {
                    this.state.wasDragTarget = false;
                }
            },

            /**
             * Handles the start of a dragging operation by setting up initial position
             * and adding event listeners to the window
             */
            _handleDragStart: function () {
                window.addEventListener("mousemove", this._handleDragMove, true);
                window.addEventListener("mouseup", this._handleDragFinish, true);
                
                var node = React.findDOMNode(this),
                    bounds = node.getBoundingClientRect();

                this.setState({
                    startX: bounds.left,
                    startY: bounds.top,
                    dragStyle: {
                        top: bounds.top,
                        left: bounds.left
                    }
                });
            },

            /**
             * Handles move for a dragging object
             * Registers dragging objects with store
             *
             * @param {Event} event
             */
            _handleDragMove: function (event) {
                var flux = this.getFlux();

                if (!this.state.dragging) {
                    this.setState({
                        dragging: true
                    });

                    if (this.props.onDragStart) {
                        this.props.onDragStart();
                    }

                    var dragItems = this.props.getDragItems(this);
                    flux.store("draganddrop").startDrag(dragItems);
                } else {
                    flux.store("draganddrop").updateDrag(this.props.zone, {
                        x: event.clientX,
                        y: event.clientY
                    });
                }
            },

            /**
             * Handles finish of drag operation
             * Removes drag event listeners from window
             * Resets state
             */
            _handleDragFinish: function () {
                window.removeEventListener("mousemove", this._handleDragMove, true);
                window.removeEventListener("mouseup", this._handleDragFinish, true);

                // Short circuit if not currently dragging
                if (!this.state.dragging) {
                    return;
                }

                // Turn off dragging
                this.setState({
                    dragging: false,
                    offsetY: null,
                    offsetX: null
                });

                this.getFlux().store("draganddrop").stopDrag();
            },

            render: function () {
                return <Component
                    {...this.props}
                    {...this.state}
                    handleDragStart={this._handleDragStart} />;
            }
        });

        return Draggable;
    };

    module.exports = { createWithComponent: createWithComponent };
});
