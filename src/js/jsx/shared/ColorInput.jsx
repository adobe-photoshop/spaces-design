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
        Immutable = require("immutable"),
        classnames = require("classnames"),
        tinycolor = require("tinycolor"),
        _ = require("lodash");

    var os = require("adapter/os");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        ColorPicker = require("jsx!js/jsx/shared/ColorPicker"),
        Color = require("js/models/color"),
        Coalesce = require("js/jsx/mixin/Coalesce"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection"),
        headlights = require("js/util/headlights");

    /**
     * Keys on which to dismiss the color picker dialog 
     * 
     * @const {Array.<key: {string}, modifiers: {object}>} 
     */
    var DISSMISS_ON_KEYS = [
        { key: os.eventKeyCode.ESCAPE, modifiers: null },
        { key: os.eventKeyCode.ENTER, modifiers: null }
    ];

    var ColorInput = React.createClass({
        mixins: [FluxMixin, Coalesce],
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

        getDefaultProps: function () {
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

        shouldComponentUpdate: function (nextProps) {
            // State currently includes only the input format, and that change alone should not cause a re-render.
            // A change in format should always be followed shortly thereafter by an actual props update from above.
            // Avoiding a re-render prevents a quick flash of the stale color label
            return this.props !== nextProps;
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
                color = Color.fromTinycolor(colorTiny),
                colorFormat;

            if (colorTiny.isValid()) {
                colorFormat = colorTiny.getFormat();

                this.setState({
                    format: colorFormat
                });
            } else {
                colorFormat = "invalid";
            }

            this.updateColorPicker(color, true);
            this.props.onChange(color, false); // do not coalesce this change
            headlights.logEvent("edit", "color-input", colorFormat);
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
            var coalesce = this.shouldCoalesce();
            this.props.onColorChange(color, coalesce);
            if (!coalesce) {
                headlights.logEvent("edit", "color-input", "palette-click");
            }
        },

        /**
         * Fire a change event when the color picker's alpha value changes.
         *
         * @private
         * @param {Color} color
         */
        _handleAlphaChanged: function (color) {
            var coalesce = this.shouldCoalesce();
            this.props.onAlphaChange(color, coalesce);
            if (!coalesce) {
                headlights.logEvent("edit", "color-input", "palette-alpha");
            }
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
                dialog.toggle(event);
            }
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
                    color = value;
                } else {
                    color = Color.DEFAULT;
                }
            }

            // swatch
            swatchClassSet = classnames(swatchClassProps);

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
                        dismissOnKeys={DISSMISS_ON_KEYS}
                        dismissOnDocumentChange
                        dismissOnSelectionTypeChange
                        dismissOnWindowClick>
                        <ColorPicker
                            ref="colorpicker"
                            color={color}
                            onMouseDown={this.startCoalescing}
                            onMouseUp={this.stopCoalescing}
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
        },

        /*
         * Force the color picker to update on history state changes.
         *
         * @private
         */
        _handleHistoryStateChange: function () {
            var dialog = this.refs.dialog;
            if (dialog.isOpen()) {
                var color = this.refs.colorpicker.props.color;
                this.updateColorPicker(color, true); // don't emit a change event
            }
        },

        componentWillMount: function () {
            // Force color picker to update upon undo/redo.
            // The picker otherwise does not necessarily re-render upon receiving new props.
            // Furthermore, we explicitly listen for changes here instead using the StoreWatchMixin because
            // we care only about this narrow type of history change (the 'current' pointer being moved)
            this.getFlux().store("history")
                .on("timetravel", this._handleHistoryStateChange);
        },

        componentWillUnmount: function () {
            this.getFlux().store("history")
                .off("timetravel", this._handleHistoryStateChange);
        }
    });

    module.exports = ColorInput;
});
