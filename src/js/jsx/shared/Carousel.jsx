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
        FluxMixin = Fluxxor.FluxMixin(React),
        classnames = require("classnames");

    var os = require("adapter/os");

    var synchronization = require("js/util/synchronization"),
        headlights = require("js/util/headlights"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        strings = require("i18n!nls/strings");
        
    var Carousel = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            items: React.PropTypes.arrayOf(React.PropTypes.node),
            wrapNavigation: React.PropTypes.bool,
            useContinueOnFirstSlide: React.PropTypes.bool,
            useDismissOnLastSlide: React.PropTypes.bool
        },

        /**
         * A throttled versions of prev/next item navigation
         *
         * @type {?function}
         */
        _prevItemThrottled: null,
        _nextItemThrottled: null,

        componentWillMount: function () {
            this._prevItemThrottled = synchronization.throttle(this._prevItem, this, 700);
            this._nextItemThrottled = synchronization.throttle(this._nextItem, this, 700);
        },

        getInitialState: function () {
            return {
                index: 0,
                oldItem: 1,
                direction: "forward"
            };
        },

        /**
         * Navigate to a given carousel item (by index) by setting state
         *
         * @param {number} index within the index range of this.props.items
         * @param {number} curindex within the index range of this.props.items
         * @param {event} event
         */
        _gotoItem: function (index, curindex, event) {
            this.setState({ index: index, oldItem: curindex });
            
            event.stopPropagation();
        },

        /**
         * Navigate to the next Carousel item.  
         * If current item is the last item, this will wrap to the beginning
         *
         * @param {event} event
         */
        _nextItem: function (event) {
            var nextIndex = this.props.wrapNavigation ?
                    (this.state.index + 1) % this.props.items.length :
                    Math.min(this.state.index + 1, this.props.items.length - 1);

            this._gotoItem(nextIndex, this.state.index, event);
        },

        /**
         * Navigate to the previous Carousel item.  
         * If current item is the first item, this will wrap to the end
         *
         * @param {event} event
         */
        _prevItem: function (event) {
            var prevIndex = this.state.index - 1;

            prevIndex = (this.props.wrapNavigation && prevIndex < 0) ?
                this.props.items.length + prevIndex :
                Math.max(prevIndex, 0);

            this._gotoItem(prevIndex, this.state.index, event);
        },

        /**
         * Handle clicks, navigates forward or backward
         * @private
         * @param {SyntheticEvent} event
         */
        _handleClick: function (event) {
            var elt = React.findDOMNode(this);
            if (!elt) {
                return;
            }

            var bounds = elt.getBoundingClientRect();
            if (bounds.top <= event.clientY &&
                event.clientY <= bounds.bottom &&
                bounds.left <= event.clientX) {
                var midpointX = bounds.left + Math.floor(bounds.width / 2);

                if (event.clientX <= midpointX) {
                    return this._prevItem(event);
                } else if (event.clientX <= bounds.right) {
                    return this._nextItem(event);
                }
            }
        },

        /**
         * Build a set of <a> components that act as a navigation for the Carousel
         *
         * @return {Array.<ReactComponent>}
         */
        _buildNav: function () {
            if (!(this.props.useContinueOnFirstSlide && this.state.index === 0)) {
                return this.props.items.map(function (item, idx) {
                    var classSet = classnames({
                        "current": idx === this.state.index,
                        "dot": true
                    });
                
                    return (
                        <a
                            key={"link" + idx}
                            className={classSet}
                            onClick={this._gotoItem.bind(this, idx, this.state.index)}>
                            <span />
                        </a>
                    );
                }, this);
            }
        },
        
        /**
         * Build the next slide button
         *
         * @return {ReactComponent}
         */
        _buildNextButton: function () {
            if (this.props.useContinueOnFirstSlide && this.state.index === 0) {
                return (
                    <a
                        className="carousel__slide-button__continue"
                        onClick={this._gotoItem.bind(this, 1, 0)}>
                        {strings.FIRST_LAUNCH.CONTINUE}
                    </a>
                );
            } else if (this.state.index < this.props.items.length - 1) {
                return (
                    <a
                        className="carousel__slide-button__next"
                        onClick={this._gotoItem.bind(this, this.state.index + 1, this.state.index)}>
                        <SVGIcon
                            viewBox="0 0 6 10"
                            CSSID="carousel-right"/>
                    </a>
                );
            } else if (this.props.useDismissOnLastSlide) {
                return (
                    <a
                        className="carousel__slide-button__started"
                        onClick={this.props.dismissDialog}>
                        {strings.FIRST_LAUNCH.GET_STARTED}
                    </a>
                );
            }
        },
        
        /**
         * Build the previous slide button
         *
         * @return {<ReactComponent>}
         */
        _buildPreviousButton: function () {
            if (this.state.index > 0) {
                return (
                    <a
                        className="carousel__slide-button__prev"
                        onClick={this._gotoItem.bind(this, this.state.index - 1, this.state.index)}>
                        <SVGIcon
                            viewBox="0 0 6 10"
                            CSSID="carousel-left"/>
                    </a>
                );
            }
        },

        render: function () {
            if (this.props.items.length === 0) {
                return null;
            }

            var item = this.props.items[this.state.index],
                oldItem = this.props.items[this.state.oldItem],
                itemComponent = React.cloneElement(item,
                    {
                        key: this.state.index,
                        ref: "item",
                        className: classnames(item.props.className, "carousel__slide__shown"),
                        style: { opacity: 1 }
                    }
                ),
                oldItemComponent = React.cloneElement(oldItem,
                    {
                        key: "old" + this.state.oldItem,
                        ref: "pastItem",
                        className: classnames(item.props.className),
                        style: { opacity: 0, display: "none" }
                    }
                ),
                classSet = classnames(this.props.className, this.state.direction);

            return (
                <div className={classSet} onClick={this._handleClick}>
                    {itemComponent}
                    {oldItemComponent}
                    <div className="carousel__nav">
                        {this._buildPreviousButton()}
                        {this._buildNav()}
                        {this._buildNextButton()}
                    </div>
                </div>
            );
        },

        componentDidMount: function () {
            var flux = this.getFlux();
            flux.actions.shortcuts.addShortcut(os.eventKeyCode.ARROW_LEFT,
                {}, this._prevItemThrottled, "L" + this.props.id, true);
            flux.actions.shortcuts.addShortcut(os.eventKeyCode.ARROW_RIGHT,
                {}, this._nextItemThrottled, "R" + this.props.id, true);
        },

        componentWillUnmount: function () {
            var flux = this.getFlux();
            flux.actions.shortcuts.removeShortcut("L" + this.props.id);
            flux.actions.shortcuts.removeShortcut("R" + this.props.id);

            // Log whether the user has read the introduction until last slide
            if (this.state.index < this.props.items.length - 1) {
                headlights.logEvent("UserInterface", "introduction", "earlyDismiss");
            } else {
                headlights.logEvent("UserInterface", "introduction", "dismissOnEnd");
            }
        }
    });

    module.exports = Carousel;
});
