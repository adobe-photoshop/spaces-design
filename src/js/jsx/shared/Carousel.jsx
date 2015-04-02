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
        ReactCSSTransitionGroup = React.addons.CSSTransitionGroup,
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React);

    var os = require("adapter/os"),
        synchronization = require("js/util/synchronization");
        
    var Carousel = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            items: React.PropTypes.arrayOf(React.PropTypes.node)
        },

        /**
         * A debounced versions of prev/next item navigation
         *
         * @type {?function}
         */
        _prevItemDebounced: null,
        _nextItemDebounced: null,

        componentWillMount: function() {
            this._prevItemDebounced = synchronization.debounce(this._prevItem, this, 700);
            this._nextItemDebounced = synchronization.debounce(this._nextItem, this, 700);
        },

        getInitialState: function () {
            return {
                index: 0,
                direction: "forward"
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
                index: index,
                direction: (this.state.index > index ? "backward" : "forward")
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
                var current = (idx === this.state.index) ? "current" : "";
                return (
                    <a key={"link" + idx} className={current} onClick={this._gotoItem.bind(this, idx)}>
                        <span />
                    </a>
                );
            }, this);
        },

        render: function () {

            if (this.props.items.length === 0) {
                return null;
            }

            var item = this.props.items[this.state.index],
                itemComponent = React.addons.cloneWithProps(item,
                    {
                        key: this.state.index,
                        ref: item.ref
                    }
                ),
                classSet = React.addons.classSet(this.props.className, this.state.direction);

            return (
                <div className={classSet}>
                    <ReactCSSTransitionGroup transitionName="carousel" component="div">
                        {itemComponent}
                    </ReactCSSTransitionGroup>
                    <div className="carousel__nav">
                        {this._buildNav()}
                    </div>
                </div>
            );
        },

        componentDidMount: function () {
            var flux = this.getFlux();
            flux.actions.shortcuts.addShortcut(os.eventKeyCode.ARROW_LEFT,
                {}, this._prevItemDebounced, "L" + this.props.id, true);
            flux.actions.shortcuts.addShortcut(os.eventKeyCode.ARROW_RIGHT,
                {}, this._nextItemDebounced, "R" + this.props.id, true);
        },

        componentWillUnmount: function () {
            var flux = this.getFlux();
            flux.actions.shortcuts.removeShortcut("L" + this.props.id);
            flux.actions.shortcuts.removeShortcut("R" + this.props.id);
        }

    });

    module.exports = Carousel;
});
