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
        ReactDOM = require("react-dom"),
        classnames = require("classnames"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        ScrubbyMixin = require("js/jsx/mixin/Scrubby");
    
    var Label = React.createClass({
        mixins: [FluxMixin, ScrubbyMixin],
        
        propTypes: {
            size: React.PropTypes.string,
            onScrub: React.PropTypes.func,
            onScrubStart: React.PropTypes.func,
            onScrubEnd: React.PropTypes.func
        },

        /**
         * inform the parent that scrubbing has started
         *
         * @private
         */
        _updatePositionBegin: function () {
            if (this.props.onScrubStart) {
                this.props.onScrubStart();
            }
        },
        
        /**
         * inform the parent that scrubbing has ended
         *
         * @private
         */
        _updatePositionEnd: function () {
            if (this.props.onScrubEnd) {
                this.props.onScrubEnd();
            }
        },

        /**
         * Update the parents scrubby information
         *
         * @private
         */
        _updatePosition: function (clientX, clientY) {
            if (this.props.onScrub) {
                var rect = ReactDOM.findDOMNode(this).getBoundingClientRect();

                var value;
                if (this.props.vertical) {
                    value = (rect.bottom - clientY);
                } else {
                    value = (clientX - rect.left);
                }

                this.props.onScrub(value);
            }
        },

        render: function () {
            var className = classnames(
                "label__medium",
                this.props.size || "column-6",
                this.props.className,
                { "label__disabled": this.props.disabled });

            return (
                <label
                    {...this.props}
                    ref="label"
                    onMouseDown={!this.props.disabled && this.props.onScrub && this._startUpdates}
                    onTouchStart={!this.props.disabled && this.props.onScrub && this._startUpdates}
                    className={className}>
                    {this.props.children}
                </label>
            );
        }
    });
    module.exports = Label;
});
