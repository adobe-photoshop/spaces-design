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
        Immutable = require("immutable");

    /**
     * A component that represents a single option from a select component.
     * 
     * @constructor
     */
    var Option = React.createClass({
        shouldComponentUpdate: function (nextProps) {
            // Note that we ONLY re-render if the selection status changes
            return this.props.selected !== nextProps.selected;
        },

        render: function () {
            var id = this.props.id,
                style = this.props.style,
                className = React.addons.classSet({
                    "select__option": true,
                    "select__option__selected": this.props.selected
                });

            return (
                <li {...this.props}
                    data-id={id}
                    className={className}
                    style={style}>
                    {this.props.children}
                </li>
            );
        }
    });
    
    /**
     * Approximates an HTML <select> element. (CEF does not support select in
     * off-screen rendering mode.)
     */
    var Select = React.createClass({
        mixins: [React.addons.PureRenderMixin],

        propTypes: {
            options: React.PropTypes.instanceOf(Immutable.Iterable).isRequired,
            defaultSelected: React.PropTypes.string,
        },

        componentWillReceiveProps: function (nextProps) {
            var selected = this.state.selected,
                found = nextProps.options.some(function (option) {
                    if (option.id === selected) {
                        return true;
                    }
                });

            if (!found && nextProps.options.size > 0) {
                this._scrollTo(nextProps.options.get(0).id);
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
                selectedKey = this.props.options.get(extreme).id;
                this._setSelected(selectedKey);
                this._scrollTo(selectedKey);
                return;
            }

            var selectedComponent = this.refs[selectedKey];
            if (!selectedComponent) {
                selectedKey = this.props.options.get(extreme).id;
                this._setSelected(selectedKey);
                this._scrollTo(selectedKey);
                return;
            }

            var nextSelectedKey = selectedComponent.props[property];
            if (!nextSelectedKey) {
                return;
            }

            this._setSelected(nextSelectedKey);                
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
         */
        close: function (event) {
            this.props.onClose(event);
        },

        /**
         * Update the selection and close the dialog on click.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleClick: function (event) {
            this._setSelectedFromMouseEvent(event);

            this.props.onClose(event);

            if (this.props.onClick) {
                this.props.onClick(event);
            }
        },

        /**
         * Update the selection when hovering over an option
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseMove: function (event) {
            this._setSelectedFromMouseEvent(event);

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

            // FIXME: provide a "sorted" prop; use a binary search
            var index = this.props.options.findIndex(function (obj) {
                return obj.id === selectedKey;
            });

            if (index < 0) {
                return this.props.options;
            }

            var length = this.props.options.size,
                start, end;
            if (index < 50) {
                start = 0;
                end = Math.min(100, length);
            } else if (length - 50 < index) {
                start = Math.max(0, length - 50);
                end = length;
            } else {
                start = index - 50;
                end = index + 50;
            }

            return this.props.options.slice(start, end);
        },

        render: function () {
            var selectedKey = this.state.selected,
                options = this._getOptions(),
                length = options.size,
                children = options.map(function (option, index) {
                    var id = option.id,
                        title = option.title,
                        style = option.style,
                        selected = id === selectedKey,
                        next = (index + 1) < length ? options.get(index + 1).id : null,
                        prev = index > 0 ? options.get(index - 1).id : null;

                    return (
                        <Option 
                            id={id}
                            ref={id}
                            key={id}
                            next={next}
                            prev={prev}
                            style={style}
                            selected={selected}>
                            {title}
                        </Option>
                    );
                }, this);

            return (
                <ul {...this.props}
                    className="select"
                    onClick={this._handleClick}
                    onMouseMove={this._handleMouseMove}>
                    {children.toArray()}
                </ul>
            );
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
            var selectedEl = selectedComponent.getDOMNode();
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
                this.setState({
                    mounted: true
                });
            }.bind(this), 100);

            this._scrollTo(this.state.selected);
        },

        componentDidUpdate: function (prevProps, prevState) {
            if (this.state.mounted && !prevState.mounted) {
                this._scrollTo(this.state.selected);
            }
        },
    });

    module.exports = Select;
});
