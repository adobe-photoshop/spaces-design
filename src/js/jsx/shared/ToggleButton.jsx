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

    var SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        collection = require("js/util/collection");

    /**
     * If an array of selected values are provided, derive state
     *
     * @private
     * @param {boolean || Immutable.Iterable.<boolean>} selected Value or array of values
     *
     * @return {boolean}
     */
    var _normalizeSelected = function (selected) {
        return !!(selected === true ||
            (Immutable.Iterable.isIterable(selected) && collection.uniformValue(selected)));
    };

    var ToggleButton = React.createClass({
        mixins: [React.addons.PureRenderMixin],

        propTypes: {
            selected: React.PropTypes.oneOfType([
                React.PropTypes.bool,
                React.PropTypes.instanceOf(Immutable.Iterable)
            ])
        },

        getDefaultProps: function () {
            return {
                disabled: false
            };
        },

        render: function () {
            var selected = _normalizeSelected(this.props.selected),
                buttonType = this.props.buttonType || "default",
                size = this.props.size || "column-1",
                classNameSet = {
                    "button-toggle": true,
                    "button-toggle__disabled": this.props.disabled
                },
                className = classnames(classNameSet, size, this.props.className),
                selectedButtonType = this.props.selectedButtonType;
                
            if (selected && selectedButtonType) {
                buttonType = selectedButtonType;
            }
                
            return (
                <div
                    title={this.props.title}
                    data-type={buttonType}
                    data-selected={selected}
                    className={className}
                    onClick={!this.props.disabled && this.handleClick.bind(this, !selected)} >
                    <SVGIcon
                        viewBox="0 0 24 24"
                        CSSID={buttonType} />
                </div>
            );
        },

        /** @ignore */
        handleClick: function (newSelected, event) {
            if (this.props.onClick) {
                this.props.onClick(event, newSelected);
            }
        }
    });

    module.exports = ToggleButton;
});
