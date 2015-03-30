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

    var React = require("react");
        
    var Carousel = React.createClass({
        propTypes: {
            items: React.PropTypes.arrayOf(React.PropTypes.node)
        },

        getInitialState: function () {
            return {
                index: 0,
            };
        },

        /**
         * Navigate to a given carousel item (by index) by setting state
         *
         * @param {number} index within the index range of this.props.items
         * @param {event} event
         */
        _gotoItem: function (index, event) {
            this.setState({
                index: index
            });
            event.stopPropagation();
        },

        /**
         * Navigate to the next Carousel item.  
         * If current item is the last item, this will wrap to the beginning
         *
         * @param {event} event
         */
        _nextItem: function (event) {
            this._gotoItem((this.state.index + 1) % this.props.items.length, event);
        },

        /**
         * Navigate to the previous Carousel item.  
         * If current item is the first item, this will wrap to the end
         *
         * @param {event} event
         */
         _prevItem: function (event) {
            var prevItem = this.state.index - 1;
            this._gotoItem((prevItem < 0) ? this.props.items.length + prevItem : prevItem, event);
        },

        /**
         * Build a set of <a> components that act as a navigation for the Carousel
         *
         * @return {Array.<ReactComponent>}
         */
        _buildNav: function () {
            return this.props.items.map(function (item, idx) {
                var linkText = (idx === this.state.index) ? " X " : " O ";
                return (
                    <a key={"link" + idx} onClick={this._gotoItem.bind(this, idx)}>{linkText}</a>
                );
            }, this);
        },

        render: function () {

            if (this.props.items.length === 0) {
                return null;
            }

            return (
                <div className={this.props.className}>

                    {this.props.items[this.state.index]}

                    <div className="carousel__nav">
                        <span onClick={this._prevItem}>PREV</span> |
                        &nbsp;<span onClick={this._nextItem}>NEXT</span>
                    </div>
                    
                    <div className="carousel__nav">
                        {this._buildNav()}
                    </div>
                </div>
            );
        }

    });

    module.exports = Carousel;
});
