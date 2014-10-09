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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxChildMixin = Fluxxor.FluxChildMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var OS = require("adapter/os"),
        UI = require("adapter/ps/ui"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy;

    var ToolCanvas = React.createClass({
        mixins: [FluxChildMixin, StoreWatchMixin("tool")],

        /**
         * Dispatches (synthetic) click events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleClick: function (event) {
            var tool = this.state.current;

            if (tool && tool.onClick) {
                tool.onClick.call(this, event);
            }
        },

        /**
         * Dispatches (synthetic) mousedown events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleMouseDown: function (event) {
            var tool = this.state.current;

            if (tool && tool.onMouseDown) {
                tool.onMouseDown.call(this, event);
            }
        },

        /**
         * Dispatches (native) keypress events from the window to the currently
         * active tool.
         * 
         * @private
         * @param {KeyboardEvent} event
         */
        _handleKeyPress: function (event) {
            var tool = this.state.current;

            if (tool && tool.onKeyPress) {
                tool.onKeyPress.call(this, event);
            }
        },

        /**
         * Dispatches (native) keydown events from the window to the currently
         * active tool.
         * 
         * @private
         * @param {KeyboardEvent} event
         */
        _handleKeyDown: function (event) {
            var tool = this.state.current;

            if (tool && tool.onKeyDown) {
                tool.onKeyDown.call(this, event);
            }
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                toolStore = flux.store("tool");

            return toolStore.getState();
        },

        /**
         * Builds the tool activation key map and sets up window-level event listeners.
         */
        componentWillMount: function () {
            // Key handlers are attached to the window instead of the scrim
            window.addEventListener("keypress", this._handleKeyPress);
            window.addEventListener("keydown", this._handleKeyDown);
        },

        /**
         * Removes window-level event listeners.
         */
        componentWillUnmount: function() {
            window.removeEventListener("keypress", this._handleKeyPress);
            window.removeEventListener("keydown", this._handleKeyDown);
        },

        render: function () {
            var tool = this.state.current;

            if (!tool) {
                return null;
            }

            // Only the mouse event handlers are attached to the scrim
            return (
                <div className="scrim"
                    onClick={this._handleClick}
                    onMouseDown={this._handleMouseDown}>
                </div>
            );
        }
    });

    module.exports = ToolCanvas;
});
