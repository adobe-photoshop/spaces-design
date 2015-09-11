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
        _ = require("lodash");

    var strings = require("i18n!nls/strings"),
        ColorModel = require("js/models/color");

    var AssetSection = require("jsx!./AssetSection");

    var Color = React.createClass({
        mixins: [FluxMixin],
    
        /**
         * Find color asset's RGB representation and then return instance of Color model.
         *
         * @private
         * @return {ColorModel}
         */
        _getColor: function () {
            var reps = this.props.element.representations,
                colors = reps.map(function (r) { return r.getValue("color", "data"); }),
                // Color Asset is guaranteed to have a RGB representation.
                rgb = _.find(colors, { "mode": "RGB" });
            
            return new ColorModel({ r: rgb.value.r, g: rgb.value.g, b: rgb.value.b });
        },

        /**
         * Return string value of color asset's primary representation.
         *
         * @private
         * @return {string}
         */
        _getPrimaryColorStringValue: function () {
            var representation = this.props.element.getPrimaryRepresentation(),
                color = representation.getValue("color", "data"),
                result;
            
            if (color) {
                if (color.mode === "CMYK") {
                    result = "C" + Math.round(color.value.c) +
                        " M" + Math.round(color.value.m) +
                        " Y" + Math.round(color.value.y) +
                        " K" + Math.round(color.value.k);
                } else if (color.mode === "RGB") {
                    result = "R" + Math.round(color.value.r) +
                        " G" + Math.round(color.value.g) +
                        " B" + Math.round(color.value.b);
                } else if (color.mode === "Lab") {
                    result = "L" + Math.round(color.value.l) +
                        " A" + Math.round(color.value.a) +
                        " B" + Math.round(color.value.b);
                } else if (color.mode === "HSB") {
                    result = "H" + Math.round(color.value.h) +
                        " S" + Math.round(color.value.s) +
                        " B" + Math.round(color.value.b);
                } else if (color.mode === "Gray") {
                    result = "G" + Math.round(color.value);
                }
            }
            
            return result;
        },

        /**
         * Apply color to the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleApply: function (event) {
            event.stopPropagation();

            this.getFlux().actions.libraries.applyColor(this._getColor());
        },

        render: function () {
            var element = this.props.element,
                title = this._getPrimaryColorStringValue(),
                hexValue = this._getColor().toTinyColor().toHexString().toUpperCase(),
                displayName = element.displayName || hexValue;

            return (
                 <AssetSection
                    element={this.props.element}
                    onSelect={this.props.onSelect}
                    selected={this.props.selected}
                    displayName={displayName}
                    title={title}
                    key={element.id}>
                    <div className="libraries__asset__preview"
                         style={{ background: hexValue }}
                         title={strings.LIBRARIES.CLICK_TO_APPLY}
                         onClick={this._handleApply}/>
                </AssetSection>
            );
        }
    });

    module.exports = Color;
});
