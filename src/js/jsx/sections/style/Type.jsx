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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Immutable = require("immutable");

    var textLayer = require("adapter").lib.textLayer;

    var Label = require("js/jsx/shared/Label"),
        SVGIcon = require("js/jsx/shared/SVGIcon"),
        NumberInput = require("js/jsx/shared/NumberInput"),
        SplitButton = require("js/jsx/shared/SplitButton"),
        Datalist = require("js/jsx/shared/Datalist"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        nls = require("js/util/nls"),
        Color = require("js/models/color"),
        collection = require("js/util/collection"),
        unit = require("js/util/unit"),
        mathUtil = require("js/util/math");

    /**
     * Minimum and maximum values for font size, leading and tracking.
     *
     * @const
     * @type {number}
     */
    var MIN_FONT_SIZE_PTS = 0.01,
        MAX_FONT_SIZE_PTS = 1296,
        MIN_LEADING_PTS = 0.01,
        MAX_LEADING_PTS = 5000,
        MIN_TRACKING = -1000,
        MAX_TRACKING = 10000;

    var Type = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("font", "tool")],

        shouldComponentUpdate: function (nextProps, nextState) {
            var getProperties = function (document) {
                if (!document) {
                    return null;
                }

                return collection.pluckAll(document.layers.selected, ["text", "opacity", "blendMode"]);
            };

            if (this.state.opaque !== nextState.opaque) {
                return true;
            }

            return !Immutable.is(this.state.postScriptMap, nextState.postScriptMap) ||
                !Immutable.is(this.state.typefaces, nextState.typefaces) ||
                !Immutable.is(this.props.familyName, nextProps.familyName) ||
                !Immutable.is(getProperties(this.props.document), getProperties(nextProps.document));
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                fontStore = flux.store("font"),
                toolStore = flux.store("tool"),
                fontState = fontStore.getState(),
                modalState = toolStore.getModalToolState();

            return {
                initialized: fontState.initialized,
                postScriptMap: fontState.postScriptMap,
                familyMap: fontState.familyMap,
                typefaces: fontState.typefaces,
                // Force opacity while in the type modal tool state
                opaque: modalState
            };
        },

        /**
         * Lazily loads the the font list one time only.
         *
         * @private
         */
        _loadFontListIfNecessary: function () {
            if (!this.refs.type) {
                return;
            }

            if (!this.state.initialized) {
                this.getFlux().actions.type.initFontList();
            }
        },

        componentDidMount: function () {
            this._loadFontListIfNecessary();
        },

        componentDidUpdate: function () {
            this._loadFontListIfNecessary();

            var colorInput = this.refs.color;
            if (!colorInput) {
                return;
            }

            var toolStore = this.getFlux().store("tool");
            if (!toolStore.getModalToolState()) {
                return;
            }

            var document = this.props.document,
                layers = document.layers.selected,
                texts = collection.pluck(layers, "text"),
                characterStyles = collection.pluck(texts, "characterStyle"),
                colors = collection.pluck(characterStyles, "color"),
                color = collection.uniformValue(colors) || Color.DEFAULT;

            colorInput.updateColorPicker(color);
        },

        /**
         * Set the type face of the selected text layers from a font's ID.
         * 
         * @private
         * @type {Datalist~onHighlightedChange}
         */
        _handleTypefaceChange: function (typefaceID) {
            var typefaceIndex = mathUtil.parseNumber(typefaceID), // typefaceID is equivalent to index in typefaces
                typeface = this.state.typefaces.get(typefaceIndex),
                postScriptName = typeface && typeface.postScriptName;

            if (!postScriptName) {
                return;
            }

            this._setPostScript(postScriptName);
        },

        /**
         * Handle change of type weight. 
         *
         * @private
         * @type {Datalist~onHighlightedChange}
         */
        _handleTypeWeightChange: function (postScriptName) {
            this._setPostScript(postScriptName);
        },
        
        /**
         * Set the type face of the selected text layers.
         *
         * @private
         * @param {string} postScriptName
         */
        _setPostScript: function (postScriptName) {
            var document = this.props.document,
                textLayers = this.props.textLayers,
                family = this.props.postScriptFontFamilyFn(postScriptName),
                style = this.props.postScriptFontFamilyFn(postScriptName),
                flux = this.getFlux();

            flux.actions.type.setPostScriptThrottled(document, textLayers, postScriptName, family, style);
        },

        /**
         * Set the size of the selected text layers.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {number} size
         */
        _handleSizeChange: function (event, size) {
            var document = this.props.document,
                flux = this.getFlux();

            flux.actions.type.setSizeThrottled(document, this.props.textLayers, size);
        },

        /**
         * Set the tracking (aka letter-spacing) of the selected text layers.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {number} tracking
         */
        _handleTrackingChange: function (event, tracking) {
            var document = this.props.document,
                flux = this.getFlux(),
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isText;
                });

            flux.actions.type.setTrackingThrottled(document, layers, tracking);
        },

        /**
         * Set the leading (aka line-spacing) of the selected text layers.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {number|string} leading Either "auto" or the leading value in pixels.
         */
        _handleLeadingChange: function (event, leading) {
            var document = this.props.document,
                flux = this.getFlux(),
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isText;
                });

            if (leading === nls.localize("strings.STYLE.TYPE.AUTO_LEADING")) {
                leading = -1;
            }

            flux.actions.type.setLeadingThrottled(document, layers, leading);
        },

        /**
         * Set the paragraph alignment of the selected text layers.
         * 
         * @private
         * @param {string} alignment Either "left", "center", "right", or "justifyAll"
         */
        _handleAlignmentChange: function (alignment) {
            var document = this.props.document,
                flux = this.getFlux(),
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isText;
                });

            flux.actions.type.setAlignmentThrottled(document, layers, alignment);
        },

        render: function () {
            var doc = this.props.document,
                selectedLayers = this.props.selectedLayers;

            if (selectedLayers && selectedLayers.size === 0 || this.props.textLayers.size === 0) {
                return null;
            }

            var typefaceListID = "typefaces-" + this.props.document.id,
                weightListID = "weights-" + this.props.document.id;

            // Convert the given point value to pixels
            var toPixels = function (value) {
                return unit.toPixels({
                    _value: value,
                    _unit: "pointsUnit"
                }, doc.resolution);
            };

            return (
                <div ref="type">
                    <div className="formline">
                        <Datalist
                            className="dialog-type-typefaces"
                            sorted={true}
                            disabled={this.props.disabled}
                            list={typefaceListID}
                            value={this.props.familyName}
                            selected={this.props.selectedTypefaceID}
                            placeholderText={this.props.placeholderText}
                            options={this.state.typefaces}
                            size="column-full"
                            onHighlightedChange={this._handleTypefaceChange}/>
                    </div>
                    <div className="formline formline__space-between">
                        <div className={"control-group control-group__vertical column-5"}>
                            <NumberInput
                                size="column-5"
                                value={this.props.disabled ? null : this.props.sizes}
                                precision={2}
                                min={toPixels(MIN_FONT_SIZE_PTS)}
                                max={toPixels(MAX_FONT_SIZE_PTS)}
                                onChange={this._handleSizeChange}
                                disabled={this.props.disabled} />
                        </div>
                        <div className={"control-group control-group__vertical"}>
                            <Datalist
                                className="dialog-type-weights"
                                sorted={true}
                                title={this.props.styleTitle}
                                list={weightListID}
                                disabled={this.props.disabled || !this.props.styleTitle}
                                value={this.props.styleTitle}
                                selected={this.props.postScriptFamilyName}
                                options={this.props.familyFontOptions}
                                size="column-22"
                                onHighlightedChange={this._handleTypeWeightChange}/>
                        </div>
                    </div>
                    <div className="formline formline__space-between">
                        <div className="control-group column-10 control-group__vertical">
                            <SplitButtonList size="column-10" className="button-radio__fixed">
                                <SplitButtonItem
                                    disabled={this.props.disabled}
                                    iconId="text-left"
                                    className={"split-button__item__fixed"}
                                    selected={this.props.alignment === "left"}
                                    onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.LEFT)}
                                    title={nls.localize("strings.TOOLTIPS.ALIGN_TYPE_LEFT")} />
                                <SplitButtonItem
                                    disabled={this.props.disabled}
                                    iconId="text-center"
                                    className={"split-button__item__fixed"}
                                    selected={this.props.alignment === "center"}
                                    onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.CENTER)}
                                    title={nls.localize("strings.TOOLTIPS.ALIGN_TYPE_CENTER")} />
                                <SplitButtonItem
                                    disabled={this.props.disabled}
                                    iconId="text-right"
                                    className={"split-button__item__fixed"}
                                    selected={this.props.alignment === "right"}
                                    onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.RIGHT)}
                                    title={nls.localize("strings.TOOLTIPS.ALIGN_TYPE_RIGHT")} />
                                <SplitButtonItem
                                    disabled={this.props.disabled || !this.props.box}
                                    iconId="text-justified"
                                    className={"split-button__item__fixed"}
                                    selected={this.props.alignment === "justifyAll"}S
                                    onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.JUSTIFY)}
                                    title={nls.localize("strings.TOOLTIPS.ALIGN_TYPE_JUSTIFIED")} />
                            </SplitButtonList>
                        </div>
                        <div className="control-group">
                            <Label
                                size="column-2"
                                disabled={this.props.disabled}
                                title={nls.localize("strings.TOOLTIPS.SET_LETTER_SPACING")}>
                                <SVGIcon CSSID="text-tracking" />
                            </Label>
                            <NumberInput
                                value={this.props.disabled ? null : this.props.trackings}
                                disabled={this.props.disabled}
                                min={MIN_TRACKING}
                                max={MAX_TRACKING}
                                size="column-5"
                                onChange={this._handleTrackingChange} />
                        </div>
                        <div className=" control-group control-group__vertical">
                            <Label
                                size="column-2"
                                disabled={this.props.disabled}
                                title={nls.localize("strings.TOOLTIPS.SET_LINE_SPACING")}>
                                <SVGIcon CSSID="text-leading" />
                            </Label>
                            <NumberInput
                                value={this.props.disabled ? null : this.props.leadings}
                                precision={2}
                                size="column-5"
                                min={toPixels(MIN_LEADING_PTS)}
                                max={toPixels(MAX_LEADING_PTS)}
                                disabled={this.props.disabled}
                                special={nls.localize("strings.STYLE.TYPE.AUTO_LEADING")}
                                onChange={this._handleLeadingChange} />
                        </div>
                    </div>
                </div>
            );
        }
    });

    module.exports = Type;
});
