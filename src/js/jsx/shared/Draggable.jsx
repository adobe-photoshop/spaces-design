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

            propTypes: {
                zone: React.PropTypes.number.isRequired
            },

            componentWillUnmount: function () {
                // Remove any leftover event handlers
                window.removeEventListener("mousemove", this._handleDragMove, true);
                window.removeEventListener("mouseup", this._handleDragFinish, true);
            },

            getDefaultProps: function () {
                return {
                    // What axis dragging works in {"both", "x", "y"}
                    axis: axis,
                    dragPlaceholderClass: "drag_placeholder"
                };
            },

            getInitialState: function () {
                return {
                    // Whether or not currently dragging
                    dragging: false,

                    // Start top/left of the DOM node
                    startX: null, startY: null,
                    dragStyle: null
                };
            },

            componentWillReceiveProps: function (nextProps) {
                if (nextProps.dragTarget) {
                    var startY = this.state.startY,
                        startX = this.state.startX;

                    if (nextProps.dragPosition) {
                        var offsetY, offsetX;
                        
                        if (this.state.offsetY) {
                            offsetY = this.state.offsetY;
                            offsetX = this.state.offsetX;
                        } else {
                            offsetY = nextProps.dragPosition.y;
                            offsetX = nextProps.dragPosition.x;
                        }

                        this.setState({
                            offsetY: offsetY,
                            offsetX: offsetX,
                            dragStyle: {
                                top: _canDragY() ? startY + (nextProps.dragPosition.y - offsetY) : startY,
                                left: _canDragX() ? startX + (nextProps.dragPosition.x - offsetX) : startX
                            }
                        });
                    } else {
                        if (!startY || !startX) {
                            var node = React.findDOMNode(this),
                                bounds = node.getBoundingClientRect();

                            startX = bounds.left;
                            startY = bounds.top;
                            
                            this.setState({
                                startX: startX,
                                startY: startY,
                                dragStyle: {
                                    top: startY,
                                    left: startX
                                }
                            });
                        } else {
                            this.setState({
                                startX: null,
                                startY: null
                            });
                        }
                    }
                } else if (this.props.dragTarget && !nextProps.dragTarget) {
                    this.setState({
                        startX: null,
                        startY: null,
                        wasDragTarget: true,
                        offsetY: null,
                        offsetX: null
                    });
                } else {
                    this.state.wasDragTarget = false;
                }
            },

            /**
             * Suppress the single click event that follows the mouseup event at
             * the end of the drag.
             *
             * @param {SyntheticEvent} event
             */
            _handleDragClick: function (event) {
                event.stopPropagation();
                window.removeEventListener("click", this._handleDragClick, true);
            },

            /**
             * Handles the start of a dragging operation by setting up initial position
             * and adding event listeners to the window
             */
            _handleDragStart: function () {
                window.addEventListener("mousemove", this._handleDragMove, true);
                window.addEventListener("mouseup", this._handleDragFinish, true);
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
                    var dragItems = this.props.getDragItems(this);
                    if (dragItems.isEmpty()) {
                        return;
                    }

                    this.setState({
                        dragging: true
                    });

                    // Suppress the following click event
                    window.addEventListener("click", this._handleDragClick, true);

                    if (this.props.onDragStart) {
                        this.props.onDragStart();
                    }

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
             *
             * @param {SyntheticEvent} event
             */
            _handleDragFinish: function (event) {
                window.removeEventListener("mousemove", this._handleDragMove, true);
                window.removeEventListener("mouseup", this._handleDragFinish, true);

                // Short circuit if not currently dragging
                if (!this.state.dragging) {
                    return;
                }

                // If the mouseup event is outside the window, there won't be an
                // associated click event. In this case, remove the handler explicitly
                // instead of waiting for (and suppressing) the following unrelated
                // click event.
                if (event.target === window.document.documentElement) {
                    window.removeEventListener("click", this._handleDragClick, true);
                }

                if (this.props.onDragStop) {
                    this.props.onDragStop();
                }

                // Turn off dragging
                this.setState({
                    dragging: false
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
