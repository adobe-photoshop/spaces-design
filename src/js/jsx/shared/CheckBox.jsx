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
        classnames = require("classnames"),
        _ = require("lodash");

    var collection = require("js/util/collection");

    /**
     * If an array of selected values are provided, derive state
     *
     * @private
     * @param {boolean || Immutable.Iterable.<boolean>} selected Value or array of values
     *
     * @return {boolean}
     */
    var _normalizeSelected = function (selected) {
        return selected === true ||
            (Immutable.Iterable.isIterable(selected) && collection.uniformValue(selected));
    };

    var CheckBox = React.createClass({
        mixins: [React.addons.PureRenderMixin],

        propTypes: {
            checked: React.PropTypes.oneOfType([
                React.PropTypes.bool,
                React.PropTypes.instanceOf(Immutable.Iterable)
            ]),
            onChange: React.PropTypes.func,
            disabled: React.PropTypes.bool,
            size: React.PropTypes.string,
            title: React.PropTypes.string,
            className: React.PropTypes.string
        },

        getDefaultProps: function () {
            return {
                disabled: false
            };
        },

        getInitialState: function () {
            return {
                uniqueId: _.uniqueId("button-checkbox")
            };
        },

        /**
         * Handle a toggle of the checkbox, call props.onChange(event, checked) if it exists
         * @private
         * @param {SyntheticEvent} event
         */
        _handleClick: function (event) {
            if (this.props.onChange) {
                this.props.onChange(event, event.target.checked);
            }
        },

        render: function () {
            var checked = _normalizeSelected(this.props.checked),
                size = this.props.size,
                classNameSet = {
                    "button-checkbox": true,
                    "button-checkbox__disabled": this.props.disabled,
                    "button-checkbox__mixed": checked === null
                },
                className = classnames(size, this.props.className, classNameSet);
                
            return (
                <div
                    title={this.props.title}
                    className={className} >
                    <input
                        id={this.state.uniqueId}
                        type="checkbox"
                        checked={checked}
                        onChange={!this.props.disabled && this._handleClick} />
                    <label htmlFor={this.state.uniqueId}></label>
                </div>
            );
        }

    });

    module.exports = CheckBox;
});
