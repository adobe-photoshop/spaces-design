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
        Immutable = require("immutable"),
        classnames = require("classnames");

    var textLayer = require("adapter").lib.textLayer;

    var Label = require("js/jsx/shared/Label"),
        SVGIcon = require("js/jsx/shared/SVGIcon"),
        NumberInput = require("js/jsx/shared/NumberInput"),
        SplitButton = require("js/jsx/shared/SplitButton"),
        LayerBlendMode = require("./LayerBlendMode"),
        Opacity = require("./Opacity"),
        Datalist = require("js/jsx/shared/Datalist"),
        ColorInput = require("js/jsx/shared/ColorInput"),
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
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isText;
                }),
                family = this._getPostScriptFontFamily(postScriptName),
                style = this._getPostScriptFontStyle(postScriptName),
                flux = this.getFlux();

            flux.actions.type.setPostScriptThrottled(document, layers, postScriptName, family, style);
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
                flux = this.getFlux(),
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isText;
                });

            flux.actions.type.setSizeThrottled(document, layers, size);
        },

        /**
         * Set the color of the selected text layers.
         * 
         * @private
         * @param {Color} color
         * @param {boolean} coalesce
         */
        _handleColorChange: function (color, coalesce) {
            var document = this.props.document,
                flux = this.getFlux(),
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isText;
                }),
                options = {
                    coalesce: coalesce,
                    ignoreAlpha: this.state.opaque
                };

            flux.actions.type.setColorThrottled(document, layers, color, options);
        },

        /**
         * Set the color of the selected text layers.
         *
         * @private
         * @param {Color} color
         * @param {boolean} coalesce
         */
        _handleOpaqueColorChange: function (color, coalesce) {
            var document = this.props.document,
                flux = this.getFlux(),
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isText;
                }),
                options = {
                    coalesce: coalesce,
                    ignoreAlpha: true
                };

            flux.actions.type.setColorThrottled(document, layers, color, options);
        },

        /**
         * Set the color of the selected text layers.
         *
         * @private
         * @param {Color} color
         * @param {boolean} coalesce
         */
        _handleAlphaChange: function (color, coalesce) {
            var document = this.props.document,
                flux = this.getFlux(),
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isText;
                });

            if (this.state.opaque) {
                return;
            }

            flux.actions.layers.setOpacityThrottled(document, layers, color.opacity, { coalesce: coalesce });
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

        /**
         * Try to find a reasonable CSS font-style value for the given font style
         * name. If all else fails, this just returns "regular".
         * 
         * @private
         * @param {string} style
         * @return {string} CSS font style
         */
        _getCSSFontStyle: function (style) {
            if (style) {
                style = style.toLowerCase();
                if (style.indexOf("italic") > -1) {
                    return "italic";
                } else if (style.indexOf("oblique") > -1) {
                    return "oblique";
                }
            }
            return "normal";
        },

        /**
         * Try to find a reasonable CSS font-weight value for the given font style
         * name. If all else fails, this just returns 400.
         * 
         * @private
         * @param {string} style
         * @return {number} CSS font weight
         */
        _getCSSFontWeight: function (style) {
            if (style) {
                style = style.toLowerCase();
                if (style.indexOf("bold") > -1 || style.indexOf("black") > -1 || style.indexOf("heavy") > -1) {
                    if (style.indexOf("extra") > -1) {
                        return 900;
                    } else if (style.indexOf("semi") > -1 || style.indexOf("demi") > -1) {
                        return 500;
                    } else {
                        return 700;
                    }
                } else if (style.indexOf("light") > -1) {
                    return 200;
                }
            }

            return 400;
        },

        /**
         * Get a human-readable font name for the given postscript font name.
         * E.g., "Helvtica Neue Oblique" from "Helvetica-Neue-Oblique"
         * 
         * @private
         * @param {string} postScriptName
         * @return {?string} Font name
         */
        _getPostScriptFontName: function (postScriptName) {
            if (!postScriptName) {
                return null;
            }

            var fontObj = this.state.postScriptMap.get(postScriptName);
            return fontObj && fontObj.font;
        },

        /**
         * Get a font-family name for the given postscript font name.
         * E.g., "Helvtica Neue" from "Helvetica-Neue-Oblique"
         * 
         * @private
         * @param {string} postScriptName
         * @return {?string} Font family name
         */
        _getPostScriptFontFamily: function (postScriptName) {
            if (!postScriptName) {
                return null;
            }

            var fontObj = this.state.postScriptMap.get(postScriptName);
            return fontObj && fontObj.family;
        },

        /**
         * Get a font style name for the given postscript font name.
         * E.g., "Oblique" from "Helvetica-Neue-Oblique"
         * 
         * @private
         * @param {string} postScriptName
         * @return {?string} Font family name
         */
        _getPostScriptFontStyle: function (postScriptName) {
            if (!postScriptName) {
                return null;
            }

            var familyName = this._getPostScriptFontFamily(postScriptName),
                family = this.state.familyMap.get(familyName),
                fontName = this._getPostScriptFontName(postScriptName),
                font = family && family.get(fontName);

            return font && font.style;
        },

        render: function () {
            var doc = this.props.document,
                layers = doc.layers.selected,
                hasSomeTextLayers = this.props.hasSomeTextLayers;
                
            if (layers.isEmpty() || !hasSomeTextLayers) {
                return null;
            }

            var locked = this.props.disabled || !this.state.initialized || !this.props.uniformLayerKind,
                characterStyles = layers.reduce(function (characterStyles, layer) {
                    if (layer.text && layer.text.characterStyle) {
                        // TextStyle colors are always opaque; opacity is ONLY stored
                        // as the layer opacity. However, we want to show an RGBA color
                        // in the UI, so we temporarily clone the text style objects here,
                        // merging the layer opacity and the opaque color into a translucent
                        // color for the view.
                        var style = layer.text.characterStyle;
                    
                        if (style.color) {
                            style = style.set("color", style.color.setOpacity(layer.opacity));
                        }

                        characterStyles = characterStyles.push(style);
                    }
                    return characterStyles;
                }, Immutable.List());

            if (characterStyles.isEmpty()) {
                return null;
            }

            // All type postScriptNames, sizes and colors for all text styles
            // for all selected layers
            var postScriptNames = collection.pluck(characterStyles, "postScriptName"),
                sizes = collection.pluck(characterStyles, "textSize"),
                colors = collection.pluck(characterStyles, "color"),
                trackings = collection.pluck(characterStyles, "tracking"),
                leadings = characterStyles.map(function (characterStyle) {
                    if (!characterStyle || characterStyle.leading === -1) {
                        return nls.localize("strings.STYLE.TYPE.AUTO_LEADING");
                    } else {
                        return characterStyle.leading;
                    }
                });

            var texts = collection.pluck(layers, "text"),
                paragraphStyles = collection.pluck(texts, "paragraphStyle"),
                alignments = collection.pluck(paragraphStyles, "alignment"),
                alignment = collection.uniformValue(alignments),
                boxes = collection.pluck(texts, "box"),
                box = collection.uniformValue(boxes);

            // Downsampled postScriptFamilyNames and postScriptStyleNames. NumberInput and ColorInput downsamples
            // the size and color resp. internally.
            var postScriptFamilyName = collection.uniformValue(postScriptNames, function (a, b) {
                    return this._getPostScriptFontFamily(a) === this._getPostScriptFontFamily(b);
                }.bind(this)),
                postScriptStyleName = collection.uniformValue(postScriptNames, function (a, b) {
                    return this._getPostScriptFontStyle(a) === this._getPostScriptFontStyle(b);
                }.bind(this)),
                selectedTypeface = this.state.typefaces.find(function (typeface) {
                    return typeface.postScriptName === postScriptFamilyName;
                }),
                selectedTypefaceID = selectedTypeface && selectedTypeface.id;

            // The typeface family name and style for display in the UI
            var familyName,
                styleTitle,
                placeholderText;

            var anylayerTextWarning = layers.some(function (layer) {
                return layer.textWarningLevel > 0;
            });

            if (this.props.uniformLayerKind && !postScriptNames.isEmpty() && this.state.initialized) {
                if (postScriptFamilyName || anylayerTextWarning) {
                    familyName = this._getPostScriptFontFamily(postScriptFamilyName);
                    if (!familyName) {
                        // Font is missing
                        var uniformValue = collection.uniformValue(postScriptNames);
                        if (uniformValue === null) {
                            placeholderText = "[" + nls.localize("strings.STYLE.TYPE.MIXED") + "]";
                        } else {
                            placeholderText = "[" + postScriptFamilyName + "]";
                        }
                    }
                    if (postScriptStyleName) {
                        styleTitle = this._getPostScriptFontStyle(postScriptStyleName);
                    } else {
                        styleTitle = nls.localize("strings.STYLE.TYPE.MIXED_STYLE");
                    }
                } else {
                    familyName = nls.localize("strings.STYLE.TYPE.MIXED");
                    styleTitle = null;
                }
            } else {
                familyName = "";
                styleTitle = null;
            }

            // The downsampled font family
            var familyFonts = this.state.familyMap.get(familyName);

            // Alternate font styles for the chosen type family
            var familyFontOptions = familyFonts && familyFonts
                    .valueSeq()
                    .sortBy(function (familyFontObj) {
                        return familyFontObj.postScriptName;
                    })
                    .map(function (familyFontObj) {
                        var style = familyFontObj.style,
                            searchableStyle = style;

                        return {
                            id: familyFontObj.postScriptName,
                            title: style,
                            style: {
                                "fontFamily": familyName,
                                "fontStyle": this._getCSSFontStyle(searchableStyle),
                                "fontWeight": this._getCSSFontWeight(searchableStyle)
                            }
                        };
                    }, this)
                    .toList();

            var typeOverlay = function (colorTiny) {
                if (familyName === nls.localize("strings.STYLE.TYPE.MIXED")) {
                    var fillStyle = {
                        height: "100%",
                        width: "100%",
                        backgroundColor: colorTiny ? colorTiny.toRgbString() : "transparent"
                    };

                    return (
                        <div
                            className="fill__preview"
                            style={fillStyle}/>
                    );
                } else {
                    var typeStyle = {
                        fontFamily: familyName || "helvetica",
                        fontStyle: this._getCSSFontStyle(styleTitle) || "regular",
                        fontWeight: this._getCSSFontWeight(styleTitle) || 400,
                        fontSize: 24
                    };

                    if (colorTiny) {
                        typeStyle.color = colorTiny.toRgbString();
                    }

                    return (
                        <div
                            className="type__preview"
                            style={typeStyle}>
                            Aa
                        </div>
                    );
                }
            }.bind(this);

            var colorPickerID = "type-" + this.props.document.id,
                typefaceListID = "typefaces-" + this.props.document.id,
                weightListID = "weights-" + this.props.document.id,
                fillClassNames = classnames("formline formline__space-between", {
                    "mixed-faces": familyName === nls.localize("strings.STYLE.TYPE.MIXED")
                }),
                fillBlendFormline;

            // Convert the given point value to pixels
            var toPixels = function (value) {
                return unit.toPixels({
                    _value: value,
                    _unit: "pointsUnit"
                }, doc.resolution);
            };

            if (hasSomeTextLayers && this.props.uniformLayerKind) {
                fillBlendFormline = (
                    <div className={fillClassNames}>
                        <div className="control-group__vertical">
                            <ColorInput
                                id={colorPickerID}
                                ref="color"
                                className="color-picker__type"
                                context={collection.pluck(this.props.document.layers.selected, "id")}
                                title={nls.localize("strings.TOOLTIPS.SET_TYPE_COLOR")}
                                editable={!this.props.disabled}
                                defaultValue={colors}
                                opaque={this.state.opaque}
                                onChange={this._handleColorChange}
                                onColorChange={this._handleOpaqueColorChange}
                                onAlphaChange={this._handleAlphaChange}
                                swatchOverlay={typeOverlay} />
                        </div>
                        <div className="control-group__vertical control-group__no-label">
                            <LayerBlendMode
                                document={this.props.document}
                                containerType={"type"}
                                layers={this.props.document.layers.selected} />
                        </div>
                        <div className="control-group__vertical">
                            <Label
                                size="column-4"
                                className={"label__medium__left-aligned"}
                                title={nls.localize("strings.TOOLTIPS.SET_OPACITY")}>
                                {nls.localize("strings.STYLE.OPACITY")}
                            </Label>
                            <Opacity
                                document={this.props.document}
                                containerType={"type"}
                                layers={this.props.document.layers.selected} />
                        </div>
                        <div className="control-group__vertical control-group__no-label column-2">
                        </div>
                    </div>
                );
            }

            return (
                <div ref="type">
                    {fillBlendFormline}
                    <div className="formline">
                        <Datalist
                            className="dialog-type-typefaces"
                            sorted={true}
                            disabled={locked}
                            list={typefaceListID}
                            value={familyName}
                            selected={selectedTypefaceID}
                            placeholderText={placeholderText}
                            options={this.state.typefaces}
                            size="column-full"
                            onHighlightedChange={this._handleTypefaceChange}/>
                    </div>
                    <div className="formline formline__space-between">
                        <div className={"control-group control-group__vertical column-4"}>
                            <NumberInput
                                value={locked ? null : sizes}
                                precision={2}
                                min={toPixels(MIN_FONT_SIZE_PTS)}
                                max={toPixels(MAX_FONT_SIZE_PTS)}
                                onChange={this._handleSizeChange}
                                disabled={locked} />
                        </div>
                        <div className={"control-group control-group__vertical"}>
                            <Datalist
                                className="dialog-type-weights"
                                sorted={true}
                                title={styleTitle}
                                list={weightListID}
                                disabled={locked || !styleTitle}
                                value={styleTitle}
                                selected={postScriptFamilyName}
                                options={familyFontOptions}
                                size="column-22"
                                onHighlightedChange={this._handleTypeWeightChange}/>
                        </div>
                    </div>
                    <div className="formline formline__space-between">
                        <div className="control-group column-10 control-group__vertical">
                            <SplitButtonList size="column-10" className="button-radio__fixed">
                                <SplitButtonItem
                                    disabled={locked}
                                    iconId="text-left"
                                    className={"split-button__item__fixed"}
                                    selected={alignment === "left"}
                                    onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.LEFT)}
                                    title={nls.localize("strings.TOOLTIPS.ALIGN_TYPE_LEFT")} />
                                <SplitButtonItem
                                    disabled={locked}
                                    iconId="text-center"
                                    className={"split-button__item__fixed"}
                                    selected={alignment === "center"}
                                    onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.CENTER)}
                                    title={nls.localize("strings.TOOLTIPS.ALIGN_TYPE_CENTER")} />
                                <SplitButtonItem
                                    disabled={locked}
                                    iconId="text-right"
                                    className={"split-button__item__fixed"}
                                    selected={alignment === "right"}
                                    onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.RIGHT)}
                                    title={nls.localize("strings.TOOLTIPS.ALIGN_TYPE_RIGHT")} />
                                <SplitButtonItem
                                    disabled={locked || !box}
                                    iconId="text-justified"
                                    className={"split-button__item__fixed"}
                                    selected={alignment === "justifyAll"}
                                    onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.JUSTIFY)}
                                    title={nls.localize("strings.TOOLTIPS.ALIGN_TYPE_JUSTIFIED")} />
                            </SplitButtonList>
                        </div>
                        <div className="control-group">
                            <Label
                                size="column-2"
                                disabled={locked}
                                title={nls.localize("strings.TOOLTIPS.SET_LETTER_SPACING")}>
                                <SVGIcon CSSID="text-tracking" />
                            </Label>
                            <NumberInput
                                value={locked ? null : trackings}
                                disabled={locked}
                                min={MIN_TRACKING}
                                max={MAX_TRACKING}
                                size="column-5"
                                onChange={this._handleTrackingChange} />
                        </div>
                        <div className=" control-group control-group__vertical">
                            <Label
                                size="column-2"
                                disabled={locked}
                                title={nls.localize("strings.TOOLTIPS.SET_LINE_SPACING")}>
                                <SVGIcon CSSID="text-leading" />
                            </Label>
                            <NumberInput
                                value={locked ? null : leadings}
                                precision={2}
                                size="column-5"
                                min={toPixels(MIN_LEADING_PTS)}
                                max={toPixels(MAX_LEADING_PTS)}
                                disabled={locked}
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
