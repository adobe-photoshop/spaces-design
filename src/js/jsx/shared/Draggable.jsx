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
        FluxMixin = Fluxxor.FluxMixin(React),
        Immutable = require("immutable");

    var math = require("js/util/math");

    /**
     * Distance in pixels before a mousedown+mousemove becomes a drag event.
     * Prevents false drags on Windows.
     *
     * @const
     * @type {number}
     */
    var MIN_DRAG_DISTANCE = 5;

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
            return axis === "both" || axis === "x";
        };

        var Draggable = React.createClass({
            mixins: [FluxMixin],

            propTypes: {
                zone: React.PropTypes.number.isRequired,
                
                /**
                 * Object representing the draggabe target. This will be the default value for 
                 * the *getDragItems* prop when it is null.
                 */
                keyObject: React.PropTypes.object.isRequired,
                
                /**
                 * Optional callback to return a Immutable.List of draged items. It is useful when you want to support 
                 * dragging on multiple items.
                 */
                getDragItems: React.PropTypes.func
            },
            
            componentDidMount: function () {
                this.getFlux().store("draganddrop").on("start-drag", this._handleDNDStoreDrag);
            },

            componentWillUnmount: function () {
                // Remove any leftover event handlers
                window.removeEventListener("mousemove", this._handleDragMove, true);
                window.removeEventListener("mouseup", this._handleDragFinish, true);
                
                this.getFlux().store("draganddrop").removeListener("start-drag", this._handleDNDStoreDrag);
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
                    initialDragPosition: null
                };
            },
            
            /**
             * Handle the "start-drag" event of draganddrop store.
             * @private
             */
            _handleDNDStoreDrag: function () {
                var flux = this.getFlux(),
                    dragTargets = flux.store("draganddrop").getState().dragTargets,
                    // Only dragged targets should listen to the "change" event. This will
                    // improve the overall performance.
                    isDragTarget = dragTargets && dragTargets.includes(this.props.keyObject);
                    
                if (isDragTarget) {
                    flux.store("draganddrop").on("change", this._handleDNDStoreChange);
                }
            },
            
            /**
             * Handle the "change" event of draganddrop store.
             * @private
             */
            _handleDNDStoreChange: function () {
                var flux = this.getFlux(),
                    dndState = flux.store("draganddrop").getState(),
                    initialDragPosition = dndState.initialDragPosition,
                    dragTargets = dndState.dragTargets,
                    nextState = {
                        dragging: dragTargets && dragTargets.includes(this.props.keyObject),
                        dragPosition: dndState.dragPosition,
                        startX: null,
                        startY: null,
                        offsetX: null,
                        offsetY: null,
                        dragStyle: null
                    };
                
                if (nextState.dragging) {
                    nextState.startY = this.state.startY;
                    nextState.startX = this.state.startX;
                        
                    if (!nextState.startY || !nextState.startX) {
                        var node = React.findDOMNode(this),
                            bounds = node.getBoundingClientRect();

                        nextState.startX = bounds.left;
                        nextState.startY = bounds.top;
                        nextState.dragStyle = {
                            top: nextState.startY,
                            left: nextState.startX
                        };
                    } else if (nextState.dragPosition) {
                        nextState.offsetY = this.state.offsetY;
                        nextState.offsetX = this.state.offsetX;
                        
                        if (!nextState.offsetY) {
                            nextState.offsetY = initialDragPosition.y;
                            nextState.offsetX = initialDragPosition.x;
                        }

                        nextState.dragStyle = {
                            top: _canDragY() ?
                                nextState.startY + (nextState.dragPosition.y - nextState.offsetY) : nextState.startY,
                            left: _canDragX() ?
                                nextState.startX + (nextState.dragPosition.x - nextState.offsetX) : nextState.startX
                        };
                    }
                } else {
                    // Remove the listenner when it is dropped.
                    flux.store("draganddrop").removeListener("change", this._handleDNDStoreChange);
                }

                this.setState(nextState);
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
             * Position of the original mousedown event. Used to measure the distance
             * of each mousemove event. The drag is not started until mousemove events
             * reach the MIN_DRAG_DISTANCE threshold.
             *
             * @private
             * @type {?{x: number, y: number}}
             */
            _mousedownPosition: null,

            /**
             * Handles the start of a dragging operation by setting up initial position
             * and adding event listeners to the window
             *
             * @private
             * @param {SyntheticEvent} event
             */
            _handleDragStart: function (event) {
                this._mousedownPosition = {
                    x: event.clientX,
                    y: event.clientY
                };

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
                var dndStore = this.getFlux().store("draganddrop");
                var position = {
                    x: event.clientX,
                    y: event.clientY
                };
    
                if (!this.state.dragging) {
                    var distance = math.distance(position.x, position.y,
                        this._mousedownPosition.x, this._mousedownPosition.y);
                    if (distance < MIN_DRAG_DISTANCE) {
                        // Do not start the drag until the distance reaches a
                        // threshold to prevent false drags on Windows.
                        return;
                    }

                    var dragItems = this.props.getDragItems ?
                            this.props.getDragItems(this) : Immutable.List([this.props.keyObject]);
                    
                    if (dragItems.isEmpty()) {
                        return;
                    }

                    // Suppress the following click event
                    window.addEventListener("click", this._handleDragClick, true);

                    if (this.props.onDragStart) {
                        this.props.onDragStart();
                    }
                    
                    dndStore.startDrag(dragItems, position);
                } else {
                    dndStore.updateDrag(this.props.zone, position);
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

                this._mousedownPosition = null;

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
                } else {
                    // The following click event sometimes never arrives, so just
                    // remove the handler after a short timeout.
                    window.setTimeout(function () {
                        window.removeEventListener("click", this._handleDragClick, true);
                    }.bind(this), 100);
                }

                if (this.props.onDragStop) {
                    this.props.onDragStop();
                }
                
                this.getFlux().store("draganddrop").stopDrag();
            },

            render: function () {
                return (
                    <Component
                        {...this.props}
                        isDragging={this.state.dragging}
                        dragPosition={this.state.dragPosition}
                        dragStyle={this.state.dragStyle}
                        handleDragStart={this._handleDragStart} />
                );
            }
        });

        return Draggable;
    };

    module.exports = { createWithComponent: createWithComponent };
});
