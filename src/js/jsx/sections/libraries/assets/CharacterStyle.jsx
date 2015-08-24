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
        classnames = require("classnames"),
        tinycolor = require("tinycolor"),
        _ = require("lodash");

    var strings = require("i18n!nls/strings");

    var AssetSection = require("jsx!./AssetSection"),
        AssetPreviewImage = require("jsx!./AssetPreviewImage");

    var CharacterStyle = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                hasPreview: false
            };
        },

        /**
         * Apply the text style to the selected layers
         *
         * @private
         */
        _handleApply: function () {
            this.getFlux().actions.libraries.applyCharacterStyle(this.props.element);
        },
        
        /**
         * Handle completion of loading asset preview.
         *
         * @private
         * @param  {Boolean} hasRendition
         */
        _handlePreviewCompleted: function (hasRendition) {
            if (hasRendition) {
                this.setState({ hasPreview: true });
            }
        },

        render: function () {
            var element = this.props.element,
                charStyle = element.getPrimaryRepresentation().getValue("characterstyle", "data"),
                font = charStyle.adbeFont;

            if (!font) {
                return null;
            }

            var fontSize = charStyle.fontSize,
                fontSizeStr = fontSize ? Math.ceil(fontSize.value * 10) / 10 + fontSize.type : null,
                fontColorHex = null;

            if (charStyle.color) {
                var color = charStyle.color instanceof Array ? charStyle.color[0] : charStyle.color;
                fontColorHex = tinycolor(color.value).toHexString().toUpperCase();
            }

            var fontSizeAndColorStr = _.remove([fontSizeStr, fontColorHex], null).join(", ");

            var classNames = classnames("libraries__asset", {
                "assets__graphic__dragging": this.props.isDragging,
                "libraries__asset-selected": this.props.selected
            });

            var displayName = element.displayName !== "" ? element.displayName : font.name + " " + font.style,
                colorPreview = this.state.hasPreview && fontColorHex && (<div
                    style={{ backgroundColor: fontColorHex }}
                    className="libraries__asset__preview-character-style__color-swatch"/>);

            return (
                <div className={classNames}
                     key={element.id}>
                    <div className="libraries__asset__preview libraries__asset__preview-character-style"
                         title={strings.LIBRARIES.CLICK_TO_APPLY}
                         onClick={this._handleApply}>
                        <AssetPreviewImage
                            element={this.props.element}
                            onComplete={this._handlePreviewCompleted}/>
                        {colorPreview}
                    </div>

                    <AssetSection
                        element={this.props.element}
                        onSelect={this.props.onSelect}
                        selected={this.props.selected}
                        title={displayName}
                        subTitle={fontSizeAndColorStr}/>
                </div>
            );
        }
    });

    module.exports = CharacterStyle;
});
