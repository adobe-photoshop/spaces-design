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
        _ = require("lodash");
        
    var LayerEffect = require("js/models/effects/layereffect"),
        StrokeEffect = require("js/models/effects/stroke"),
        collection = require("js/util/collection"),
        nls = require("js/util/nls"),
        headlights = require("js/util/headlights");

    var Label = require("js/jsx/shared/Label"),
        NumberInput = require("js/jsx/shared/NumberInput"),
        BlendMode = require("./BlendMode"),
        ColorInput = require("js/jsx/shared/ColorInput"),
        ToggleButton = require("js/jsx/shared/ToggleButton"),
        StrokeAlignment = require("./StrokeAlignment");

    /**
     * Debounced version of headlights.logEvents to help prevent false changes from 
     * datalists from being logged. 
     *
     * @private
     * @type {function(*)}
     */
    var logEventDebounced = _.debounce(headlights.logEvent, 10000);
        
    /**
     * Limits of stroke size.
     *
     * @private
     * @const
     */
    var _MIN_STROKE_SIZE = 1,
        _MAX_STROKE_SIZE = 250;

    var Stroke = React.createClass({
        mixins: [FluxMixin],
        
        shouldComponentUpdate: function (nextProps) {
            var sameLayerIDs = collection.pluck(this.props.layers, "id")
                .equals(collection.pluck(nextProps.layers, "id"));
        
            return !sameLayerIDs ||
                !Immutable.is(this.props.strokes, nextProps.strokes) ||
                this.props.index !== nextProps.index ||
                this.props.readOnly !== nextProps.readOnly;
        },

        /**
         * Handle the change of the effect color, including the alpha value
         *
         * @private
         * @param {Color} color new effect color
         * @param {boolean} coalesce
         */
        _colorChanged: function (color, coalesce) {
            this.getFlux().actions.layereffects
                .setColorThrottled(this.props.document, this.props.layers,
                    LayerEffect.STROKE, this.props.index, color, coalesce, false);
        },

        /**
         * Handle the change of the opaque effect color
         *
         * @private
         * @param {Color} color new effect opaque color
         * @param {boolean} coalesce
         */
        _opaqueColorChanged: function (color, coalesce) {
            this.getFlux().actions.layereffects
                .setColorThrottled(this.props.document, this.props.layers,
                    LayerEffect.STROKE, this.props.index, color, coalesce, true);
        },
        
        /**
         * Handle the change of the effect alpha
         *
         * @private
         * @param {Color} color new effect color
         * @param {boolean} coalesce
         */
        _alphaChanged: function (color, coalesce) {
            this.getFlux().actions.layereffects
                .setAlphaThrottled(this.props.document, this.props.layers,
                    LayerEffect.STROKE, this.props.index, color.a, coalesce);
        },
        
        /**
         * Handle the change of the effect blend mode value
         *
         * @private
         * @param {string} blendMode new blend mode
         */
        _blendModeChanged: function (blendMode) {
            this.getFlux().actions.layereffects
                .setBlendModeThrottled(this.props.document,
                    this.props.layers,
                    this.props.index,
                    blendMode,
                    LayerEffect.STROKE);

            logEventDebounced("edit", "stroke-blendmode-input", blendMode);
        },
        
        /**
         * Handle the change of stroke size.
         *
         * @private
         * @param  {SyntheticEvent} event
         * @param  {number} size
         */
        _sizeChanged: function (event, size) {
            this.getFlux().actions.layereffects
                .setStrokeSizeThrottled(this.props.document,
                    this.props.layers,
                    this.props.index,
                    size);
        },
        
        /**
         * Handle the change of stroke style.
         *
         * @private
         * @param  {string} style
         */
        _styleChanged: function (style) {
            this.getFlux().actions.layereffects
                .setStrokeStyleThrottled(this.props.document,
                    this.props.layers,
                    this.props.index,
                    style);
        },
    
        /**
         * Handle the change of the effect enabled state
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} enabled new enabled state
         */
        _enabledChanged: function (event, enabled) {
            this.getFlux().actions.layereffects.setEffectEnabled(
                this.props.document, this.props.layers, this.props.index, enabled, LayerEffect.STROKE);
        },

        /**
         * Handle the deletion of the effect
         *
         * @private
         */
        _handleDelete: function () {
            this.getFlux().actions.layereffects.deleteEffect(
                this.props.document, this.props.layers, this.props.index, LayerEffect.STROKE);
            headlights.logEvent("effect", "delete", "stroke");
        },

        /**
         * Produce a set of arrays of separate strokes display properties,
         * transformed and ready for the sub-components
         *
         * @private
         * @param {Array.<Stroke>} strokes
         * @return {object}
         */
        _downsampleStrokes: function (strokes) {
            return {
                colors: collection.pluck(strokes, "color"),
                enabledFlags: collection.pluck(strokes, "enabled"),
                blendModes: collection.pluck(strokes, "blendMode"),
                sizes: collection.pluck(strokes, "strokeSize"),
                styles: collection.pluck(strokes, "style")
            };
        },

        render: function () {
            var downsample = this._downsampleStrokes(this.props.strokes),
                strokesClasses = classnames({
                    "effect-list__stroke": true,
                    "effect-list__stroke__disabled": this.props.readOnly
                });
                
            var strokeColorTooltip = nls.localize("strings.TOOLTIPS.SET_STROKE_EFFECT_COLOR"),
                strokeToggleTooltip = nls.localize("strings.TOOLTIPS.TOGGLE_STROKE_EFFECT"),
                strokeDeleteTooltip = nls.localize("strings.TOOLTIPS.DELETE_STROKE_EFFECT"),
                strokeSizeTooltip = nls.localize("strings.TOOLTIPS.SET_STROKE_EFFECT_SIZE"),
                strokeSizeLabel = nls.localize("strings.STYLE.STROKE_EFFECT.SIZE");

            // Dialog IDs
            var blendModelistID = "stroke-blendmodes-" + this.props.index + "-" + this.props.document.id,
                colorInputID = "stroke-" + this.props.index + "-" + this.props.document.id;

            return (
                <div className={strokesClasses}>
                    <div className="formline formline__no-padding formline__space-between">
                        <div className="control-group control-group__vertical">
                            <ColorInput
                                id={colorInputID}
                                context={collection.pluck(this.props.layers, "id")}
                                title={strokeColorTooltip}
                                editable={!this.props.readOnly}
                                defaultValue={downsample.colors}
                                onChange={this._colorChanged}
                                onFocus={this.props.onFocus}
                                onColorChange={this._opaqueColorChanged}
                                onAlphaChange={this._alphaChanged}/>
                        </div>
                        <div className="column-21 control-group__horizontal__left">
                            <BlendMode
                                listID={blendModelistID}
                                modes={downsample.blendModes}
                                handleChange={this._blendModeChanged}
                                disabled={this.props.disabled}
                                size="column-19"
                                onChange={this._blendModeChanged} />
                        </div>
                        <div className="button-toggle-list">
                            <ToggleButton
                                title={strokeToggleTooltip}
                                buttonType="layer-not-visible"
                                selected={downsample.enabledFlags}
                                selectedButtonType={"layer-visible"}
                                onFocus={this.props.onFocus}
                                onClick={!this.props.readOnly && this._enabledChanged}
                                size="column-2" />
                            <ToggleButton
                                title={strokeDeleteTooltip}
                                buttonType="delete"
                                className="delete"
                                selected={true}
                                onFocus={this.props.onFocus}
                                onClick={!this.props.readOnly && this._handleDelete}
                                size="column-2" />
                        </div>
                    </div>
                    <div className="formline formline__no-padding">
                        <Label
                            title={strokeSizeTooltip}
                            size="column-3">
                            {strokeSizeLabel}
                        </Label>
                        <div className="column-6">
                            <NumberInput
                                value={downsample.sizes}
                                onChange={this._sizeChanged}
                                onFocus={this.props.onFocus}
                                disabled={this.props.readOnly}
                                min={_MIN_STROKE_SIZE}
                                max={_MAX_STROKE_SIZE}
                                size="column-3" />
                        </div>
                        <div className="column-16">
                            <StrokeAlignment
                                className="effect-list__stroke__styles"
                                document={this.props.document}
                                layers={this.props.layers}
                                disabled={this.props.readOnly}
                                alignments={downsample.styles}
                                insideValue={StrokeEffect.STYLE_INSIDE}
                                centerValue={StrokeEffect.STYLE_CENTER}
                                outsideValue={StrokeEffect.STYLE_OUTSIDE}
                                onChange={this._styleChanged} />
                        </div>
                    </div>
                </div>
            );
        }
    });

    var StrokeList = React.createClass({
        mixins: [FluxMixin],

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected.filter(function (layer) {
                    return !layer.isBackground;
                });

            if (layers.isEmpty()) {
                return null;
            }
            
            var strokeCountsUnmatch = !layers.every(function (l) {
                    return l.strokeEffects.size === layers.first().strokeEffects.size;
                }),
                strokesContent;
                
            if (!strokeCountsUnmatch) {
                if (layers.first().strokeEffects.size === 0) {
                    return null;
                }
                
                var temp = collection.pluck(layers, "strokeEffects");
                var strokesGroups = collection.zip(temp);
                
                strokesContent = strokesGroups.map(function (strokes, index) {
                    return (
                        <Stroke
                            document={this.props.document}
                            onFocus={this.props.onFocus}
                            layers={layers}
                            key={index}
                            index={index}
                            readOnly={this.props.disabled}
                            strokes={strokes}/>
                    );
                }, this).toList();
            } else {
                strokesContent = (
                    <div className="effect-list__list-container__mixed">
                        <i>{nls.localize("strings.STYLE.STROKE_EFFECT.MIXED")}</i>
                    </div>
                );
            }

            return (
                <div className="effect-list__container">
                    <header className="section-header section-header__no-padding">
                        <h3 className="section-title__subtitle">
                            {nls.localize("strings.STYLE.STROKE_EFFECT.TITLE")}
                        </h3>
                    </header>
                    <div className="effect-list__list-container">
                        {strokesContent}
                    </div>
                </div>
            );
        }
    });

    module.exports = StrokeList;
});
