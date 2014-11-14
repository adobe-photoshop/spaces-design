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
    PureRenderMixin = React.addons.PureRenderMixin,
    classSet = React.addons.classSet,
    tinycolor = require("tinycolor"),
    _ = require("lodash");

    var clamp = function (val, min, max) {
        return val < min? min: (val > max? max: val);
    };

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
            document.addEventListener("mousemove", this.handleUpdate);
            document.addEventListener("touchmove", this.handleUpdate);
            document.addEventListener("mouseup", this.stopUpdates);
            document.addEventListener("touchend", this.stopUpdates);
        },

        componentWillUnmount: function () {
            document.removeEventListener("mousemove", this.handleUpdate);
            document.removeEventListener("touchmove", this.handleUpdate);
            document.removeEventListener("mouseup", this.stopUpdates);
            document.removeEventListener("touchend", this.stopUpdates);
        },

        startUpdates: function (e) {
            e.preventDefault();
            var coords = this.getPosition(e);
            this.setState({ active: true });
            this.updatePosition(coords.x, coords.y);
        },

        handleUpdate: function (e) {
            if (this.state.active) {
                e.preventDefault();
                var coords = this.getPosition(e);
                this.updatePosition(coords.x, coords.y);
            }
        },

        stopUpdates: function () {
            if (this.state.active) {
                this.setState({ active: false });
            }
        },

        getPosition: function (e) {
            if (e.touches) {
                e = e.touches[0];
            }

            return {
                x: e.clientX,
                y: e.clientY
            };
        },

        getPercentageValue: function (value) {
            return (value / this.props.max) * 100 + "%";
        },

        getScaledValue: function (value) {
            return clamp(value, 0, 1) * this.props.max;
        }

    };

    var Slider = React.createClass({

        mixins: [DraggableMixin, PureRenderMixin],

        propTypes: {
            vertical: React.PropTypes.bool.isRequired,
            value: React.PropTypes.number.isRequired,
            hue: React.PropTypes.number
        },

        getDefaultProps: function () {
            return {
                value: 0
            };
        },

        updatePosition: function (clientX, clientY) {
            var rect = this.getDOMNode().getBoundingClientRect();

            var value;
            if (this.props.vertical) {
              value = (rect.bottom - clientY) / rect.height;
            } else {
              value = (clientX - rect.left) / rect.width;
            }

            value = this.getScaledValue(value);
            this.props.onChange(value);
        },

        getCss: function () {
            var obj = {};
            var attr = this.props.vertical ? "bottom": "left";
            obj[attr] = this.getPercentageValue(this.props.value);
            return obj;
        },

        render: function () {
            var classes = classSet({
                "color-picker-slider": true,
                "color-picker-slider__vertical": this.props.vertical,
                "color-picker-slider__horizontal": !this.props.vertical
            });

            var overlay;
            if (this.props.hasOwnProperty("hue")) {
                // this is an alpha slider
                var bgColor = tinycolor({h: this.props.hue, s: 1, v: 1, a: this.props.value}).toHexString(),
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
                onMouseDown={this.startUpdates}
                onTouchStart={this.startUpdates}
            >
                <div className="color-picker-slider__track" />
                {overlay}
                <div className="color-picker-slider__pointer" style={this.getCss()} />
            </div>
            );
        }
    });

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

        updatePosition: function (clientX, clientY) {
            var rect = this.getDOMNode().getBoundingClientRect();
            var x = (clientX - rect.left) / rect.width;
            var y = (rect.bottom - clientY) / rect.height;

            x = this.getScaledValue(x);
            y = this.getScaledValue(y);

            this.props.onChange(x, y);
        },

        render: function () {
            var classes = classSet({
                "color-picker-map": true,
                "color-picker-map__active": this.state.active
            });

            return (
                <div
                    className={this.props.className + " " + classes}
                    onMouseDown={this.startUpdates}
                    onTouchStart={this.startUpdates}
                >
                <div className="color-picker-map__background" style={{
                    backgroundColor: this.props.backgroundColor
                }} />
                <div className="color-picker-map__pointer" style={{
                    left: this.getPercentageValue(this.props.x),
                    bottom: this.getPercentageValue(this.props.y)
                }} />
              </div>
            );
        }
    });

    var ColorPicker = React.createClass({

        getDefaultProps: function () {
            return {
                color: "#000000"
            };
        },

        getInitialState: function () {
            return this.getStateFrom(this.props.color);
        },

        componentWillReceiveProps: function (nextProps) {
            var nextColor = nextProps.color,
                currentColor = this.state.color.toHexString();

            if (nextColor.toLowerCase() !== currentColor.toLowerCase()) {
                this.setState(this.getStateFrom(nextColor));
            }
        },

        getStateFrom: function (color) {
            return {
                color: tinycolor(color)
            };
        },

        render: function () {
            var luminosity = this.getLuminosity(),
                hue = this.getBackgroundHue(),
                hsv = this.state.color.toHsv();

            var classes = classSet({
                "color-picker-map__dark": luminosity <= 0.5,
                "color-picker-map__light": luminosity > 0.5
            });

            return (
                <div className="color-picker">
                    <div className="color-picker__hue-slider">
                        <Slider
                            vertical={false}
                            value={hsv.h}
                            max={360}
                            onChange={this.handleHueChange}
                        />
                    </div>
                    <div className="color-picker__transparency-slider">
                        <Slider
                            vertical={false}
                            value={hsv.a}
                            hue={hsv.h}
                            max={1}
                            onChange={this.handleTransparencyChange}
                        />
                    </div>
                    <Map
                        x={hsv.s}
                        y={hsv.v}
                        max={1}
                        className={classes}
                        backgroundColor={hue}
                        onChange={this.handleSaturationValueChange}
                    />
                </div>
            );
        },

        getLuminosity: function () {
            var hsl = this.state.color.toHsl();
            return tinycolor(hsl).greyscale().getBrightness() / 255;
        },

        getBackgroundHue: function () {
            var hsv = this.state.color.toHsv();
            return tinycolor({h: hsv.h, s: 100, v: 100}).toHexString();
        },

        handleTransparencyChange: function (alpha) {
            var hsv = this.state.color.toHsv();
            this.update({
                h: hsv.h,
                s: hsv.s,
                v: hsv.v,
                a: alpha
            });
        },

        handleHueChange: function (hue) {
            var hsv = this.state.color.toHsv();
            this.update({
                h: hue,
                s: hsv.s,
                v: hsv.v,
                a: hsv.a
            });
        },

        handleSaturationValueChange: function (saturation, value) {
            var hsv = this.state.color.toHsv();
            this.update({
                h: hsv.h,
                s: saturation,
                v: value,
                a: hsv.a
            });
        },

        update: function (hsv) {
            var color = tinycolor(hsv);
            this.props.onChange(color.toRgbString());
            this.setState({ color: color });
        }

    });

    module.exports = ColorPicker;
});
