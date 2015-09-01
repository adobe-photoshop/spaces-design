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
        tinycolor = require("tinycolor"),
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var Color = require("js/models/color"),
        math = require("js/util/math"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        Label = require("jsx!js/jsx/shared/Label"),
        Gutter = require("jsx!js/jsx/shared/Gutter");
    
    var strings = require("i18n!nls/strings");

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
            if (this.props.hasOwnProperty("hue")) {
                // this is an alpha slider
                var bgColor = tinycolor({ h: this.props.hue, s: 1, v: 1 }).toHexString(),
                    bgGradient = "linear-gradient(to right, rgba(1, 1, 1, 0) 0%, " + bgColor + " 100%)";

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
                "color-picker-map": true,
                "color-picker-map__active": this.state.active
            });

            return (
                <div
                    className={this.props.className + " " + classes}
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
        render: function () {
            return (
                <div
                    className="color-picker__colortype">
                    <div
                        className="color-picker__colortype__thumb empty">
                    </div>
                    <Gutter/>
                    <div
                        className="color-picker__colortype__thumb selected">
                    </div>
                    <Gutter/>
                    <Gutter/>
                    <NumberInput
                        ref="left"
                        size="column-11"
                        placeholder="rgba(255,255,255,1)"
                        value="rgba(255,255,255,1)"/>
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
        render: function () {
            return (
                <div className="color-picker__rgbhsb">
                    <div className="formline">
                        <Label>
                            {strings.COLOR_PICKER.RGB_MODEL.R}

                        </Label>
                        <NumberInput
                            size="column-5"
                            placeholder="255" />
                    </div>
                    <div className="formline">
                        <Label>
                            {strings.COLOR_PICKER.RGB_MODEL.G}
                        </Label>
                        <NumberInput
                            size="column-5"
                            placeholder="255" />
                    </div>
                    <div className="formline">
                        <Label>
                            {strings.COLOR_PICKER.RGB_MODEL.B}
                        </Label>
                        <NumberInput
                            size="column-5"
                            placeholder="255" />
                    </div>
                    <div className="formline">
                        <Label>
                            {strings.COLOR_PICKER.HSB_MODEL.H}
                        </Label>
                        <NumberInput
                            size="column-5"
                            placeholder="255" />
                    </div>
                    <div className="formline">
                        <Label>
                            {strings.COLOR_PICKER.HSB_MODEL.S}
                        </Label>
                        <NumberInput
                            size="column-5"
                            placeholder="255" />
                    </div>
                    <div className="formline">
                        <Label>
                            {strings.COLOR_PICKER.HSB_MODEL.B}
                        </Label>
                        <NumberInput
                            size="column-5"
                            placeholder="255" />
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
        mixins: [PureRenderMixin],

        propTypes: {
            color: React.PropTypes.instanceOf(Color),
            onChange: React.PropTypes.func,
            onColorChange: React.PropTypes.func,
            onAlphaChange: React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                color: Color.DEFAULT,
                onChange: _.identity,
                onAlphaChange: _.identity,
                onColorChange: _.identity
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
                        this.props.onAlphaChange(nextRgbaColor);
                    }

                    if (currentRgbaColor.r !== nextRgbaColor.r ||
                        currentRgbaColor.g !== nextRgbaColor.g ||
                        currentRgbaColor.b !== nextRgbaColor.b) {
                        this.props.onColorChange(nextRgbaColor);
                    }

                    this.props.onChange(nextRgbaColor);
                }
            }
        },

        /**
         * Propagate mousedown events.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleMouseDown: function (event) {
            if (this.props.onMouseDown) {
                this.props.onMouseDown(event);
            }
        },

        /**
         * Propagate mouseup events.
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
            var luminosity = this._getLuminosity(),
                hue = this._getBackgroundHue(),
                color = this.state.color;

            var classes = classnames({
                "color-picker-map__dark": luminosity <= 0.5,
                "color-picker-map__light": luminosity > 0.5
            });

            return (
                <div className="color-picker">
                    <ColorType/>
                    <Map
                        x={color.s}
                        y={color.v}
                        max={1}
                        className={classes}
                        backgroundColor={hue}
                        onMouseUp={this._handleMouseUp}
                        onMouseDown={this._handleMouseDown}
                        onChange={this._handleSaturationValueChange} />
                    <ColorFields />
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
                            title={strings.COLOR_PICKER.OPACITY}>
                            {strings.COLOR_PICKER.OPACITY}
                        </Label>
                        <NumberInput
                            size="column-5"
                            placeholder="100" />
                    </div>
                    <div className="color-picker__transparency-slider">
                        <Slider
                            vertical={false}
                            value={color.a}
                            hue={color.h}
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
