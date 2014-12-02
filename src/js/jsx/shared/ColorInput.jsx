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
        strings = require("i18n!nls/strings"),
        tinycolor = require("tinycolor"),
        objUtil = require("js/util/object"),
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
            defaultColor: React.PropTypes.oneOfType([
                    React.PropTypes.object,
                    React.PropTypes.array
                ]),
            defaultText: React.PropTypes.oneOfType([
                    React.PropTypes.string,
                    React.PropTypes.array
                ]),
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
            var color = this.props.defaultColor || getDefaultColor(),
                colorTiny = null,
                colorLabel = null,
                swatchStyle = null,
                swatchClassSet = null,
                swatchClassProps = {
                    "color-input": true
                };
            
            // Normalize to arrays
            var defaultTextArray = !_.isArray(this.props.defaultText) ?
                    [this.props.defaultText] :
                    this.props.defaultText,
                colorArray = !_.isArray(color) ? [color] : color;

            // setup text and swatch based on the mixed-ness of the inputs
            if (!objUtil.arrayValuesEqual(colorArray, true) || !objUtil.arrayValuesEqual(defaultTextArray)) {
                colorLabel = strings.TRANSFORM.MIXED;
                swatchClassProps["color-input__mixed"] = true;
            } else if (!_.isEmpty(defaultTextArray[0])) {
                colorLabel = defaultTextArray[0];
                swatchClassProps["color-input__invalid-color"] = true;
            } else {
                // naive tinycolor toString
                colorTiny = tinycolor(colorArray[0]);
                colorLabel = colorTiny.toString();
                swatchStyle = {
                    "backgroundColor": colorTiny.toHexString(),
                    opacity: colorTiny.getAlpha(),
                };
            }

            // swatch
            swatchClassSet = React.addons.classSet(swatchClassProps);
            
            return (
                <div className={swatchClassSet}>
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
