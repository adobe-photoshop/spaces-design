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

    var strings = require("i18n!nls/strings");

    var AssetSection = require("jsx!./AssetSection"),
        AssetPreviewImage = require("jsx!./AssetPreviewImage");

    var LayerStyle = React.createClass({
        mixins: [FluxMixin],

        /**
         * Apply the layer style to the selected layers
         *
         * @private
         */
        _handleApply: function () {
            this.getFlux().actions.libraries.applyLayerStyle(this.props.element);
        },

        render: function () {
            var element = this.props.element;

            var classNames = classnames("libraries__asset", {
                "libraries__asset-selected": this.props.selected
            });

            return (
                <div className={classNames}
                     key={element.id}
                     title={strings.LIBRARIES.CLICK_TO_APPLY}>
                    <div className="libraries__asset__preview libraries__asset__preview-layer-style"
                         onClick={this._handleApply}>
                        <AssetPreviewImage element={this.props.element}/>
                    </div>
                    <AssetSection
                        element={this.props.element}
                        onSelect={this.props.onSelect}
                        selected={this.props.selected}
                        title={element.displayName}/>
                </div>
            );
        }
    });

    module.exports = LayerStyle;
});
