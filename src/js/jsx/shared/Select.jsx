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
        Immutable = require("immutable"),
        classnames = require("classnames");
    
    var SVGIcon = require("jsx!js/jsx/shared/SVGIcon");

    /**
     * Maximum number of options the select box loads initially.
     * @const
     * @param {number}
     */
    var INIT_OPTION_COUNT = 20;

    /**
     * A component that represents a single option from a select component.
     * 
     * @constructor
     */
    var Option = React.createClass({
        propTypes: {
            value: React.PropTypes.shape({
                id: React.PropTypes.string.isRequired,
                title: React.PropTypes.string.isRequired,
                info: React.PropTypes.string,
                style: React.PropTypes.object,
                svgType: React.PropTypes.string
            }).isRequired,
            selected: React.PropTypes.bool,
            next: React.PropTypes.string,
            prev: React.PropTypes.string
        },

        shouldComponentUpdate: function (nextProps) {
            // Note that we ONLY re-render if the selection status changes
            return this.props.selected !== nextProps.selected;
        },

        render: function () {
            var rec = this.props.value,
                id = rec.id,
                style = rec.style,
                className = classnames({
                    "select__option": true,
                    "select__option__selected": this.props.selected
                });

            var svgBlock,
                infoBlock;

            if (rec.svgType) {
                svgBlock = (
                    <SVGIcon
                        CSSID={rec.svgType}
                        viewbox="0 0 24 24"/>
                );
            }

            if (rec.displayInfo) {
                infoBlock = (
                    <span
                        className="select__option__info" >
                        {rec.displayInfo}
                    </span>
                );
            }

            // Only render the two extra span tags if we have either info or an svg
            // Otherwise just make a li
            if (rec.displayInfo || rec.svgType) {
                return (
                    <li
                        data-id={id}
                        className={className}
                        style={style}>
                        {svgBlock}
                        {rec.title}
                        {infoBlock}
                    </li>
                );
            }

            return (
                <li
                    data-id={id}
                    className={className}
                    style={style}>
                    {rec.title}
                </li>
            );
        }
    });

    /**
     * A component that represents the header of selectable options.
     * 
     * @constructor
     */
    var Header = React.createClass({
        propTypes: {
            title: React.PropTypes.string.isRequired
        },

        render: function () {
            return (
                <li
                    className="select__header">
                    {this.props.title}
                </li>
            );
        }
    });
    
    /**
     * Approximates an HTML <select> element. (CEF does not support select in
     * off-screen rendering mode.)
     */
    var Select = React.createClass({

        propTypes: {
            options: React.PropTypes.instanceOf(Immutable.Iterable).isRequired,
            defaultSelected: React.PropTypes.string,
            sorted: React.PropTypes.bool
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return this.state.mounted !== nextState.mounted ||
                this.state.selected !== nextState.selected ||
                !Immutable.is(this.props.options, nextProps.options);
        },

        /**
         * Find the index of the given key among the list of options. If the
         * options are sorted by key, use a binary search. Returns -1 if the
         * key isn't found among the options.
         *
         * @private
         * @param {Immutable.Iterable.<{id: string}>} options
         * @param {string} key
         * @return {number}
         */
        _findIndex: function (options, key) {
            if (!this.props.sorted) {
                return options.findIndex(function (obj) {
                    return obj.id === key;
                });
            }

            if (options.isEmpty()) {
                return -1;
            }

            // binary search for the position
            var size = options.size,
                low = 0,
                high = size,
                middle = Math.floor(high / 2),
                value;

            while (low < middle && middle < high) {
                value = options.get(middle).id;
                if (value < key) {
                    low = middle;
                    middle += Math.floor((high - middle) / 2);
                } else if (value > key) {
                    high = middle;
                    middle = low + Math.floor((middle - low) / 2);
                } else {
                    return middle;
                }
            }

            return -1;
        },

        componentWillReceiveProps: function (nextProps) {
            var selected = this.state.selected,
                index = this._findIndex(nextProps.options, selected);

            if (index === -1 && !nextProps.options.isEmpty()) {
                this._selectExtreme(nextProps.options, "next", 0);
            }
        },

        getDefaultProps: function () {
            return {
                defaultSelected: null,
                onChange: function () {}
            };
        },

        getInitialState: function () {
            return {
                mounted: false,
                selected: this.props.defaultSelected
            };
        },

        /**
         * Set the ID of the selected option
         *
         * @private
         * @param {string} id
         */
        _setSelected: function (id) {
            if (id !== this.state.selected) {
                this.setState({
                    selected: id
                });

                this.props.onChange(id);
            }
        },

        /**
         * Set the ID of the selected option from the target of the given
         * mouse event.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _setSelectedFromMouseEvent: function (event) {
            var target = event.target,
                dataID = target.attributes["data-id"];

            if (dataID && dataID.value) {
                this._setSelected(dataID.value);
            }
        },

        /**
         * Change the selected option to be the next or previous option.
         *
         * @private
         * @param {string} property Either "next" or "prev"
         * @param {number} extreme The index of the option to use if there is no
         *  next/previous option.
         */
        _selectNextPrev: function (property, extreme) {
            var selectedKey = this.state.selected;
            if (!selectedKey) {
                this._selectExtreme(this.props.options, property, extreme);
                return;
            }

            var selectedComponent = this.refs[selectedKey];
            if (!selectedComponent) {
                this._selectExtreme(this.props.options, property, extreme);
                return;
            }

            var nextSelectedKey = selectedComponent.props[property];
            if (!nextSelectedKey) {
                return;
            }

            this._setSelected(nextSelectedKey);
        },

        /**
         * Change the selected option to be the first or last non-header option.
         *
         * @private
         * @param {Array.<Option>} options List of options to look through
         * @param {string} property Either "next" or "prev"
         * @param {number} extreme The first index to check
         *
         */
        _selectExtreme: function (options, property, extreme) {
            var selectedKey = options.get(extreme).id;
            
            while (extreme < options.size - 1 && selectedKey.indexOf("header") > -1) {
                extreme++;
                selectedKey = options.get(extreme).id;
            }
            
            if (selectedKey && selectedKey.indexOf("header") === -1) {
                this._setSelected(selectedKey);
                this._scrollTo(selectedKey);
                return;
            }

            if (!this.props.live) {
                this._setSelected(null);
            }
        },

        /**
         * Select the next option.
         */
        selectNext: function () {
            return this._selectNextPrev("next", 0);
        },

        /**
         * Select the previous option.
         */
        selectPrev: function () {
            return this._selectNextPrev("prev", this.props.options.size - 1);
        },

        /**
         * Close the select menu
         * 
         * @param {SyntheticEvent} event
         * @param {string} action ("apply" or "cancel")
         */
        close: function (event, action) {
            this.props.onClose(event, action);
        },

        /**
         * Update the selection and close the dialog on click.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleClick: function (event) {
            this._setSelectedFromMouseEvent(event);

            if (this.props.onClick) {
                this.props.onClick(event, "apply");
            }
        },

        /** @type {number} Track state of the last known mouse position */
        _currentClientX: null,
        _currentClientY: null,

        /**
         * Update the selection when hovering over an option
         * Avoids unnecessary selections when scrolling or selection change causes
         * spurious mouse move events to be registered without actual mouse position changes
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseMove: function (event) {
            if (event.clientX !== this._currentClientX || event.clientY !== this._currentClientY) {
                this._currentClientX = event.clientX;
                this._currentClientY = event.clientY;

                this._setSelectedFromMouseEvent(event);
            }

            if (this.props.onMouseMove) {
                this.props.onMouseMove(event);
            }
        },

        /**
         * Get an appropriate subset of options to render. Currently, this either
         * returns 100 options around the selected item at mount time, and otherwise
         * returns all the options. This is a performance hack/optimization to
         * improve mount-time when there are thousands of options. This is typical
         * when representing, e.g., the list of system fonts.
         * 
         * @private
         * @return {Array.<Option>}
         */
        _getOptions: function () {
            var firstMount = !this.state.mounted;
            if (!firstMount) {
                return this.props.options;
            }

            var selectedKey = this.state.selected;
            if (!selectedKey) {
                return this.props.options;
            }

            var index = this._findIndex(this.props.options, selectedKey);
            if (index < 0) {
                return this.props.options;
            }

            var length = this.props.options.size,
                mid = Math.round(INIT_OPTION_COUNT / 2),
                start, end;

            if (index < mid) {
                start = 0;
                end = Math.min(INIT_OPTION_COUNT, length);
            } else if (length - mid < index) {
                start = Math.max(0, length - mid);
                end = length;
            } else {
                start = index - mid;
                end = index + mid;
            }

            return this.props.options.slice(start, end);
        },
      
        /**
         * Gets the next non-header option after the option at the index
         * 
         * @private
         * @param {Array.<Option>} options The option list to look through
         * @param {number} index 
         * @return {Option}
         */
        _getNext: function (options, index) {
            var length = options.size,
                next = (index + 1) < length ? options.get(index + 1) : null,
                nextID = next ? next.id : null,
                nextType = next ? next.type : null;
            
            while (nextType && nextType === "header" && (index + 1) <= length) {
                index++;
                next = (index + 1) < length ? options.get(index + 1) : null;
                nextID = next ? next.id : null;
                nextType = next ? next.type : null;
            }
            return nextID;
        },
        
        /**
         * Gets the closest previous non-header option before the option at the index
         * 
         * @private
         * @param {Array.<Option>} options The option list to look through
         * @param {number} index 
         * @return {Option}
         */
        _getPrev: function (options, index) {
            var prev = index > 0 ? options.get(index - 1) : null,
                prevID = prev ? prev.id : null,
                prevType = prev ? prev.type : null;
            
            while (prevType && prevType === "header" && index >= 0) {
                index--;
                prev = index > 0 ? options.get(index - 1) : null;
                prevID = prev ? prev.id : null;
                prevType = prev ? prev.type : null;
            }
            return prevID;
        },

        render: function () {
            var selectedKey = this.state.selected,
                options = this._getOptions(),
                children = options.map(function (option, index) {
                    var id = option.id,
                        selected = id === selectedKey,
                        next = this._getNext(options, index),
                        prev = this._getPrev(options, index);

                    if (option.type && option.type === "header") {
                        // If option at index + 1 is another header, then don't want to render this header
                        var nextOption = options.get(index + 1);
                        if (!nextOption || nextOption.type === "header") {
                            return;
                        }
                        
                        return (
                            <Header
                                key={id}
                                title={option.title}>
                            </Header>
                        );
                    }

                    return (
                        <Option
                            ref={id}
                            key={id}
                            value={option}
                            selected={selected}
                            next={next}
                            prev={prev} />
                    );
                }, this);

            return (
                <ul {...this.props}
                    className="select"
                    onClick={this._handleClick}
                    onMouseMove={this._handleMouseMove}>
                    {children}
                </ul>
            );
        },

        /**
         * Scroll the list to ensure that the selectedKey is visible, if necessary.
         * 
         * @private
         * @param {string} selectedKey
         */
        _scrollToIfNeeded: function (selectedKey) {
            if (!selectedKey) {
                return;
            }

            var selectedComponent = this.refs[selectedKey];
            if (!selectedComponent) {
                return;
            }

            var selectedEl = React.findDOMNode(selectedComponent),
                selectedRect = selectedEl.getBoundingClientRect(),
                selectedTop = selectedRect.top,
                selectedBottom = selectedRect.bottom;

            var parentEl = selectedEl.offsetParent,
                parentRect = parentEl.getBoundingClientRect(),
                parentTop = parentRect.top,
                parentBottom = parentRect.bottom;

            if (selectedTop < parentTop) {
                // scroll up
                selectedEl.offsetParent.scrollTop = selectedEl.offsetTop;
            } else if (parentBottom < Math.round(selectedBottom)) {
                // scroll down
                selectedEl.offsetParent.scrollTop =
                    selectedEl.offsetTop -
                    selectedEl.offsetParent.offsetHeight +
                    selectedEl.offsetHeight;
            }
        },

        /**
         * Scroll the list in its parent container so that the selected option
         * is vertically centered.
         * 
         * @private
         * @param {string} selectedKey
         */
        _scrollTo: function (selectedKey) {
            if (!selectedKey) {
                return;
            }

            var selectedComponent = this.refs[selectedKey];
            if (!selectedComponent) {
                return;
            }

            // offsetTop - (parent.offsetHeight / 2) is the distance to the top
            // of the selected element; add offsetHeight/2 to reach the middle
            // of the selected element.
            var selectedEl = React.findDOMNode(selectedComponent);
            selectedEl.offsetParent.scrollTop =
                selectedEl.offsetTop -
                (selectedEl.offsetParent.offsetHeight / 2) +
                (selectedEl.offsetHeight / 2);
        },

        componentDidMount: function () {
            // Re-render a few milliseconds after mounting with the full set of
            // options. This is hack to eliminate a noticeable pause at mount
            // time with many options.
            window.setTimeout(function () {
                // If we're tabbing between, component will
                // unmount before this timeout occurs
                if (this.isMounted()) {
                    this.setState({
                        mounted: true
                    });
                }
            }.bind(this), 100);

            this._scrollTo(this.state.selected);
        },

        componentDidUpdate: function (prevProps, prevState) {
            if (this.state.mounted) {
                if (!prevState.mounted) {
                    // scroll selected item to center initially
                    this._scrollTo(this.state.selected);
                } else if (this.state.selected) {
                    // afterwards, make sure the selection isn't set out of visibility
                    this._scrollToIfNeeded(this.state.selected);
                }
            }
        }
    });

    module.exports = Select;
});
