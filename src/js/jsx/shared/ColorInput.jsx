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

    var os = require("adapter").os;

    var Focusable = require("js/jsx/mixin/Focusable"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        ColorPicker = require("jsx!js/jsx/shared/ColorPicker"),
        Color = require("js/models/color"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection");

    /**
     * Keys on which to dismiss the color picker dialog 
     * 
     * @const
     * @type {Array.<key: {string}, modifiers: {object}>} 
     */
    var DISMISS_ON_KEYS = [
        { key: os.eventKeyCode.ESCAPE, modifiers: null },
        { key: os.eventKeyCode.ENTER, modifiers: null },
        { key: os.eventKeyCode.TAB, modifiers: null }
    ];
    
    /**
     * Default callback to return swatch overlay preview.
     *
     * @private
     * @type {func}
     */
    var _DEFAULT_SWATCH_OVERLAY = function (colorTiny) {
        var fillStyle = {
            backgroundColor: colorTiny ? colorTiny.toRgbString() : "transparent"
        };

        return (<div className="fill__preview" style={fillStyle}/>);
    };

    var ColorSwatch = React.createClass({
        mixins: [FluxMixin, Focusable],

        propTypes: {
            onKeyDown: React.PropTypes.func.isRequired,
            onFocus: React.PropTypes.func.isRequired,
            onClick: React.PropTypes.func.isRequired,
            title: React.PropTypes.string.isRequired,
            overlay: React.PropTypes.element
        },

        /**
         * On escape, release focus and blur the swatch.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleKeyDown: function (event) {
            var key = event.key;

            switch (key) {
                case "Escape":
                    this.releaseFocus()
                        .bind(this)
                        .then(function () {
                            React.findDOMNode(this).blur();
                        });
                    break;
            }

            this.props.onKeyDown(event);
        },

        render: function () {
            var swatchBackgroundSet = classnames("color-input__swatch__background", {
                "color-input__disabled": !this.props.editable
            });
            
            return (
                <div
                    tabIndex="0"
                    className={swatchBackgroundSet}
                    onFocus={this.props.onFocus}
                    onKeyDown={this._handleKeyDown}
                    onClick={this.props.onClick}>
                    <div
                        title={this.props.title}
                        className="color-input__swatch__color">
                        <div className="color-input__mixednone"></div>
                        {this.props.overlay}
                    </div>
                </div>
            );
        },

        /**
         * Focus the color swatch
         */
        focus: function () {
            this.acquireFocus()
                .bind(this)
                .then(function () {
                    React.findDOMNode(this).focus();
                });
        }
    });

    var ColorInput = React.createClass({
        mixins: [FluxMixin],
        propTypes: {
            id: React.PropTypes.string.isRequired,
            defaultValue: React.PropTypes.oneOfType([
                    React.PropTypes.instanceOf(Color),
                    React.PropTypes.instanceOf(Immutable.Iterable)
                ]),
            onFocus: React.PropTypes.func,
            onChange: React.PropTypes.func.isRequired,
            onColorChange: React.PropTypes.func.isRequired,
            onAlphaChange: React.PropTypes.func.isRequired,
            editable: React.PropTypes.bool,
            swatchOverlay: React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                defaultColor: Color.DEFAULT,
                onFocus: _.identity
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

        componentDidUpdate: function (prevProps) {
            // Force-update the color picker state when changing contexts
            var dialog = this.refs.dialog;
            if (dialog.isOpen() && !Immutable.is(this.props.context, prevProps.context)) {
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

        /**
         * Force the color picker to update on history state changes.
         *
         * @private
         */
        _handleHistoryStateChange: function () {
            var dialog = this.refs.dialog;
            if (dialog.isOpen()) {
                var info = this._extractColorInfo(),
                    color = info.color;

                this.updateColorPicker(color, true); // don't emit a change event
            }
        },

        /** @ignore */
        _getID: function () {
            return "colorpicker-" + this.props.id;
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

        /**
         * Toggles the color picker dialog
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleSwatchClick: function (event) {
            var target = event.target;
            if (target === window.document.activeElement) {
                return;
            }

            return this._toggleColorPicker(event);
        },

        /**
         * Toggles the color picker dialog on focus
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleSwatchFocus: function (event) {
            var target = event.target;
            if (target === window.document.activeElement) {
                return;
            }

            return this._toggleColorPicker(event);
        },

        /**
         * Handler for various special keys
         * On Enter/Return, pops up the dialog
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleKeyDown: function (event) {
            var key = event.key;

            switch (key) {
                case "Return":
                case "Enter":
                    this._toggleColorPicker(event);
                    break;
            }
        },

        /**
         * On color picker dialog close, we focus on the swatch again
         * so user can continue tabbing, or re-open the dialog with Enter
         *
         * @private
         */
        _handleDialogClose: function () {
            this.refs.swatch.focus();
        },

        /**
         * When dialog is opened, we focus on the color input field
         *
         * @private
         */
        _handleDialogOpen: function () {
            this.refs.colorpicker.focusInput();
        },

        /**
         * Extract color information from the value supplied to the component.
         *
         * @private
         * @return {{value: ?Color, label: string, color: Color, colorTiny: object=}}
         */
        _extractColorInfo: function () {
            var defaultValue = this.props.defaultValue,
                valueArray = !Immutable.Iterable.isIterable(defaultValue) ?
                    Immutable.List.of(defaultValue) : defaultValue,
                value = collection.uniformValue(valueArray),
                mixed = false,
                label,
                color,
                colorTiny;

            // setup text and swatch based on the mixed-ness of the inputs
            if (value) {
                if (typeof value === "string") {
                    label = value;
                    color = Color.DEFAULT;
                } else {
                    if (this.props.opaque) {
                        value = value.opaque();
                    }

                    // naive tinycolor toString
                    colorTiny = tinycolor(value.toJS());
                    color = value;
                    label = colorTiny.toString(this.state.format);
                }
            } else {
                label = nls.localize("strings.TRANSFORM.MIXED");
                mixed = true;

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

            return {
                value: value,
                label: label,
                mixed: mixed,
                color: color,
                colorTiny: colorTiny
            };
        },

        render: function () {
            var colorInfo = this._extractColorInfo(),
                value = colorInfo.value,
                label = colorInfo.label,
                color = colorInfo.color,
                mixed = colorInfo.mixed,
                colorTiny = colorInfo.colorTiny;

            var swatchClassProps = {
                    "color-input": true,
                    "color-input__mixed": mixed
                };

            // setup text and swatch based on the mixed-ness of the inputs
            if (value) {
                if (typeof value === "string") {
                    swatchClassProps["color-input__invalid-color"] = true;
                }
            }

            var swatchClassSet = classnames(swatchClassProps),
                swatchOverlayFunc = this.props.swatchOverlay || _DEFAULT_SWATCH_OVERLAY,
                overlay = swatchOverlayFunc(colorTiny, !this.props.editable),
                dialogClasses = classnames("color-picker", this.props.className);

            return (
                <div className={swatchClassSet}>
                    <ColorSwatch
                        ref="swatch"
                        title={this.props.title}
                        overlay={overlay}
                        editable={this.props.editable}
                        onFocus={this._handleSwatchFocus}
                        onKeyDown={this._handleKeyDown}
                        onClick={this._handleSwatchClick} />
                    <Dialog
                        ref="dialog"
                        id={this._getID()}
                        className={dialogClasses}
                        disabled={!this.props.editable}
                        onOpen={this._handleDialogOpen}
                        onClose={this._handleDialogClose}
                        dismissOnKeys={DISMISS_ON_KEYS}
                        dismissOnDocumentChange
                        dismissOnSelectionTypeChange
                        dismissOnWindowClick>
                        <ColorPicker
                            ref="colorpicker"
                            label={label}
                            editable={this.props.editable}
                            opaque={this.props.opaque}
                            color={color}
                            onChange={this.props.onChange}
                            onAlphaChange={this.props.onAlphaChange}
                            onColorChange={this.props.onColorChange} />
                    </Dialog>
                </div>
            );
        }
    });

    module.exports = ColorInput;
});
