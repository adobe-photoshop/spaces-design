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
 *
 * Portions of this code are adapted from react-simple-colorpicker
 * https://github.com/WickyNilliams/react-simple-colorpicker
 * 
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Nick Williams
 * Copyright (c) 2014 George Czabania
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

define(function (require, exports, module) {
    "use strict";

    var React = require("react"),
        PureRenderMixin = React.addons.PureRenderMixin,
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        tinycolor = require("tinycolor"),
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var Color = require("js/models/color"),
        Coalesce = require("js/jsx/mixin/Coalesce"),
        math = require("js/util/math"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        Label = require("jsx!js/jsx/shared/Label"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        headlights = require("js/util/headlights");
    
    var nls = require("js/util/nls");

    /**
     * The list of valid color expression types.
     *
     * @const
     * @type {Array.<string>}
     */
    var COLOR_FORMATS = ["rgb", "hsv", "hsl", "hex", "name"];

    /**
     * Internal HSVA representation of color. Needed to disambiguate slider
     * positions for completely de-saturated colors.
     * 
     * @private
     * @constructor
     */
    var HSVAColor = Immutable.Record({
        h: 0,
        s: 0,
        v: 0,
        a: 1
    });

    /**
     * Preference key for color format in ColorType
     *
     * @const
     * @type {String}
     */
    var COLOR_PICKER_FORMAT = "colorPickerFormat";

    /**
     * Mixin for drag-and-drop functionality. Clients should call _startUpdates
     * on mousedown/touchstart and implement the abstract method _updatePosition.
     */
    var DraggableMixin = {

        propTypes: {
            onChange: React.PropTypes.func,
            max: React.PropTypes.number
        },

        getDefaultProps: function () {
            return {
                onChange: _.identity,
                max: 1
            };
        },

        getInitialState: function () {
            return {
                active: false
            };
        },

        componentDidMount: function () {
            window.document.addEventListener("mousemove", this._handleUpdate);
            window.document.addEventListener("touchmove", this._handleUpdate);
            window.document.addEventListener("mouseup", this._stopUpdates);
            window.document.addEventListener("touchend", this._stopUpdates);
        },

        componentWillUnmount: function () {
            window.document.removeEventListener("mousemove", this._handleUpdate);
            window.document.removeEventListener("touchmove", this._handleUpdate);
            window.document.removeEventListener("mouseup", this._stopUpdates);
            window.document.removeEventListener("touchend", this._stopUpdates);
        },

        /**
         * After dragging has started on the component, it eventually ends with
         * a mouseup and click event. The click event occurs on whatever element
         * the mouse is over at the time of the mouseup event. Often, this is
         * outside the component, which can be incorrectly intepreted as an event
         * that could, e.g., cause the component to be unmounted too early. Hence,
         * once dragging has started, a capture-phase click handler is installed
         * on the window to stop its propagation. The handler is executed exactly
         * once, so it doesn't interfere with window clicks after the drag has
         * ended.
         * 
         * @private
         * @param {MouseEvent} event
         */
        _suppressClick: function (event) {
            event.stopPropagation();

            window.removeEventListener("click", this._suppressClick, true);
        },

        /**
         * Handler for the start-drag operation.
         * 
         * @private
         * @param {SyntheticEvent} e
         */
        _startUpdates: function (e) {
            e.stopPropagation();
            var coords = this._getPosition(e);
            this.setState({ active: true });
            this._updatePosition(coords.x, coords.y);
            window.addEventListener("click", this._suppressClick, true);
        },

        /**
         * Handler for the update-drag operation.
         * 
         * @private
         * @param {SyntheticEvent} e
         */
        _handleUpdate: function (e) {
            if (this.state.active) {
                e.stopPropagation();
                var coords = this._getPosition(e);
                this._updatePosition(coords.x, coords.y);
            }
        },

        /**
         * Handler for the stop-drag operation.
         * 
         * @private
         */
        _stopUpdates: function () {
            if (this.state.active) {
                this.setState({ active: false });
            }
        },

        /**
         * Helper function to extract the position a move or touch event.
         * 
         * @param {SyntheticEvent} e
         * @return {{x: number, y: num}}
         */
        _getPosition: function (e) {
            if (e.touches) {
                e = e.touches[0];
            }

            return {
                x: e.clientX,
                y: e.clientY
            };
        },

        /**
         * Transform the given value into a percentage relative to props.max.
         * 
         * @param {number} value
         * @return {string}
         */
        _getPercentageValue: function (value) {
            return (value / this.props.max) * 100 + "%";
        },

        /**
         * Scale the given value into the range [0,props.max].
         * 
         * @param {number} value
         * @return {number}
         */
        _getScaledValue: function (value) {
            return math.clamp(value, 0, 1) * this.props.max;
        }

    };

    /**
     * Vertical or horizontal slider component.
     * 
     * @constructor
     */
    var Slider = React.createClass({

        mixins: [DraggableMixin, PureRenderMixin],

        propTypes: {
            vertical: React.PropTypes.bool.isRequired,
            value: React.PropTypes.number.isRequired,
            hue: React.PropTypes.number,
            disabled: React.PropTypes.bool
        },

        getDefaultProps: function () {
            return {
                value: 0
            };
        },

        /**
         * Implementation of the Draggable mixin's abstract method for handling
         * position chagnes.
         * 
         * @param {number} clientX
         * @param {number} clientY
         */
        _updatePosition: function (clientX, clientY) {
            var rect = React.findDOMNode(this).getBoundingClientRect();

            var value;
            if (this.props.vertical) {
                value = (rect.bottom - clientY) / rect.height;
            } else {
                value = (clientX - rect.left) / rect.width;
            }

            value = this._getScaledValue(value);
            this.props.onChange(value);
        },

        /**
         * Get the position of the slider pointer in CSS.
         * 
         * @private
         */
        _getSliderPositionCss: function () {
            var obj = {};
            var attr = this.props.vertical ? "bottom" : "left";
            obj[attr] = this._getPercentageValue(this.props.value);
            return obj;
        },

        /**
         * Start updates and propagate mousedown event.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseDown: function (event) {
            if (this.props.onMouseDown) {
                this.props.onMouseDown(event);
            }
            this._startUpdates(event);
        },

        /**
         * Propagate mouseup event.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseUp: function (event) {
            if (this.props.onMouseUp) {
                this.props.onMouseUp(event);
            }
        },

        render: function () {
            var classes = classnames({
                "color-picker-slider": true,
                "color-picker-slider__vertical": this.props.vertical,
                "color-picker-slider__horizontal": !this.props.vertical,
                "color-picker-slider__disabled": this.props.disabled
            });

            var overlay;
            if (this.props.hasOwnProperty("color")) {
                // this is an alpha slider
                var bgColor = tinycolor(this.props.color.toJS()).toHexString(),
                    bgGradient = "linear-gradient(to right, rgba(1, 1, 1, 0) 5%, " + bgColor + " 95%)";

                overlay = (
                    <div className="color-picker-slider__track-overlay" style={{
                        background: bgGradient
                    }} />
                );
            } else {
                overlay = null;
            }

            return (
                <div
                    className={classes}
                    onMouseUp={!this.props.disabled && this._handleMouseUp}
                    onMouseDown={!this.props.disabled && this._handleMouseDown}
                    onTouchStart={!this.props.disabled && this._startUpdates}>
                    <div className="color-picker-slider__track" />
                    {overlay}
                    <div className="color-picker-slider__pointer" style={this._getSliderPositionCss()} />
                </div>
            );
        }
    });

    /**
     * Color map component.
     * 
     * @constructor
     */
    var Map = React.createClass({
        mixins: [DraggableMixin, PureRenderMixin],

        propTypes: {
            x: React.PropTypes.number,
            y: React.PropTypes.number,
            backgroundColor: React.PropTypes.string
        },

        getDefaultProps: function () {
            return {
                x: 0,
                y: 0,
                backgroundColor: "transparent"
            };
        },

        /**
         * Implementation of the Draggable mixin's abstract method for handling
         * position chagnes.
         * 
         * @param {number} clientX
         * @param {number} clientY
         */
        _updatePosition: function (clientX, clientY) {
            var rect = React.findDOMNode(this).getBoundingClientRect();
            var x = (clientX - rect.left) / rect.width;
            var y = (rect.bottom - clientY) / rect.height;

            x = this._getScaledValue(x);
            y = this._getScaledValue(y);

            this.props.onChange(x, y);
        },

        /**
         * Start updates and propagate mousedown event.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseDown: function (event) {
            if (this.props.onMouseDown) {
                this.props.onMouseDown(event);
            }
            this._startUpdates(event);
        },

        /**
         * Propagate mouseup event.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseUp: function (event) {
            if (this.props.onMouseUp) {
                this.props.onMouseUp(event);
            }
        },

        render: function () {
            var classes = classnames({
                "color-picker-map": true
            }, this.props.className);
            
            return (
                <div
                    className={classes}
                    onMouseUp={this._handleMouseUp}
                    onMouseDown={this._handleMouseDown}
                    onTouchStart={this._startUpdates}>
                    <div
                        className="color-picker-map__background"
                        style={{
                            backgroundColor: this.props.backgroundColor
                        }} />
                    <div
                        className="color-picker-map__pointer"
                        style={{
                            left: this._getPercentageValue(this.props.x),
                            bottom: this._getPercentageValue(this.props.y)
                        }} />
                </div>
            );
        }
    });

    /**
    * Placeholder for color type, no-color and color swatch.
    * 
    * @constructor
    */
    var ColorType = React.createClass({
        mixins: [FluxMixin],
        
        getInitialState: function () {
            return {
                format: "rgb"
            };
        },

        componentWillMount: function () {
            var preferences = this.getFlux().store("preferences").getState(),
                formatPref = preferences.get(COLOR_PICKER_FORMAT, "rgb");

            if (formatPref !== this.state.format) {
                this.setState({
                    format: formatPref
                });
            }
        },

        componentWillUnmount: function () {
            this.getFlux().actions.preferences.setPreference(COLOR_PICKER_FORMAT, this.state.format);
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
         * Do nothing beyond stopping event propagation if the color picker is
         * open to prevent the dialog from closing due to a window click.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleInputClicked: function (event) {
            event.stopPropagation();
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

            // Only allow fully opaque colors
            if (this.props.opaque) {
                color = color.opaque();
            }

            if (colorTiny.isValid()) {
                colorFormat = colorTiny.getFormat();

                this.setState({
                    format: colorFormat
                });
            } else {
                colorFormat = "invalid";
            }

            this.props.onChange(color);
            headlights.logEvent("edit", "color-input", colorFormat);
        },

        /**
         * Returns either the next or previous format relative to the supplied format.
         *
         * @param {string} format The current color format
         * @param {boolean} next Whether to go to the next or previous color format.
         * @return {string} The next color format
         */
        _getNextColorFormat: function (format, next) {
            var index = COLOR_FORMATS.indexOf(format),
                increment = next ? 1 : -1;

            if (!next && index === 0) {
                index = COLOR_FORMATS.length;
            }
            index = (index + increment) % COLOR_FORMATS.length;

            return COLOR_FORMATS[index];
        },

        /**
         * Cycle through the various color formats.
         *
         * @param {boolean} next Whether to go to the next or previous color format.
         * @param {SyntheticEvent} event
         */
        _cycleColorFormat: function (next, event) {
            var nextFormat = this._getNextColorFormat(this.state.format, next);

            if (nextFormat === "name") {
                var color = this.props.color && tinycolor(this.props.color.toJS());

                if (!color || !color.toName()) {
                    // Skip "name" if the color doesn't have a name
                    nextFormat = this._getNextColorFormat(nextFormat, next);
                }
            }

            this.setState({
                format: nextFormat
            });

            event.preventDefault();
        },

        /**
         * Special case handler for shift_tab to focus back on opacity input
         *
         * @private
         * @param {KeyboardEvent} event
         */
        _handleKeyDown: function (event) {
            var key = event.key;

            switch (key) {
            case "Tab":
                if (event.shiftKey) {
                    this.props.onShiftTabPress();
                    event.preventDefault();
                }
                break;
            case "ArrowDown":
                this._cycleColorFormat(true, event);
                break;
            case "ArrowUp":
                this._cycleColorFormat(false, event);
                break;
            }
        },

        /**
         * Computes the label string for current color with the active format
         * 
         * If the format is name, but color is not nameable, falls back to 
         * RGB string, otherwise uses the current format
         *
         * @param {Color} color
         * @return {string}
         */
        _computeLabel: function (color) {
            if (this.state.format === "name") {
                if (color.toName()) {
                    return color.toName();
                } else {
                    return color.toRgbString();
                }
            } else {
                return color.toString(this.state.format);
            }
        },

        /**
         * Begin the edit of the TextInput
         */
        focus: function () {
            this.refs.input._beginEdit();
        },

        render: function () {
            var colortiny = this.props.color ? tinycolor(this.props.color.toJS()) : null,
                overlayStyle = {
                    height: "100%",
                    width: "100%",
                    backgroundColor: colortiny ? colortiny.toRgbString() : "transparent"
                },
                label = this._computeLabel(colortiny);

            return (
                <div
                    className="color-picker__colortype">
                    <div
                        className="color-picker__colortype__thumb">
                        <div
                            className="color-picker__colortype__thumb__overlay"
                            style={overlayStyle}
                        />
                    </div>
                    <Gutter/>
                    <Gutter/>
                    <TextInput
                        ref="input"
                        live={this.props.editable}
                        editable={this.props.editable}
                        value={label}
                        singleClick={true}
                        onKeyDown={this._handleKeyDown}
                        onChange={this._handleInputChanged}
                        onFocus={this._handleFocus}
                        onClick={this._handleInputClicked} />
                  </div>
            );
        }
    });

    /**
     * Placeholder color RGB and HSB input values.
     * 
     * @constructor
     */
    var ColorFields = React.createClass({
        propTypes: {
            color: React.PropTypes.instanceOf(HSVAColor),
            onChange: React.PropTypes.func
        },

        /**
         * Handles any of the R,G,B fields changing
         *
         * @private
         * @param {string} prop Field ID
         * @param {SyntheticEvent} event
         * @param {number} value
         */
        _handleRGBChange: function (prop, event, value) {
            var color = this.props.color,
                tiny = tinycolor(color.toJS()),
                rgb = tiny.toRgb();

            rgb[prop] = value;

            this.props.onChange(tinycolor(rgb).toHsv());
        },

        /**
         * Handles any of the H,S,V fields changing
         *
         * @private
         * @param {string} prop Field ID
         * @param {SyntheticEvent} event
         * @param {number} value
         */
        _handleHSVChange: function (prop, event, value) {
            // If the color was in HSV format to begin with, and had saturation 0
            // tinycolor resets the hue to 0, but we don't want to lose the current hue value
            var color = this.props.color,
                tiny = tinycolor(color.toJS()),
                format = tiny.getFormat(),
                hsv = format === "hsv" ? color.toJS() : tiny.toHsv();

            if (prop !== "h") {
                value = value / 100;
            }

            hsv[prop] = value;
            this.props.onChange(hsv);
        },

        render: function () {
            // If the color is already in hsv format, grab current values
            // tinycolor resets 0 saturation hsv colors h to 0 as well.
            var color = this.props.color,
                tiny = tinycolor(color.toJS()),
                format = tiny.getFormat(),
                hsv = format === "hsv" ? color : tiny.toHsv(),
                rgb = tiny.toRgb();

            return (
                <div className="color-picker__rgbhsb">
                    <div className="formline">
                        <Label>
                            {nls.localize("strings.COLOR_PICKER.RGB_MODEL.R")}
                        </Label>
                        <NumberInput
                            disabled={this.props.disabled}
                            value={rgb.r}
                            onChange={this._handleRGBChange.bind(this, "r")}
                            min={0}
                            max={255}
                            size="column-5" />
                    </div>
                    <div className="formline">
                        <Label>
                            {nls.localize("strings.COLOR_PICKER.RGB_MODEL.G")}
                        </Label>
                        <NumberInput
                            disabled={this.props.disabled}
                            value={rgb.g}
                            onChange={this._handleRGBChange.bind(this, "g")}
                            min={0}
                            max={255}
                            size="column-5" />
                    </div>
                    <div className="formline">
                        <Label>
                            {nls.localize("strings.COLOR_PICKER.RGB_MODEL.B")}
                        </Label>
                        <NumberInput
                            disabled={this.props.disabled}
                            value={rgb.b}
                            onChange={this._handleRGBChange.bind(this, "b")}
                            min={0}
                            max={255}
                            size="column-5" />
                    </div>
                    <div className="formline">
                        <Label>
                            {nls.localize("strings.COLOR_PICKER.HSB_MODEL.H")}
                        </Label>
                        <NumberInput
                            disabled={this.props.disabled}
                            value={Math.round(hsv.h)}
                            onChange={this._handleHSVChange.bind(this, "h")}
                            min={0}
                            max={360}
                            size="column-5" />
                    </div>
                    <div className="formline">
                        <Label>
                            {nls.localize("strings.COLOR_PICKER.HSB_MODEL.S")}
                        </Label>
                        <NumberInput
                            disabled={this.props.disabled}
                            value={Math.round(hsv.s * 100)}
                            onChange={this._handleHSVChange.bind(this, "s")}
                            min={0}
                            max={100}
                            size="column-5" />
                    </div>
                    <div className="formline">
                        <Label>
                            {nls.localize("strings.COLOR_PICKER.HSB_MODEL.B")}
                        </Label>
                        <NumberInput
                            disabled={this.props.disabled}
                            value={Math.round(hsv.v * 100)}
                            onChange={this._handleHSVChange.bind(this, "v")}
                            min={0}
                            max={100}
                            size="column-5" />
                    </div>
                  </div>
            );
        }
    });

    /**
     * A color-picker component.
     * 
     * @constructor
     */
    var ColorPicker = React.createClass({
        mixins: [PureRenderMixin, Coalesce],

        propTypes: {
            color: React.PropTypes.instanceOf(Color),
            onChange: React.PropTypes.func.isRequired,
            onColorChange: React.PropTypes.func.isRequired,
            onAlphaChange: React.PropTypes.func.isRequired
        },

        getDefaultProps: function () {
            return {
                color: Color.DEFAULT
            };
        },

        getInitialState: function () {
            return {
                color: this._getHSVA(this.props.color)
            };
        },

        /** @ignore */
        setColor: function (color, quiet) {
            var hsva = this._getHSVA(color);
            this._update(hsva, quiet);
        },

        /**
         * Convert color props to a color state object.
         * 
         * @private
         * @param {object|string} color
         */
        _getHSVA: function (color) {
            return new HSVAColor(tinycolor(color.toJS()).toHsv());
        },

        /**
         * Get the luminosity of the current color.
         * 
         * @private
         * @return {number} The luminosity in [0,1].
         */
        _getLuminosity: function () {
            var brightness = tinycolor(this.state.color.toJS())
                .greyscale()
                .getBrightness();

            return brightness / 255;
        },

        /**
         * Get the hue of the color color, formatted as a hex string.
         * 
         * @return {string}
         */
        _getBackgroundHue: function () {
            var color = this.state.color;

            return tinycolor({ h: color.h, s: 1, v: 1 })
                .toHexString();
        },

        /**
         * Event handler for the transparency slider.
         * 
         * @param {number} alpha
         */
        _handleTransparencyChange: function (alpha) {
            this._update({
                a: alpha
            });
        },

        /**
         * Event handler for the transparency input
         * Converts from percentage to decimal
         *
         * @param {SyntheticEvent} event
         * @param {number} alpha
         */
        _handleTransparencyInput: function (event, alpha) {
            this._handleTransparencyChange(alpha / 100);
        },

        /**
         * Event handler for the hue slider.
         * 
         * @param {number} hue
         */
        _handleHueChange: function (hue) {
            this._update({
                h: hue
            });
        },

        /**
         * Event handler for the color map, which determines the color
         * saturation and color value.
         * 
         * @param {number} saturation
         * @param {number} value
         */
        _handleSaturationValueChange: function (saturation, value) {
            this._update({
                s: saturation,
                v: value
            });
        },

        /**
         * Update the current color from an hsva object.
         * 
         * @param {{h: number, s: number, v: number, a: number}} hsva
         * @param {boolean=} quiet suppress calls to the on-change functions
         */
        _update: function (hsva, quiet) {
            var currentColor = this.state.color,
                nextColor = currentColor.merge(hsva);

            if (!Immutable.is(currentColor, nextColor)) {
                this.setState({ color: nextColor });

                if (!quiet) {
                    var currentRgbaColor = Color.fromTinycolor(tinycolor(currentColor.toJS())),
                        nextRgbaColor = Color.fromTinycolor(tinycolor(nextColor.toJS()));

                    if (currentColor.a !== nextColor.a) {
                        this._changeAlpha(nextRgbaColor);
                    }

                    if (currentRgbaColor.r !== nextRgbaColor.r ||
                        currentRgbaColor.g !== nextRgbaColor.g ||
                        currentRgbaColor.b !== nextRgbaColor.b) {
                        this._changeColor(nextRgbaColor);
                    }
                }
            }
        },

        /**
         * Holding down the mouse starts coalescing
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseDown: function (event) {
            this.startCoalescing(event);
        },

        /**
         * Mouse ups stop coalescing
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseUp: function (event) {
            this.stopCoalescing(event);
        },

        /**
         * Handles changes coming from the ColorType component
         *
         * @private
         * @param {Color} color
         */
        _handleColorTypeChange: function (color) {
            this.setColor(color, true);
            this._changeColor(color);
        },

        /**
         * Calls the onColorChange handler with the correct coalesce flag
         *
         * @private
         * @param {Color} color [description]
         */
        _changeColor: function (color) {
            var coalesce = this.shouldCoalesce();
            this.props.onChange(color, coalesce);
            if (!coalesce) {
                headlights.logEvent("edit", "color-input", "palette-click");
            }
        },

        /**
         * Calls the onAlphaChange handler with the correct coalesce flag
         *
         * @private
         * @param {Color} color [description]
         */
        _changeAlpha: function (color) {
            var coalesce = this.shouldCoalesce();
            this.props.onAlphaChange(color, coalesce);
            if (!coalesce) {
                headlights.logEvent("edit", "color-input", "palette-alpha");
            }
        },

        /**
         * Special case handler for tab key on the Opacity input
         * to transfer the focus back to color input
         *
         * @private
         * @param {KeyboardEvent} event
         */
        _handleKeyDown: function (event) {
            if (!event.shiftKey && event.key === "Tab") {
                this.focusInput();
                event.preventDefault();
            }
        },

        /**
         * Focuses on the opacity input component
         */
        _focusOpacityInput: function () {
            React.findDOMNode(this.refs.opacity).focus();
        },

        /**
         * Focuses on the ColorType component
         */
        focusInput: function () {
            this.refs.input.focus();
        },

        render: function () {
            var luminosity = this._getLuminosity(),
                hue = this._getBackgroundHue(),
                color = this.state.color;

            var classes = classnames({
                "color-picker-map__dark": luminosity <= 0.5,
                "color-picker-map__light": luminosity > 0.5
            });

            return (
                <div>
                    <ColorType {...this.props}
                        ref="input"
                        color={color}
                        onShiftTabPress={this._focusOpacityInput}
                        onChange={this._handleColorTypeChange}/>
                    <Map
                        x={color.s}
                        y={color.v}
                        max={1}
                        className={classes}
                        backgroundColor={hue}
                        onMouseUp={this._handleMouseUp}
                        onMouseDown={this._handleMouseDown}
                        onChange={this._handleSaturationValueChange} />
                    <ColorFields
                        color={color}
                        onChange={this._update} />
                    <div className="color-picker__hue-slider">
                        <Slider
                            vertical={true}
                            value={color.h}
                            max={360}
                            onMouseUp={this._handleMouseUp}
                            onMouseDown={this._handleMouseDown}
                            onChange={this._handleHueChange} />
                    </div>
                    <div className="slider_label">
                        <Label
                            title={nls.localize("strings.COLOR_PICKER.OPACITY")}>
                            {nls.localize("strings.COLOR_PICKER.OPACITY")}
                        </Label>
                        <NumberInput
                            size="column-5"
                            placeholder="100"
                            ref="opacity"
                            min={0}
                            max={100}
                            value={Math.round(color.a * 100)}
                            onKeyDown={this._handleKeyDown}
                            onChange={this._handleTransparencyInput}/>
                    </div>
                    <div className="color-picker__transparency-slider">
                        <Slider
                            vertical={false}
                            value={color.a}
                            color={color}
                            max={1}
                            disabled={this.props.opaque}
                            onMouseUp={this._handleMouseUp}
                            onMouseDown={this._handleMouseDown}
                            onChange={this._handleTransparencyChange} />
                    </div>

                </div>
            );
        }
    });

    module.exports = ColorPicker;
});
