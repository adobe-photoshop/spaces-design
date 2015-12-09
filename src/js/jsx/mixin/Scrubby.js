/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

    var React = require("react"),
        ReactDOM = require("react-dom"),
        _ = require("lodash");

    /**
     * This mixin provides the component with scrubby functionality, where the user can
     * start dragging on the component in either direction, and continuous updates
     * about the relative position of the drag is passed to the component
     *
     * For minimal use, clients need to provide the `onScrub` function which
     * is passed the distance mouse traveled since scrub started
     *
     * Optionally, clients can also provide onScrubStart and onScrubEnd for initialize/cleanup
     * onScrubStart is passed the initial mouse coordinates (x,y)
     * onScrubEnd is passed the distance of the scrub from when onScrubStart is called (dx, dy)
     */
    module.exports = {
        /**
         * X position of mouse/touch event when scrubbing starts
         *
         * @type {number}
         */
        _initialScrubX: null,

        /**
         * Y position of mouse/touch event when scrubbing starts
         *
         * @type {number}
         */
        _initialScrubY: null,

        propTypes: {
            onScrub: React.PropTypes.func,
            onScrubStart: React.PropTypes.func,
            onScrubEnd: React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                onScrub: _.identity,
                onScrubStart: _.identity,
                onScrubEnd: _.identity
            };
        },

        getInitialState: function () {
            return {
                scrubbing: false
            };
        },

        componentDidMount: function () {
            ReactDOM.findDOMNode(this).addEventListener("mousedown", this._installListeners);
        },

        componentWillUnmount: function () {
            ReactDOM.findDOMNode(this).removeEventListener("mousedown", this._installListeners);
            this._uninstallListeners();
        },

        /**
         * On mouse down, starts listening for related mouse/touch events, and starts scrubbing
         * @param {SyntheticEvent} event
         * @private
         */
        _installListeners: function (event) {
            this._startScrubUpdates(event);
            window.document.addEventListener("mousemove", this._handleScrubMove);
            window.document.addEventListener("touchmove", this._handleScrubMove);
            window.document.addEventListener("mouseup", this._stopScrubUpdates);
            window.document.addEventListener("touchend", this._stopScrubUpdates);
        },

        /**
         * On mouse up, _stopScrubUpdates gets called, which calls this to uninstall listeners
         * It's also called on component unmount to not leave zombie listeners behind
         * @private
         */
        _uninstallListeners: function () {
            window.document.removeEventListener("mousemove", this._handleScrubMove);
            window.document.removeEventListener("touchmove", this._handleScrubMove);
            window.document.removeEventListener("mouseup", this._stopScrubUpdates);
            window.document.removeEventListener("touchend", this._stopScrubUpdates);
        },

        /**
         * After dragging has started on the component, it eventually ends with
         * a mouseup and click event. The click event occurs on whatever element
         * the mouse is over at the time of the mouseup event. Often, this is
         * outside the component, which can be incorrectly intepreted as an event
         * that could, e.g., cause the component to be unmounted too early. Hence,
         * once dragging has started, a capture-phase click handler is installed
         * on the window to stop its propagation. The handler is executed exactly
         * once, so it doesn't interfere with window clicks after the drag has
         * ended.
         * 
         * @private
         * @param {MouseEvent} event
         */
        _suppressScrubbyClick: function (event) {
            event.stopPropagation();

            window.removeEventListener("click", this._suppressScrubbyClick, true);
        },

        /**
         * Handler for the start of scrubby behavior, logs the start location,
         * calls the start handler, if provided, and handles the inevitable click event
         * we'll receive on window
         * 
         * @private
         * @param {SyntheticEvent} e
         */
        _startScrubUpdates: function (e) {
            e.stopPropagation();
            
            var coords = this._getScrubPosition(e);
            
            this.setState({
                scrubbing: true
            });
            
            if (this.props.onScrubStart) {
                this.props.onScrubStart(coords.x, coords.y);
            }

            this._initialScrubX = coords.x;
            this._initialScrubY = coords.y;
            
            // @see _suppressScrubbyClick
            window.addEventListener("click", this._suppressScrubbyClick, true);
        },

        /**
         * Handler for the input move during scrubby behavior, 
         * calls the provided onScrub handler with the delta from the last call
         * 
         * @private
         * @param {SyntheticEvent} e
         */
        _handleScrubMove: function (e) {
            if (this.state.scrubbing) {
                e.stopPropagation();

                var coords = this._getScrubPosition(e),
                    deltaX = coords.x - this._initialScrubX,
                    deltaY = coords.y - this._initialScrubY;

                if (this.props.onScrub) {
                    this.props.onScrub(deltaX, deltaY);
                }
            }
        },

        /**
         * Handler for when scrubby behavior is finished by user letting go of the mouse
         * or the touch event. If provided, calls the onScrubEnd handler with the total mouse delta
         * between scrub finish and start position, allowing non-live scrubby clients a chance
         * 
         * @private
         * @param {SyntheticEvent} e
         */
        _stopScrubUpdates: function (e) {
            this._uninstallListeners();

            this.setState({
                scrubbing: false
            });

            var coords = this._getScrubPosition(e),
                deltaX = coords.x - this._initialScrubX,
                deltaY = coords.y - this._initialScrubY;

            this._initialScrubX = null;
            this._initialScrubY = null;
            
            if (this.props.onScrubEnd) {
                this.props.onScrubEnd(deltaX, deltaY);
            }
        },

        /**
         * Helper function to extract the position a move or touch event.
         * 
         * @param {SyntheticEvent} e
         * @return {{x: number, y: number}}
         */
        _getScrubPosition: function (e) {
            if (e.touches) {
                e = e.touches[0];
            }

            return {
                x: e.clientX,
                y: e.clientY
            };
        }
    };
});
