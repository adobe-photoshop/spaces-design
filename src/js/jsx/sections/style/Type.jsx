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

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        Datalist = require("jsx!js/jsx/shared/Datalist"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection"),
        Color = require("js/models/color"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        textLayer = require("adapter/lib/textLayer");

    var Type = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("font", "tool")],

        shouldComponentUpdate: function (nextProps, nextState) {
            var getTexts = function (document) {
                if (!document) {
                    return null;
                }

                return collection.pluck(document.layers.selected, "text");
            };

            var getOpacities = function (document) {
                if (!document) {
                    return null;
                }

                return collection.pluck(document.layers.selected, "opacity");
            };

            if (!Immutable.is(this.state.postScriptMap, nextState.postScriptMap)) {
                if (nextState.postScriptMap) {
                    // The list of all selectable type faces
                    var typefaces = nextState.postScriptMap
                        .entrySeq()
                        .sortBy(function (entry) {
                            return entry[0];
                        })
                        .map(function (entry) {
                            var psName = entry[0],
                                fontObj = entry[1];

                            return {
                                id: psName,
                                title: fontObj.font
                            };
                        })
                        .toList();

                    this.setState({
                        typefaces: typefaces
                    });
                }

                return true;
            }

            if (this.state.opaque !== nextState.opaque) {
                return true;
            }

            return !Immutable.is(this.state.typefaces, nextState.typefaces) ||
                !Immutable.is(getTexts(this.props.document), getTexts(nextProps.document)) ||
                !Immutable.is(getOpacities(this.props.document), getOpacities(nextProps.document));
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                fontStore = flux.store("font"),
                toolStore = flux.store("tool"),
                fontState = fontStore.getState();

            return {
                initialized: fontState.initialized,
                postScriptMap: fontState.postScriptMap,
                familyMap: fontState.familyMap,
                // Force opacity while in the type modal tool state
                opaque: toolStore.getModalToolState()
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
         * Set the type face of the selected text layers from a font's postscript name.
         * 
         * @private
         * @param {string} postScriptName
         */
        _handleTypefaceChange: function (postScriptName) {
            if (!postScriptName) {
                return;
            }

            var document = this.props.document,
                layers = document.layers.selected.filter(function (layer) {
                    return layer.kind === layer.layerKinds.TEXT;
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
                    return layer.kind === layer.layerKinds.TEXT;
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
                    return layer.kind === layer.layerKinds.TEXT;
                });

            flux.actions.type.setColorThrottled(document, layers, color, coalesce, this.state.opaque);
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
                    return layer.kind === layer.layerKinds.TEXT;
                });

            flux.actions.type.setColorThrottled(document, layers, color, coalesce, true);
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
                    return layer.kind === layer.layerKinds.TEXT;
                });

            if (this.state.opaque) {
                return;
            }

            flux.actions.layers.setOpacityThrottled(document, layers, color.opacity, coalesce);
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
                    return layer.kind === layer.layerKinds.TEXT;
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
                    return layer.kind === layer.layerKinds.TEXT;
                });

            if (leading === strings.STYLE.TYPE.AUTO_LEADING) {
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
                    return layer.kind === layer.layerKinds.TEXT;
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
                layers = doc.layers.selected;
                
            if (layers.isEmpty()) {
                return null;
            }

            var someTypeLayers = layers.some(function (layer) {
                return layer.kind === layer.layerKinds.TEXT;
            });

            if (!someTypeLayers) {
                return null;
            }

            var locked = this.props.disabled;

            var characterStyles = layers.reduce(function (characterStyles, layer) {
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
                        return strings.STYLE.TYPE.AUTO_LEADING;
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

            // Downsampled postScriptNames. NumberInput and ColorInput downsamples
            // the size and color resp. internally.
            var postScriptName = collection.uniformValue(postScriptNames);

            // The typeface family name and style for display in the UI
            var familyName,
                styleTitle;

            if (!postScriptNames.isEmpty()) {
                if (postScriptName) {
                    familyName = this._getPostScriptFontFamily(postScriptName);
                    styleTitle = this._getPostScriptFontStyle(postScriptName);
                } else {
                    familyName = strings.TRANSFORM.MIXED;
                    styleTitle = null;
                }
            } else {
                familyName = null;
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
                var typeStyle = {
                    fontFamily: familyName || "helvetica",
                    fontStyle: this._getCSSFontStyle(styleTitle) || "regular",
                    fontWeight: this._getCSSFontWeight(styleTitle) || 400,
                    fontSize: Math.min(collection.uniformValue(sizes) || 24, 50)
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
            }.bind(this);

            var colorPickerID = "type-" + this.props.document.id,
                typefaceListID = "typefaces-" + this.props.document.id,
                weightListID = "weights-" + this.props.document.id;

            return (
                <div ref="type" className="type sub-section">
                    <header className="sub-header">
                        <h3>
                            {strings.STYLE.TYPE.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule"/>
                        <div className="button-cluster">
                        </div>
                    </header>

                    <div className="formline" >
                        <Label
                            title={strings.TOOLTIPS.SET_TYPEFACE}>
                            {strings.STYLE.TYPE.TYPEFACE}
                        </Label>
                        <Gutter />
                        <Datalist
                            className="dialog-type-typefaces"
                            sorted={true}
                            disabled={this.props.disabled || !this.state.initialized}
                            list={typefaceListID}
                            value={familyName || (this.state.initialized && strings.STYLE.TYPE.MIXED)}
                            defaultSelected={postScriptName}
                            options={this.state.typefaces}
                            onChange={this._handleTypefaceChange}
                            size="column-14"
                        />
                        <Gutter />
                    </div>

                    <div className="formline">
                        <Label
                            title={strings.TOOLTIPS.SET_WEIGHT}>
                            {strings.STYLE.TYPE.WEIGHT}
                        </Label>
                        <Gutter />
                        <Datalist
                            className="dialog-type-weights"
                            sorted={true}
                            title={styleTitle}
                            list={weightListID}
                            disabled={this.props.disabled || !this.state.initialized || !styleTitle}
                            value={styleTitle}
                            defaultSelected={postScriptName}
                            options={familyFontOptions}
                            onChange={this._handleTypefaceChange}
                            size="column-14" />
                        <Gutter />
                    </div>

                    <div className="formline">
                        <Gutter />
                        <ColorInput
                            id={colorPickerID}
                            ref="color"
                            className="type"
                            context={collection.pluck(this.props.document.layers.selected, "id")}
                            title={strings.TOOLTIPS.SET_TYPE_COLOR}
                            editable={!this.props.disabled}
                            defaultValue={colors}
                            opaque={this.state.opaque}
                            onChange={this._handleColorChange}
                            onColorChange={this._handleOpaqueColorChange}
                            onAlphaChange={this._handleAlphaChange}
                            swatchOverlay={typeOverlay}>

                            <div className="compact-stats__body">
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_TYPE_SIZE}
                                        size="column-4">
                                        {strings.STYLE.TYPE.SIZE}
                                    </Label>
                                    <NumberInput
                                        value={sizes}
                                        onChange={this._handleSizeChange}
                                        disabled={locked} />
                                </div>
                                <Gutter />
                                <div className="compact-stats__body__column">
                                    <Label
                                        size="column-4"
                                        title={strings.TOOLTIPS.SET_LETTERSPACING}>
                                        {strings.STYLE.TYPE.LETTER}
                                    </Label>
                                    <NumberInput
                                        value={trackings}
                                        disabled={locked}
                                        onChange={this._handleTrackingChange}
                                        valueType="size" />
                                </div>
                                <Gutter />
                                <div className="compact-stats__body__column">
                                    <Label
                                        size="column-4"
                                        title={strings.TOOLTIPS.SET_LINESPACING}>
                                            {strings.STYLE.TYPE.LINE}
                                    </Label>
                                    <NumberInput
                                        value={leadings}
                                        disabled={locked}
                                        special={strings.STYLE.TYPE.AUTO_LEADING}
                                        onChange={this._handleLeadingChange}
                                        valueType="size" />
                                </div>
                            </div>
                        </ColorInput>
                    </div>
                    <div className="formline">
                        <Label
                            title={strings.TOOLTIPS.SET_TYPE_ALIGNMENT}>
                            {strings.STYLE.TYPE.ALIGN}
                        </Label>
                        <Gutter />
                        <SplitButtonList>
                            <SplitButtonItem
                                disabled={this.props.disabled}
                                iconId="text-left"
                                selected={alignment === "left"}
                                onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.LEFT)}
                                title={strings.TOOLTIPS.ALIGN_TYPE_LEFT} />
                            <SplitButtonItem
                                disabled={this.props.disabled}
                                iconId="text-center"
                                selected={alignment === "center"}
                                onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.CENTER)}
                                title={strings.TOOLTIPS.ALIGN_TYPE_CENTER} />
                            <SplitButtonItem
                                disabled={this.props.disabled}
                                iconId="text-right"
                                selected={alignment === "right"}
                                onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.RIGHT)}
                                title={strings.TOOLTIPS.ALIGN_TYPE_RIGHT} />
                            <SplitButtonItem
                                iconId="text-justified"
                                selected={alignment === "justifyAll"}
                                disabled={this.props.disabled || !box}
                                onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.JUSTIFY)}
                                title={strings.TOOLTIPS.ALIGN_TYPE_JUSTIFIED} />
                        </SplitButtonList>
                        <Gutter />
                    </div>
                </div>
            );
        }
    });

    module.exports = Type;
});
