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

    var math = require("js/util/math"),
        log = require("js/util/log");

    var Draggable = React.createClass({
        mixins: [FluxMixin],
        
        _isDragging: false,
        _childDOM: null,
        _initialBounds: null,

        propTypes: {
            // The type of the draggable item.
            type: React.PropTypes.string,

            /**
             * Optional callback to return a Immutable.List of draged items. It is useful when you want to support 
             * dragging on multiple items.
             */
            getDragItems: React.PropTypes.func
        },
        
        componentDidMount: function () {
            this.getFlux().store("draganddrop").on("start-drag", this._handleDNDStoreDrag);
            this._listenToChildClickEvent();
        },
        
        componentDidUpdate: function () {
            this._listenToChildClickEvent();
        },
        
        _listenToChildClickEvent: function () {
            if (this._childDOM) {
                var nextChildDOM = this.getDOMNode();
                if (this._childDOM === nextChildDOM) {
                    return;
                }
            }

            this._childDOM = this.getDOMNode();
            this._childDOM.addEventListener("mousedown", this._handleMouseDown);
        },

        componentWillUnmount: function () {
            // Remove any leftover event handlers
            window.removeEventListener("mousemove", this._handleMouseMove, true);
            window.removeEventListener("mouseup", this._handleMouserUp, true);
            
            this.getFlux().store("draganddrop").removeListener("start-drag", this._handleDNDStoreDrag);
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
                isDragTarget = dragTargets.includes(this.props.keyObject);
                
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
                    if (!this._initialPosition) {
                        var bounds = this._childDOM.getBoundingClientRect();
                        
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
         */
        _handleMouseDown: function () {
            window.addEventListener("mousemove", this._handleMouseMove, true);
            window.addEventListener("mouseup", this._handleMouserUp, true);
        },

        /**
         * Handles move for a dragging object
         * Registers dragging objects with store
         *
         * @param {Event} event
         */
        _handleMouseMove: function (event) {
            var dndStore = this.getFlux().store("draganddrop"),
                dragTargets = dndStore.getState().dragTargets;

            if (dragTargets.isEmpty()) {
                var draggedTargets = Immutable.List([this.props.keyObject]);
                
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

                dndStore.startDrag(this.props.type, draggedTargets);
            }
        },

        /**
         * Handles finish of drag operation
         * Removes drag event listeners from window
         * Resets state
         *
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
            return ( this.props.children );
        }
    });

    module.exports = Draggable;
});
