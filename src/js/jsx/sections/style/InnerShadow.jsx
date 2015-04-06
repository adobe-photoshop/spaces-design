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


define(function (require, exports) {
    "use strict";

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        Immutable = require("immutable"),
        _ = require("lodash");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * InnerShadow Component displays information of a single innerShadow for a given layer or 
     * set of layers.
     */
    var InnerShadow = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            var sameLayerIDs = collection.pluck(this.props.layers, "id")
                .equals(collection.pluck(nextProps.layers, "id"));

            return !sameLayerIDs ||
                !Immutable.is(this.props.innerShadows, nextProps.innerShadows) ||
                this.props.index !== nextProps.index ||
                this.props.readOnly !== nextProps.readOnly;
        },

        /**
         * Handle the change of the Drop Shadow color, including the alpha value
         *
         * @private
         * @param {Color} color new drop shadow color
         * @param {boolean} coalesce
         */
        _colorChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setInnerShadowColorDebounced(this.props.document, this.props.layers,
                    this.props.index, color, coalesce, false);
        },

        /**
         * Handle the change of the opaque Drop Shadow color
         *
         * @private
         * @param {Color} color new drop shadow opaque color
         * @param {boolean} coalesce
         */
        _opaqueColorChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setInnerShadowColorDebounced(this.props.document, this.props.layers,
                    this.props.index, color, coalesce, true);
        },

        /**
         * Handle the change of the Drop Shadow alpha
         *
         * @private
         * @param {Color} color new drop shadow color
         * @param {boolean} coalesce
         */
        _alphaChanged: function (color, coalesce) {
            this.getFlux().actions.layerEffects
                .setInnerShadowAlphaDebounced(this.props.document, this.props.layers,
                    this.props.index, color.a, coalesce);
        },

        /**
         * Handle the change of the Drop Shadow x coordinate
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {x} x new drop shadow x coordinate
         */
        _xChanged: function (event, x) {
            this.getFlux().actions.layerEffects
                .setInnerShadowXDebounced(this.props.document, this.props.layers, this.props.index, x);
        },

        /**
         * Handle the change of the Drop Shadow y coordinate
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {y} y new drop shadow y coordinate
         */
        _yChanged: function (event, y) {
            this.getFlux().actions.layerEffects
                .setInnerShadowYDebounced(this.props.document, this.props.layers, this.props.index, y);
        },

        /**
         * Handle the change of the Drop Shadow blur value in pixels
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {blur} blur new drop shadow blur value in pixels
         */
        _blurChanged: function (event, blur) {
            this.getFlux().actions.layerEffects
                .setInnerShadowBlurDebounced(this.props.document, this.props.layers, this.props.index, blur);
        },

        /**
         * Handle the change of the Drop Shadow spread value in pixels
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {spread} spread new drop shadow spread value in pixels
         */
        _spreadChanged: function (event, spread) {
            this.getFlux().actions.layerEffects
                .setInnerShadowSpreadDebounced(this.props.document, this.props.layers, this.props.index, spread );
        },

        /**
         * Handle the change of the Drop Shadow enabled state
         *
         * @param {SyntheticEvent} event
         * @param {boolean} enabled new enabled state
         */
        _enabledChanged: function (event, enabled) {
            this.getFlux().actions.layerEffects.setInnerShadowEnabled(
                this.props.document, this.props.layers, this.props.index, enabled);
        },

        /**
         * Produce a set of arrays of separate innerShadow display properties, 
         * transformed and ready for the sub-components
         *
         * @private
         * @param {Array.<InnerShadow>} innerShadows
         * @return {object}
         */
        _downsampleInnerShadows: function (innerShadows) {
            return {
                colors: collection.pluck(innerShadows, "color"),
                enabledFlags: collection.pluck(innerShadows, "enabled"),
                xPositions: collection.pluck(innerShadows, "x"),
                yPositions: collection.pluck(innerShadows, "y"),
                blurs: collection.pluck(innerShadows, "blur"),
                spreads: collection.pluck(innerShadows, "spread")
            };
        },

        render: function () {
            var downsample = this._downsampleInnerShadows(this.props.innerShadows);

            var innerShadowClasses = React.addons.classSet({
                "inner-shadow-list__inner-shadow": true,
                "inner-shadow-list__inner-shadow__disabled": this.props.readOnly
            });

            var innerShadowOverlay = function (colorTiny) {
                var innerShadowStyle = {
                };
                if (colorTiny) {
                    innerShadowStyle.WebkitBoxShadow = collection.uniformValue(downsample.xPositions, 5) + "px " +
                        collection.uniformValue(downsample.yPositions, 5) + "px " +
                        collection.uniformValue(downsample.blurs, 0) + "px " +
                        collection.uniformValue(downsample.spreads, 0) + "px " +
                        colorTiny.toRgbString();
                }

                return (
                    <div
                        className="inner-shadow__preview">
                        <div
                            className="inner-shadow__square"
                            style={innerShadowStyle}/>
                    </div>
                    );
            };

            return (
                <div className={innerShadowClasses}>
                    <div className="formline">
                        <Gutter />
                        <ColorInput
                            id={"inner-shadow-" + this.props.index}
                            className={"inner-shadow"}
                            context={collection.pluck(this.props.layers, "id")}
                            title={strings.TOOLTIPS.SET_INNER_SHADOW_COLOR}
                            editable={!this.props.readOnly}
                            defaultValue={downsample.colors}
                            onChange={this._colorChanged}
                            onFocus={this.props.onFocus}
                            onColorChange={this._opaqueColorChanged}
                            onAlphaChange={this._alphaChanged}
                            swatchOverlay={innerShadowOverlay}>

                            <div className="compact-stats__body">
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_INNER_SHADOW_X_POSITION}
                                        size="column-1">
                                        {strings.STYLE.INNER_SHADOW.X_POSITION}
                                    </Label>
                                    <NumberInput
                                        value={downsample.xPositions}
                                        onChange={this._xChanged}
                                        onFocus={this.props.onFocus}
                                        disabled={this.props.readOnly}
                                        size="column-3" />
                                </div>
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_INNER_SHADOW_Y_POSITION}
                                        size="column-1">
                                        {strings.STYLE.INNER_SHADOW.Y_POSITION}
                                    </Label>
                                    <NumberInput
                                        value={downsample.yPositions}
                                        onChange={this._yChanged}
                                        onFocus={this.props.onFocus}
                                        disabled={this.props.readOnly}
                                        size="column-3" />
                                </div>
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_INNER_SHADOW_BLUR}
                                        size="column-2">
                                        {strings.STYLE.INNER_SHADOW.BLUR}
                                    </Label>
                                    <NumberInput
                                        value={downsample.blurs}
                                        onChange={this._blurChanged}
                                        onFocus={this.props.onFocus}
                                        disabled={this.props.readOnly}
                                        size="column-3" />
                                </div>
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_INNER_SHADOW_SPREAD}
                                        size="column-4">
                                        {strings.STYLE.INNER_SHADOW.SPREAD}
                                    </Label>
                                    <NumberInput
                                        value={downsample.spreads}
                                        onChange={this._spreadChanged}
                                        onFocus={this.props.onFocus}
                                        disabled={this.props.readOnly}
                                        size="column-3" />
                                </div>
                            </div>
                        </ColorInput>
                        <Gutter />
                        <ToggleButton
                            title={strings.TOOLTIPS.TOGGLE_INNER_SHADOW}
                            name="toggleInnerShadowEnabled"
                            buttonType="layer-visibility"
                            selected={downsample.enabledFlags}
                            onFocus={this.props.onFocus}
                            onClick={!this.props.readOnly ? this._enabledChanged : _.noop}
                            size="column-2"
                        />
                        <Gutter />
                    </div>
                </div>
            );
        }
    });

    /**
     * InnerShadowList Component maintains a set of innerShadows components for the selected Layer(s)
     */
    var InnerShadowList = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            max: React.PropTypes.number
        },

        /**
         * Handle a NEW Drop Shadow
         *
         * @private
         */
        _addInnerShadow: function (layers) {
            this.getFlux().actions.layerEffects.addInnerShadow(this.props.document, layers);
        },

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected.filter(function (layer) {
                    return !layer.isBackground;
                });

            if (layers.isEmpty()) {
                return null;
            }

            // Group into arrays of innerShadows, by position in each layer
            var innerShadowGroups = collection.zip(collection.pluck(layers, "innerShadows")),
                innerShadowList = innerShadowGroups.map(function (innerShadows, index) {
                    return (
                        <InnerShadow {...this.props}
                            layers={layers}
                            key={index}
                            index={index}
                            readOnly={this.props.disabled}
                            innerShadows={innerShadows} />
                    );
                }, this);

            // we may want to gate the add dropshadow button to PS's max amout of drop shadows. 

            return (
                <div className="innerShadow-list__container">
                    <header className="innerShadow-list__header sub-header">
                        <h3>
                            {strings.STYLE.INNER_SHADOW.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule"/>
                        <Gutter />
                        <Button 
                            className="button-plus" 
                            disabled={innerShadowList.size >= this.props.max}
                            onClick={this._addInnerShadow.bind(this, layers)}>
                            <SVGIcon 
                                viewbox="0 0 12 12"
                                CSSID="plus" />
                        </Button>
                    </header>
                    <div className="innerShadow-list__list-container">
                        {innerShadowList.toArray()}
                    </div>
                </div>
            );
        }
    });

    exports.InnerShadow = InnerShadow;
    exports.InnerShadowList = InnerShadowList;
});
