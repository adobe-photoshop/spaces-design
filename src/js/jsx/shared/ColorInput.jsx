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
        Immutable = require("immutable"),
        _ = require("lodash");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        ColorPicker = require("jsx!js/jsx/shared/ColorPicker"),
        Color = require("js/models/color"),
        strings = require("i18n!nls/strings"),
        tinycolor = require("tinycolor"),
        collection = require("js/util/collection");

    var ColorInput = React.createClass({
        propTypes: {
            id: React.PropTypes.string.isRequired,
            defaultValue: React.PropTypes.oneOfType([
                    React.PropTypes.instanceOf(Color),
                    React.PropTypes.instanceOf(Immutable.Iterable)
                ]),
            onChange: React.PropTypes.func,
            editable: React.PropTypes.bool
        },

        getDefaultProps: function() {
            return {
                defaultColor: Color.DEFAULT,
                onChange: _.identity
            };
        },

        /**
         * Force the ColorPicker slider to update its position.
         *
         * @param {Color} color
         */
        updateColorPicker: function (color) {
            var colorpicker = this.refs.colorpicker;
            if (colorpicker) {
                colorpicker.setColor(color);
            }
        },

        /**
         * Update the color picker and fire a change event when the text input
         * changes.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleInputChanged: function (event) {
            var value = event.target.value,
                color = Color.fromTinycolor(tinycolor(value));

            this.updateColorPicker(color);
            this.props.onChange(color);
        },

        /**
         * Fire a change event when the color picker's color changes.
         * 
         * @private
         * @param {Color} color
         */
        _handleColorChanged: function (color) {
            this.props.onChange(color);
        },

        /**
         * Do nothing beyond stopping event propagation if the color picker is
         * open to prevent the dialog from closing due to a window click.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleInputClicked: function (event) {
            var dialog = this.refs.dialog;
            if (dialog.isOpen()) {
                event.stopPropagation();
            }
        },

        /**
         * Open the color picker dialog on click.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _toggleColorPicker: function (event) {
            var dialog = this.refs.dialog;
            if (this.props.editable) {
                if (!dialog.isOpen()) {
                    dialog.toggle(event);
                } else {
                    event.stopPropagation();
                }
            }
        },

        render: function () {
            var swatchStyle = null,
                swatchClassSet = null,
                swatchClassProps = {
                    "color-input": true
                };
            
            // Normalize to arrays
            var defaultValue = this.props.defaultValue,
                valueArray = !Immutable.Iterable.isIterable(defaultValue) ?
                    Immutable.List.of(defaultValue) : defaultValue,
                value = collection.uniformValue(valueArray),
                color,
                label;

            // setup text and swatch based on the mixed-ness of the inputs
            if (value) {
                if (typeof value === "string") {
                    label = value;
                    color = Color.DEFAULT;
                    swatchClassProps["color-input__invalid-color"] = true;    
                } else {
                    // naive tinycolor toString
                    var colorTiny = tinycolor(value.toJS());
                    color = value;
                    label = colorTiny.toString();
                    swatchStyle = {
                        "backgroundColor": colorTiny.toHexString(),
                        opacity: colorTiny.getAlpha(),
                    };
                }
            } else {
                label = strings.TRANSFORM.MIXED;
                color = Color.DEFAULT;
                swatchClassProps["color-input__mixed"] = true;
            }

            // swatch
            swatchClassSet = React.addons.classSet(swatchClassProps);

            return (
                <div>
                    <div className={swatchClassSet}>
                        <div
                            className="color-input__swatch__background"
                            onClick={this._toggleColorPicker}>
                            <div
                                title={this.props.title}
                                className="color-input__swatch__color"
                                style={swatchStyle} />
                        </div>
                        <Gutter />
                        <TextInput
                            editable={this.props.editable}
                            value={label}
                            singleClick={true}
                            onChange={this._handleInputChanged}
                            onClick={this._handleInputClicked}
                            valueType="color" />
                    </div>
                    <Dialog
                        ref="dialog"
                        id={"colorpicker-" + this.props.id}
                        disabled={!this.props.editable}
                        dismissOnDocumentChange
                        dismissOnSelectionTypeChange
                        dismissOnWindowClick>
                        <ColorPicker
                            ref="colorpicker"
                            color={color}
                            onChange={this._handleColorChanged} />
                    </Dialog>
                </div>
            );
        },

        componentDidUpdate: function (prevProps) {
            // Force-update the color picker state when changing contexts
            var dialog = this.refs.dialog;
            if (dialog.isOpen() && !Immutable.is(this.props.context, prevProps.context)) {
                var color = this.refs.colorpicker.props.color;
                this.updateColorPicker(color);
            }
        }
    });

    module.exports = ColorInput;
});
