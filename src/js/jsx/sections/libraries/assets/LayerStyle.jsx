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

    var nls = require("js/util/nls"),
        headlights = require("js/util/headlights");

    var AssetSection = require("./AssetSection"),
        AssetPreviewImage = require("./AssetPreviewImage");

    var LayerStyle = React.createClass({
        mixins: [FluxMixin],

        /**
         * Apply the layer style to the selected layers
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleApply: function (event) {
            event.stopPropagation();

            this.getFlux().actions.libraries.applyLayerStyle(this.props.element);
            headlights.logEvent("libraries", "element", "apply-layerstyle");
        },

        render: function () {
            var element = this.props.element;

            return (
                <AssetSection
                    element={this.props.element}
                    onSelect={this.props.onSelect}
                    selected={this.props.selected}
                    displayName={element.displayName}
                    key={element.id}>
                    <div className="libraries__asset__preview libraries__asset__preview-layer-style"
                         onClick={this._handleApply}
                         title={nls.localize("strings.LIBRARIES.CLICK_TO_APPLY")}>
                        <AssetPreviewImage element={this.props.element}/>
                    </div>
                </AssetSection>
            );
        }
    });

    module.exports = LayerStyle;
});
