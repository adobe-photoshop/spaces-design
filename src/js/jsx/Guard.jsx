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
        classnames = require("classnames");

    /**
     * @const
     * @type {Array.<string>} Input events to block when the component becomes inactive.
     */
    var INPUT_EVENTS = [
        "input",
        "change",
        "click",
        "dblclick",
        "mousedown",
        "mousemove",
        "mouseup",
        "touchstart",
        "touchmove",
        "touchend",
        "keydown",
        "keypress",
        "keyup",
        "focus",
        "blur",
        "paste",
        "selectionchange"
    ];

    var Guard = React.createClass({

        shouldComponentUpdate: function (nextProps) {
            return this.props.disabled !== nextProps.disabled;
        },

        getDefaultProps: function () {
            return {
                disabled: false
            };
        },

        /**
         * Handler which stops propagation of the given event
         *
         * @private
         * @param {Event} event
         */
        _blockInput: function (event) {
            event.stopPropagation();
        },

        /**
         * Remove event handlers that block input
         *
         * @private
         */
        _enableInput: function () {
            INPUT_EVENTS.forEach(function (event) {
                window.removeEventListener(event, this._blockInput, true);
            }, this);
        },

        /**
         * Add event handlers that block input
         *
         * @private
         */
        _disableInput: function () {
            INPUT_EVENTS.forEach(function (event) {
                window.addEventListener(event, this._blockInput, true);
            }, this);
        },
        
        componentWillMount: function () {
            // Mount with input disabled
            this._disableInput();
        },

        componentWillUnmount: function () {
            this._enableInput();
        },

        componentWillReceiveProps: function (nextProps) {
            if (!this.props.disabled && nextProps.disabled) {
                this._enableInput();
            } else if (this.props.disabled && !nextProps.disabled) {
                this._disableInput();
            }
        },

        render: function () {
            var className = classnames({
                "guard": true,
                "guard__enabled": !this.props.disabled
            });

            return (
                <div className={className} />
            );
        }
    });

    module.exports = Guard;
});
