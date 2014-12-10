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
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        tinycolor = require("tinycolor"),
        _ = require("lodash");

    /**
     * Provide a default color object.  Currently transparent white.
     * @return {tinycolor}
     */
    var getDefaultColor = function () {
        return tinycolor("#fff").setAlpha(0);
    };

    var ColorInput = React.createClass({

        propTypes: {
            defaultColor: React.PropTypes.object,
            defaultText: React.PropTypes.string,
            onChange: React.PropTypes.func,
            editable: React.PropTypes.bool
        },

        getDefaultProps: function() {
            return {
                defaultColor: getDefaultColor(),
                onChange: _.identity
            };
        },

        render: function () {
            var color = this.props.defaultColor ? tinycolor(this.props.defaultColor) : getDefaultColor(),
                // TODO this is a fairly naive use of toString
                colorLabel = this.props.defaultText || color.toString(),
                swatchStyle = {
                    "backgroundColor": color.toHexString(),
                    opacity: color.getAlpha(),
                };

            return (
                <div className="color-input">
                    <div className="color-input__swatch__background" onClick={this.props.onClick}>
                        <div
                            title={this.props.title}
                            className="color-input__swatch__color"
                            style={swatchStyle} />
                    </div>
                    <Gutter />
                    <TextInput
                        editable={this.props.editable}
                        value={colorLabel}
                        onChange={this.props.onChange}
                        valueType="color" />
                </div>
            );
        }
    });

    module.exports = ColorInput;
});
