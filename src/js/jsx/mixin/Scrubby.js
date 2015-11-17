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
        _ = require("lodash"),
        log = require("js/util/log");

    /**
     * Mixin for drag-and-drop functionality. Clients should call _startUpdates
     * on mousedown/touchstart and implement the abstract method _updatePosition.
     * CLinets can optinally implement _updatePositionBegin and _updatePositionEnd
     */
    module.exports = {

        propTypes: {
            onChange: React.PropTypes.func,
            max: React.PropTypes.number
        },

        getDefaultProps: function () {
            return {
                onChange: _.identity,
                max: 1
            };
        },

        getInitialState: function () {
            return {
                active: false
            };
        },

        componentDidMount: function () {
            window.document.addEventListener("mousemove", this._handleUpdate);
            window.document.addEventListener("touchmove", this._handleUpdate);
            window.document.addEventListener("mouseup", this._stopUpdates);
            window.document.addEventListener("touchend", this._stopUpdates);
            if (!this._updatePosition) {
                log.debug("update Position was not declared in a class that uses the Scrubby Mixin");
            }
        },

        componentWillUnmount: function () {
            window.document.removeEventListener("mousemove", this._handleUpdate);
            window.document.removeEventListener("touchmove", this._handleUpdate);
            window.document.removeEventListener("mouseup", this._stopUpdates);
            window.document.removeEventListener("touchend", this._stopUpdates);
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
        _suppressClick: function (event) {
            event.stopPropagation();

            window.removeEventListener("click", this._suppressClick, true);
        },

        /**
         * Handler for the start-drag operation.
         * 
         * @private
         * @param {SyntheticEvent} e
         */
        _startUpdates: function (e) {
            e.stopPropagation();
            var coords = this._getPosition(e);
            this.setState({ active: true });
            if (this._updatePositionBegin) {
                this._updatePositionBegin();
            }
            if (this._updatePosition) {
                this._updatePosition(coords.x, coords.y);
            }
            window.addEventListener("click", this._suppressClick, true);
        },

        /**
         * Handler for the update-drag operation.
         * 
         * @private
         * @param {SyntheticEvent} e
         */
        _handleUpdate: function (e) {
            if (this.state.active) {
                e.stopPropagation();
                var coords = this._getPosition(e);
                if (this._updatePosition) {
                    this._updatePosition(coords.x, coords.y);
                }
            }
        },

        /**
         * Handler for the stop-drag operation.
         * 
         * @private
         */
        _stopUpdates: function () {
            if (this._updatePositionEnd) {
                this._updatePositionEnd();
            }
            if (this.state.active) {
                this.setState({ active: false });
            }
        },

        /**
         * Helper function to extract the position a move or touch event.
         * 
         * @param {SyntheticEvent} e
         * @return {{x: number, y: num}}
         */
        _getPosition: function (e) {
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
