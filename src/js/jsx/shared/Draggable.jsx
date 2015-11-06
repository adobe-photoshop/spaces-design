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

    var Draggable = React.createClass({
        mixins: [FluxMixin],
        
        /**
         * True if the target is in drag mode.
         *
         * @private
         * @type {boolean}
         */
        _isDragging: false,
        
        /**
         * The HTML element that is mounted with the Draggable's child component.
         *
         * @private
         * @type {HTMLElement?}
         */
        _childElement: null,
        
        /**
         * The initial bounds of the _childElement when a drag event is initiated.
         *
         * @private
         * @type {{top: number, left: number}?}
         */
        _initialBounds: null,
        
        /**
         * Position of the original mousedown event. Used to measure the distance
         * of each mousemove event. The drag is not started until mousemove events
         * reach the MIN_DRAG_DISTANCE threshold.
         *
         * @private
         * @type {?{x: number, y: number}}
         */
        _mousedownPosition: null,

        propTypes: {
            // Type of the "target".
            type: React.PropTypes.string.isRequired,
            
            // The object passed to the Droppable component when dropped. This value can be overwritten by the 
            // optional callback "beforeDragStart".
            target: React.PropTypes.object.isRequired,

            /**
             * @callback Draggable~beforeDragStart
             * @return {object=}
             *         Return {continue: false} will cancel the drag event.
             *         Return {draggedTargets: Immutable.List.<object>} can assign different drag targets.
             */
            beforeDragStart: React.PropTypes.func,
            
            /**
             * @callback Draggable~onDragStart
             */
            onDragStart: React.PropTypes.func,
            
            /**
             * @callback Draggable~onDrag
             * @param {{x: number, y: number}} dragPosition
             * @param {{x: number, y: number}} dragOffset - The offset of the initial and current drag positions. 
             * @param {{x: number, y: number}} initialDragPosition
             * @param {{top: number, left: number}} initialBounds
             */
            onDrag: React.PropTypes.func,
            
            /**
             * @callback Draggable~onDragStop
             */
            onDragStop: React.PropTypes.func
        },
        
        componentDidMount: function () {
            this.getFlux().store("draganddrop").on("start-drag", this._handleDNDStoreDrag);
            this._listenToChildClickEvent();
        },
        
        componentDidUpdate: function () {
            this._listenToChildClickEvent();
        },

        componentWillUnmount: function () {
            // Remove any leftover event handlers
            window.removeEventListener("mousemove", this._handleMouseMove, true);
            window.removeEventListener("mouseup", this._handleMouserUp, true);
            
            this.getFlux().store("draganddrop").removeListener("start-drag", this._handleDNDStoreDrag);
        },
        
        /**
         * Listen the mousedown event on the child HTML element to recognize a drag event.
         *
         * @private
         */
        _listenToChildClickEvent: function () {
            if (this._childElement) {
                var nextChildDOM = this.getDOMNode();
                if (this._childElement === nextChildDOM) {
                    return;
                }
            }

            this._childElement = this.getDOMNode();
            this._childElement.addEventListener("mousedown", this._handleMouseDown);
        },
        
        /**
         * Handle the "start-drag" event of draganddrop store.
         * 
         * @private
         */
        _handleDNDStoreDrag: function () {
            var flux = this.getFlux(),
                dragTargets = flux.store("draganddrop").getState().dragTargets,
                // Only dragged targets should listen to the "change" event. This will
                // improve the overall performance.
                isDragTarget = dragTargets.includes(this.props.target);
                
            if (isDragTarget) {
                this._isDragging = true;
                flux.store("draganddrop").on("change", this._handleDNDStoreChange);
                
                if (this.props.onDragStart) {
                    this.props.onDragStart();
                }
            }
        },
        
        /**
         * Handle the "change" event of draganddrop store.
         * 
         * @private
         */
        _handleDNDStoreChange: function () {
            var flux = this.getFlux(),
                dndState = flux.store("draganddrop").getState(),
                dragPosition = dndState.dragPosition,
                dragTargets = dndState.dragTargets,
                isDragging = !dragTargets.isEmpty();
            
            if (isDragging) {
                if (this.props.onDrag && dragPosition) {
                    if (!this._initialBounds) {
                        var bounds = this._childElement.getBoundingClientRect();
                        
                        this._initialBounds = {
                            top: bounds.top,
                            left: bounds.left
                        };
                    }
                    
                    var initialDragPosition = dndState.initialDragPosition,
                        dragOffset = {
                            x: dragPosition.x - initialDragPosition.x,
                            y: dragPosition.y - initialDragPosition.y
                        };

                    this.props.onDrag(dragPosition, dragOffset, initialDragPosition, this._initialBounds);
                }
            } else {
                // Remove the listenner when it is dropped.
                flux.store("draganddrop").removeListener("change", this._handleDNDStoreChange);

                if (this._isDragging) {
                    this._isDragging = false;
                    this._initialBounds = null;

                    if (this.props.onDragStop) {
                        this.props.onDragStop();
                    }
                }
            }
        },

        /**
         * Suppress the single click event that follows the mouseup event at
         * the end of the drag.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleDragClick: function (event) {
            event.stopPropagation();
            window.removeEventListener("click", this._handleDragClick, true);
        },

        /**
         * Handles the start of a dragging operation by setting up initial position
         * and adding event listeners to the window
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseDown: function (event) {
            this._mousedownPosition = {
                x: event.clientX,
                y: event.clientY
            };
            
            window.addEventListener("mousemove", this._handleMouseMove, true);
            window.addEventListener("mouseup", this._handleMouserUp, true);
        },

        /**
         * Handles move for a dragging object
         * Registers dragging objects with store
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseMove: function (event) {
            var dndStore = this.getFlux().store("draganddrop"),
                dragTargets = dndStore.getState().dragTargets,
                position = { x: event.clientX, y: event.clientY },
                element = event.target;

            if (dragTargets.isEmpty()) {
                var distance = math.distance(position.x, position.y,
                    this._mousedownPosition.x, this._mousedownPosition.y);
                    
                if (distance < MIN_DRAG_DISTANCE) {
                    // Do not start the drag until the distance reaches a
                    // threshold to prevent false drags on Windows.
                    return;
                }
                
                var draggedTargets = Immutable.List([this.props.target]);
                
                if (this.props.beforeDragStart) {
                    var options = this.props.beforeDragStart();
                    
                    if (options.continue === false) {
                        window.removeEventListener("mousemove", this._handleMouseMove, true);
                        window.removeEventListener("mouseup", this._handleMouserUp, true);
                        return;
                    }
                    
                    if (options.draggedTargets) {
                        draggedTargets = options.draggedTargets;
                    }
                }
                
                if (draggedTargets.isEmpty()) {
                    return;
                }

                // Suppress the following click event
                window.addEventListener("click", this._handleDragClick, true);

                dndStore.startDrag(this.props.type, draggedTargets, position);
            } else {
                dndStore.updateDrag(position, element);
            }
        },

        /**
         * Handles finish of drag operation
         * Removes drag event listeners from window
         * Resets state
         *
         * @private
         * @param {SyntheticEvent=} event
         */
        _handleMouserUp: function (event) {
            window.removeEventListener("mousemove", this._handleMouseMove, true);
            window.removeEventListener("mouseup", this._handleMouserUp, true);

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
            
            this.getFlux().store("draganddrop").stopDrag();
        },

        render: function () {
            return this.props.children;
        }
    });

    module.exports = Draggable;
});
