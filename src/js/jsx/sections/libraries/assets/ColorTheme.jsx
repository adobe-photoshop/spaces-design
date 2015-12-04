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
        tinycolor = require("tinycolor"),
        _ = require("lodash");

    var ColorModel = require("js/models/color"),
        headlights = require("js/util/headlights");

    var AssetSection = require("./AssetSection");

    var ColorTheme = React.createClass({
        mixins: [FluxMixin],

        /**
         * Apply color to the selected layers.
         *
         * @private
         * @param {object} colorData
         * @param {SyntheticEvent} event
         */
        _handleApply: function (colorData, event) {
            event.stopPropagation();

            var color = new ColorModel({ r: colorData.value.r, g: colorData.value.g, b: colorData.value.b });

            this.getFlux().actions.libraries.applyColor(color);
            headlights.logEvent("libraries", "element", "apply-color-theme");
        },
        
        /**
         * Return color swatches of a color theme asset. If the colors has more than one mode, colors with RGB mode 
         * will be picked as default colors.
         * 
         * @return {Array.<object>} 
         */
        _getRGBColorSwatches: function () {
            var colorSwatches = this.props.element.getPrimaryRepresentation().getValue("colortheme", "data").swatches;
            
            return colorSwatches.map(function (colors) {
                if (colors.length === 1) {
                    return colors[0];
                }
                
                // Each color is guarateed to have a RGB representation.
                return _.find(colors, { mode: "RGB" });
            });
        },

        render: function () {
            var element = this.props.element,
                colorSwatches = this._getRGBColorSwatches();

            var colorSwatchComponents = colorSwatches.map(function (colorData, index) {
                var colorHex = tinycolor(colorData.value).toHexString().toUpperCase();

                return (<div key={index}
                             style={{ background: colorHex }}
                             title={colorHex}
                             onClick={this._handleApply.bind(this, colorData)}/>);
            }.bind(this));

            return (
                <AssetSection
                    element={this.props.element}
                    onSelect={this.props.onSelect}
                    selected={this.props.selected}
                    displayName={element.displayName}
                    classNames="libraries__asset-colortheme">
                    <div className="libraries__asset__preview libraries__asset__preview-colortheme">
                        {colorSwatchComponents}
                    </div>
                </AssetSection>
            );
        }
    });

    module.exports = ColorTheme;
});
