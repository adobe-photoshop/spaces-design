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
        FluxMixin = Fluxxor.FluxMixin(React);

    var strings = require("i18n!nls/strings");

    var SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem;

    var AssetSection = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            element: React.PropTypes.object.isRequired,
            onSelect: React.PropTypes.func
        },

        /**
         * Handle select asset event.
         * @param  {SynthenticEvent} event
         *
         * @private
         */
        _handleSelect: function (event) {
            if (event.target !== React.findDOMNode(this)) {
                return;
            }

            if (this.props.onSelect) {
                this.props.onSelect(this.props.element);
            }
        },

        /**
         * Handle rename asset event.
         * @param  {SynthenticEvent} event
         *
         * @private
         */
        _handleRename: function (event) {
            event.stopPropagation();
        },

        render: function () {
            var sectionContent;

            if (this.props.selected) {
                sectionContent = (
                    <SplitButtonList className="libraries__asset__buttons">
                        <SplitButtonItem
                            title={strings.TOOLTIPS.LIBRARY_DELETE}
                            iconId="delete"
                            disabled={true} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.LIBRARY_SEND_LINK}
                            iconId="libraries-share"
                            disabled={true} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.LIBRARY_VIEW_ON_WEBSITE}
                            iconId="libraries-viewonsite"
                            disabled={true} />
                    </SplitButtonList>
                );
            } else {
                sectionContent = React.cloneElement(this.props.children, { onDoubleClick: this._handleRename });
            }

            return (
                <div className="libraries__asset__section"
                     onClick={this._handleSelect}>
                    {sectionContent}
                </div>
            );
        }
    });

    module.exports = AssetSection;
});
