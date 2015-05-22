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

    var os = require("adapter/os");

    var Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon");

    var synchronization = require("js/util/synchronization");

    var Library = React.createClass({

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
        },

        /**
         * Selects the content of the input on focus.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleFocus: function (event) {
            event.target.scrollIntoViewIfNeeded();
            if (this.props.onFocus) {
                this.props.onFocus(event);
            }
        },

        _handleAdd: function (element) {
            if (this.props.addElement) {
                this.props.addElement(element);
            }
        },

        _getLibraryItems: function (items) {
            if (!items) {
                return null;
            }

            var elements = items.map(function (element) {
                return (
                    <div className="sub-header"
                        key={element.id}>
                        <img src={element.renditionPath} />
                        {element.name}
                        <Button
                            title="Add to Photoshop"
                            className="button-plus"
                            onClick={this._handleAdd.bind(this, element)}>
                            <SVGIcon
                                viewbox="0 0 12 12"
                                CSSID="plus" />
                        </Button>
                    </div>
                );
            }, this);

            return elements;
        },

        render: function () {
            var items = this._getLibraryItems(this.props.items);

            return (
                <div>
                    {items}
                </div>
            );
        }
    });

    module.exports = Library;
});
