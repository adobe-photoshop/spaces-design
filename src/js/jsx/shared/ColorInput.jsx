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
        Immutable = require("immutable"),
        _ = require("lodash");

    var os = require("adapter/os");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        ColorPicker = require("jsx!js/jsx/shared/ColorPicker"),
        Color = require("js/models/color"),
        strings = require("i18n!nls/strings"),
        tinycolor = require("tinycolor"),
        collection = require("js/util/collection");

    var ColorInput = React.createClass({
        mixins: [Fluxxor.FluxMixin(React)],
        propTypes: {
            id: React.PropTypes.string.isRequired,
            defaultValue: React.PropTypes.oneOfType([
                    React.PropTypes.instanceOf(Color),
                    React.PropTypes.instanceOf(Immutable.Iterable)
                ]),
            onChange: React.PropTypes.func,
            onFocus: React.PropTypes.func,
            onColorChange: React.PropTypes.func,
            onAlphaChange: React.PropTypes.func,
            editable: React.PropTypes.bool,
            swatchOverlay: React.PropTypes.func
        },

        getDefaultProps: function() {
            return {
                defaultColor: Color.DEFAULT,
                onChange: _.identity,
                onFocus: _.identity,
                onAlphaChange: _.identity,
                onColorChange: _.identity
            };
        },

        getInitialState: function () {
            return {
                format: null
            };
        },

        /**
         * Force the ColorPicker slider to update its position.
         *
         * @param {Color} color
         */
        updateColorPicker: function (color, quiet) {
            var colorpicker = this.refs.colorpicker;
            if (colorpicker) {
                colorpicker.setColor(color, quiet);
            }
        },

        _getID: function () {
            return "colorpicker-" + this.props.id;
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
                colorTiny = tinycolor(value),
                color = Color.fromTinycolor(colorTiny);

            if (colorTiny.isValid()) {
                this.setState({
                    format: colorTiny.getFormat()
                });
            }

            this.updateColorPicker(color);
            this.props.onChange(color);
        },
        /**
         * Selects the content of the input on focus.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleFocus: function (event) {
            if (this.props.onFocus) {
                this.props.onFocus(event);
            } 
        },

        /**
         * Fire a change event when the color picker's color changes.
         * 
         * @private
         * @param {Color} color
         */
        _handleColorChanged: function (color) {
            this.props.onColorChange(color);
        },

        /**
         * Fire a change event when the color picker's alpha value changes.
         *
         * @private
         * @param {Color} color
         */
        _handleAlphaChanged: function (color) {
            this.props.onAlphaChange(color);
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
            if (this.props.editable && dialog) {
                var flux = this.getFlux(),
                    id = this._getID();

                if (!dialog.isOpen()) {
                    // register a high-priority shortcut to override superselect escape
                    flux.actions.shortcuts.addShortcut(os.eventKeyCode.ESCAPE,
                        {}, this._toggleColorPicker, id, true);
                }

                dialog.toggle(event);
            }
        },

        /**
         * Uninstall the transient shortcuts that dismiss the picker dialog on close.
         */
        _handleDialogClose: function () {
            var flux = this.getFlux(),
                id = this._getID();

            flux.actions.shortcuts.removeShortcut(id);
        },

        render: function () {
            var swatchClassSet = null,
                swatchClassProps = {
                    "color-input": true
                };
            
            // Normalize to arrays
            var defaultValue = this.props.defaultValue,
                valueArray = !Immutable.Iterable.isIterable(defaultValue) ?
                    Immutable.List.of(defaultValue) : defaultValue,
                value = collection.uniformValue(valueArray),
                label,
                color,
                colorTiny;

            // setup text and swatch based on the mixed-ness of the inputs
            if (value) {
                if (typeof value === "string") {
                    label = value;
                    color = Color.DEFAULT;
                    swatchClassProps["color-input__invalid-color"] = true;    
                } else {
                    // naive tinycolor toString
                    colorTiny = tinycolor(value.toJS());
                    color = value;
                    label = colorTiny.toString(this.state.format);
                }
            } else {
                label = strings.TRANSFORM.MIXED;
                swatchClassProps["color-input__mixed"] = true;

                // The colors aren't completely uniform, but maybe the opaque colors are?
                value = collection.uniformValue(valueArray.map(function (color) {
                    return _.isObject(color) && color.opaque();
                }));

                if (!value) {
                    // The opaque colors aren't completely uniform, but maybe the alpha values are?
                    var alpha = collection.uniformValue(collection.pluck(valueArray, "a"), null);
                    if (alpha !== null) {
                        value = Color.DEFAULT.set("a", alpha);
                    }
                }

                if (value) {
                    colorTiny = tinycolor(value.toJS());
                    color = value;
                } else {
                    color = Color.DEFAULT;
                }
            }

            // swatch
            swatchClassSet = React.addons.classSet(swatchClassProps);

            return (
                <div className={swatchClassSet}>
                    <div
                        className="color-input__swatch__background"
                        onClick={this._toggleColorPicker}>
                        <div
                            title={this.props.title}
                            className="color-input__swatch__color">
                            {this.props.swatchOverlay(colorTiny)}
                        </div>
                    </div>
                    <Gutter />
                    <Dialog
                        ref="dialog"
                        id={this._getID()}
                        className={"color-picker__" + this.props.className}
                        disabled={!this.props.editable}
                        onClose={this._handleDialogClose}
                        dismissOnDocumentChange
                        dismissOnSelectionTypeChange
                        dismissOnWindowClick>
                        <ColorPicker
                            ref="colorpicker"
                            color={color}
                            onAlphaChange={this._handleAlphaChanged}
                            onColorChange={this._handleColorChanged} />
                    </Dialog>
                    <div className="compact-stats">
                        <div className="compact-stats__header">
                            <TextInput
                                live={this.props.editable}
                                editable={this.props.editable}
                                value={label}
                                singleClick={true}
                                onChange={this._handleInputChanged}
                                onFocus={this._handleFocus}
                                onClick={this._handleInputClicked}
                                size="column-15" />
                        </div>
                        {this.props.children}
                    </div>
                </div>
            );
        },

        componentDidUpdate: function (prevProps) {
            // Force-update the color picker state when changing contexts
            var dialog = this.refs.dialog;
            if (dialog.isOpen() && !Immutable.is(this.props.context, prevProps.context)) {
                var color = this.refs.colorpicker.props.color;
                this.updateColorPicker(color, true); // don't emit a change event
            }
        }
    });

    module.exports = ColorInput;
});
