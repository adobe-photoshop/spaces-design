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

    var Color = React.createClass({
        mixins: [FluxMixin],

        componentWillMount: function () {
            var element = this.props.element,
                representation = element.getPrimaryRepresentation(),
                color = representation.getValue("color", "data"),
                colorString = this._getStringColorValue(color),
                hexValue = this._colorDataToHexValue(color);

            this.setState({
                colorString: colorString,
                hexValue: hexValue
            });
        },

        // Grabbed from CC-libraries-panel
        _getStringColorValue: function (color) {
            var result;
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

        _colorDataToHexValue: function (data) {
            /*jshint bitwise: false*/
            var r = data.value.r,
                g = data.value.g,
                b = data.value.b,
                u = r << 16 | g << 8 | b,
                str = "000000" + u.toString(16);

            return "#" + str.substr(str.length - 6);
        },

        _handleAdd: function () {
            // Do something with color here
        },

        render: function () {
            var element = this.props.element;
            return (
                <div className="sub-header"
                    key={element.id}>
                    <div className="library-color-swatch"
                        style={{
                            background: this.state.hexValue
                        }}
                    />
                    {this.state.colorString}
                </div>
            );
        }
    });

    module.exports = Color;
});
