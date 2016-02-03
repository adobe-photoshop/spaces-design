/*
 * Copyright (c) 2016 Adobe Systems Incorporated. All rights reserved.
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

    var contentLayerLib = require("adapter").lib.contentLayer;

    var AppearanceProperties = require("./AppearanceProperties"),
        Type = require("./Type"),
        VectorAppearance = require("./VectorAppearance"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection");

    /**
     * Immutable object that summarizes downsampled fills.
     *
     * @constructor
     */
    var FillRecord = Immutable.Record({
        colors: null,
        opacityPercentages: null,
        enabledFlags: null
    });
    
    /**
     * AppearancePanelSections Component renders the three parts of the Apperance Panel: 
     * ApperanceProperties, Type, and VectorAppearance. 
     * 
     */
    var AppearancePanelSections = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("font", "tool")],

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
         * Setup state for the fill and layers for child components
         *
         * @private
         * @param {Object} props
         */
        _setFillState: function (props) {
            // We only care about vector layers.  If at least one exists, then this component should render
            var vectorFills = collection.pluck(props.vectorLayers, "fill"),
                downsample = this._downsampleFills(vectorFills),
                opacities = collection.pluck(props.selectedLayers, "opacity");

            this.setState({
                vectorLayers: props.vectorLayers,
                vectorFill: downsample,
                opacities: opacities
            });
        },

        componentWillMount: function () {
            this._setFillState(this.props);
        },

        componentWillReceiveProps: function (nextProps) {
            this._setFillState(nextProps);
        },

        /**
        * Produce a set of arrays of separate fill display properties, transformed and ready for the sub-components
        *
        * @private
        * @param {Immutable.List.<Fill>} fills
        * @return {object}
        */
        _downsampleFills: function (fills) {
            var colors = fills.map(function (fill) {
                    if (!fill) {
                        return null;
                    }

                    if (fill.type === contentLayerLib.contentTypes.SOLID_COLOR) {
                        return fill.color;
                    } else {
                        return fill.type;
                    }
                }),
                opacityPercentages = collection.pluck(fills, "color")
                    .map(function (color) {
                        return color && color.opacity;
                    }),
                enabledFlags = collection.pluck(fills, "enabled", false);

            return new FillRecord({
                colors: colors,
                opacityPercentages: opacityPercentages,
                enabledFlags: enabledFlags
            });
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

        render: function () {
            var doc = this.props.document,
                selectedLayers = this.props.selectedLayers,
                textLayers = this.props.textLayers,
                vectorLayers = this.props.vectorLayers,
                anyLayerTextWarning = selectedLayers.some(function (layer) {
                    return layer.textWarningLevel > 0;
                }),
                characterStyles,
                postScriptNames,
                postScriptFamilyName,
                // The downsampled font family
                familyFonts,
                // The typeface family name and style for display in the UI
                familyName,
                styleTitle,
                selectedTypeface,
                postScriptStyleName,
                selectedTypefaceID,
                placeholderText,
                familyFontOptions,
                sizes,
                trackings,
                leadings,
                box,
                colors,
                overlay;

            if (selectedLayers.size === 0) {
                return null;
            }

            if (textLayers.size > 0) {
                characterStyles = textLayers.reduce(function (characterStyles, layer) {
                    if (layer.text.characterStyle) {
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

                sizes = collection.pluck(characterStyles, "textSize");
                colors = collection.pluck(characterStyles, "color");
                trackings = collection.pluck(characterStyles, "tracking");
                leadings = characterStyles.map(function (characterStyle) {
                    if (!characterStyle || characterStyle.leading === -1) {
                        return nls.localize("strings.STYLE.TYPE.AUTO_LEADING");
                    } else {
                        return characterStyle.leading;
                    }
                });

                var texts = collection.pluck(selectedLayers, "text"),
                    paragraphStyles = collection.pluck(texts, "paragraphStyle"),
                    alignments = collection.pluck(paragraphStyles, "alignment"),
                    alignment = collection.uniformValue(alignments),
                    boxes = collection.pluck(texts, "box");
                box = collection.uniformValue(boxes);

                postScriptNames = collection.pluck(characterStyles, "postScriptName"),
                postScriptStyleName = collection.uniformValue(postScriptNames, function (a, b) {
                    return this._getPostScriptFontStyle(a) === this._getPostScriptFontStyle(b);
                }.bind(this)),
                postScriptFamilyName = collection.uniformValue(postScriptNames, function (a, b) {
                    return this._getPostScriptFontFamily(a) === this._getPostScriptFontFamily(b);
                }.bind(this));

                if (!postScriptNames.isEmpty() && this.state.initialized) {
                    if (postScriptFamilyName || anyLayerTextWarning) {
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

                familyFonts = this.state.familyMap.get(familyName);

                // Downsampled postScriptFamilyNames and postScriptStyleNames. NumberInput and ColorInput downsamples
                // the size and color resp. internally.
                selectedTypeface = this.state.typefaces.find(function (typeface) {
                    return typeface.postScriptName === postScriptFamilyName;
                });
                selectedTypefaceID = selectedTypeface && selectedTypeface.id;

                // Alternate font styles for the chosen type family
                familyFontOptions = familyFonts && familyFonts
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
            }

            if (textLayers.size > 0 && vectorLayers.size === 0) {
                overlay = function (colorTiny) {
                    var fillStyle = {
                        height: "100%",
                        width: "100%",
                        backgroundColor: colorTiny ? colorTiny.toRgbString() : "transparent"
                    };
                    if (familyName === nls.localize("strings.STYLE.TYPE.MIXED")) {
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
                                className="type-vector-color__preview"
                                style={typeStyle}>
                                Aa
                            </div>
                        );
                    }
                }.bind(this);
            } else {
                overlay = function (colorTiny) {
                    var fillStyle = {
                        height: "100%",
                        width: "100%",
                        backgroundColor: colorTiny ? colorTiny.toRgbString() : "transparent"
                    };
                    return (
                        <div
                            className="type-vector-color__preview"
                            style={fillStyle}/>
                    );
                };

                if (textLayers.size === 0 && vectorLayers.size > 0) {
                    colors = this.state.vectorFill.colors;
                } else {
                    if (characterStyles && !characterStyles.isEmpty()) {
                        var textColors = collection.pluck(characterStyles, "color");
                        var vectorColors = this.state.vectorFill.colors;
                        var temp = textColors.concat(vectorColors);
                        colors = temp;
                    }
                }
            }

            var colorInputClassnames = classnames("formline formline__space-between", {
                "mixed-faces": familyName === nls.localize("strings.STYLE.TYPE.MIXED")
            });

            return (
                <div>
                    <AppearanceProperties
                        document={doc}
                        selectedLayers={selectedLayers}
                        vectorLayers = {vectorLayers}
                        forceDisabledDisplay={textLayers.size > 0}
                        textLayers={textLayers}
                        characterStyles={characterStyles}
                        familyName={familyName}
                        defaultValue={colors}
                        opaque={this.state.opaque}
                        className={colorInputClassnames}
                        fill={this.state.vectorFill}
                        uniformLayerKind={this.props.uniformLayerKind}
                        disabled = {this.props.disabled}
                        swatchOverlay={overlay}
                        visible = {this.props.visible} />
                    <Type
                        document={doc}
                        uniformLayerKind={this.props.uniformLayerKind}
                        sizes={sizes}
                        familyFontOptions={familyFontOptions}
                        styleTitle={styleTitle}
                        disabled = {this.props.disabled}
                        leadings={leadings}
                        box={box}
                        postScriptFontFamilyFn={this._getPostScriptFontFamily}
                        trackings={trackings}
                        postScriptFamilyName={postScriptFamilyName}
                        placeholderText={placeholderText}
                        alignment={alignment}
                        familyName={familyName}
                        selectedTypefaceID={selectedTypefaceID}
                        textLayers = {textLayers} />
                    <VectorAppearance
                        uniformLayerKind={this.props.uniformLayerKind}
                        textLayers = {textLayers}
                        vectorLayers = {this.props.vectorLayers}
                        document={doc} />
                </div>
                );
        }
    });
    module.exports = AppearancePanelSections;
});
