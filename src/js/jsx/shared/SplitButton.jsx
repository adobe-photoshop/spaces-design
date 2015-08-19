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

    var SVGIcon = require("jsx!js/jsx/shared/SVGIcon");
    
    /**
     * A Component which represents an individual button within a SplitButtonList
     */
    var SplitButtonItem = React.createClass({
        mixins: [React.addons.PureRenderMixin],

        propTypes: {
            id: React.PropTypes.string,
            onChange: React.PropTypes.func,
            selected: React.PropTypes.bool,
            disabled: React.PropTypes.bool
        },

        render: function () {
            var buttonClasses = classnames({
                    "split-button__item__selected": this.props.selected,
                    "split-button__item__disabled": this.props.disabled,
                    "split-button__item": true
                }, this.props.className);
            
            var buttonIcon;
            if (this.props.iconId) {
                buttonIcon = (<SVGIcon viewBox="0 0 16 16" CSSID={this.props.iconId}
                    iconPath={this.props.iconPath}/>);
            } else {
                buttonIcon = this.props.children;
            }

            return (
                <li className={buttonClasses}
                    id={this.props.id}
                    title={this.props.title}
                    onClick={this.props.disabled ? null : this.props.onClick}>
                    {buttonIcon}
                </li>
            );
        }
    });
    
    /**
     * A Component which wraps a list of SplitButtonItems
     */
    var SplitButtonList = React.createClass({
        mixins: [React.addons.PureRenderMixin],

        render: function () {
            var buttonWrapperClasses;
            
            if (!this.props.size) {
                var numberOfItems = React.Children.count(this.props.children);

                // TODO make this more readable and move complexity to LESS
                buttonWrapperClasses = classnames({
                    "column-12": numberOfItems < 4,
                    "column-14": numberOfItems >= 4
                }, "button-radio", this.props.className);
            } else {
                buttonWrapperClasses = classnames("button-radio", this.props.className, this.props.size);
            }

            return (
                <ul className={buttonWrapperClasses} >
                    {this.props.children}
                </ul>
            );
        }
    });

    module.exports.SplitButtonList = SplitButtonList;
    module.exports.SplitButtonItem = SplitButtonItem;
});
