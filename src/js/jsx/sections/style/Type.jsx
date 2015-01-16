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
        synchronization = require("js/util/synchronization"),
        collection = require("js/util/collection"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        textLayer = require("adapter/lib/textLayer");

    var Type = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("font")],

        /**
         * Debounced instance of actions.type.setFace
         * @private
         * @type {function()}
         */
        _setFaceDebounced: null,

        /**
         * Debounced instance of actions.type.setColor
         * @private
         * @type {function()}
         */
        _setColorDebounced: null,

        /**
         * Debounced instance of actions.type.setSize
         * @private
         * @type {function()}
         */
        _setSizeDebounced: null,

        /**
         * Debounced instance of actions.type.setTracking
         * @private
         * @type {function()}
         */
        _setTrackingDebounced: null,

        /**
         * Debounced instance of actions.type.setLeading
         * @private
         * @type {function()}
         */
        _setLeadingDebounced: null,

        /**
         * Debounced instance of actions.type.setAlignment
         * @private
         * @type {function()}
         */
        _setAlignmentDebounced: null,

        shouldComponentUpdate: function (nextProps) {
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

            return !Immutable.is(getTexts(this.props.document), getTexts(nextProps.document)) ||
                !Immutable.is(getOpacities(this.props.document), getOpacities(nextProps.document));
        },

        getStateFromFlux: function () {
            var fontStore = this.getFlux().store("font"),
                fontState = fontStore.getState();
            
            // The list of all selectable type faces
            fontState.typefaces = fontState.postScriptMap
                .entrySeq()
                .sortBy(function (entry) {
                    return entry[0];
                })
                .map(function (entry) {
                    var psName = entry[0],
                        fontObj = entry[1];
                    // FIXME: The style attribute is disabled below for performance reasons.
                    return {
                        id: psName,
                        title: fontObj.font,
                        style: {
                            // "font-family": fontObj.family
                        }
                    };
                })
                .toList();                

            return fontState;
        },

        componentWillMount: function () {
            var flux = this.getFlux();

            this._setFaceDebounced = synchronization.debounce(flux.actions.type.setFace);
            this._setColorDebounced = synchronization.debounce(flux.actions.type.setColor);
            this._setSizeDebounced = synchronization.debounce(flux.actions.type.setSize);
            this._setTrackingDebounced = synchronization.debounce(flux.actions.type.setTracking);
            this._setLeadingDebounced = synchronization.debounce(flux.actions.type.setLeading);
            this._setAlignmentDebounced = synchronization.debounce(flux.actions.type.setAlignment);
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
                layers = document.layers.selected,
                family = this._getPostScriptFontFamily(postScriptName),
                style = this._getPostScriptFontStyle(postScriptName);

            this._setFaceDebounced(document, layers, family, style);
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
                layers = document.layers.selected;

            this._setSizeDebounced(document, layers, size);
        },

        /**
         * Set the color of the selected text layers.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {Color} color
         */
        _handleColorChange: function (color) {
            var document = this.props.document,
                layers = document.layers.selected;

            this._setColorDebounced(document, layers, color);
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
                layers = document.layers.selected;

            this._setTrackingDebounced(document, layers, tracking);
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
                layers = document.layers.selected;

            if (leading === strings.STYLE.TYPE.AUTO_LEADING) {
                leading = null;
            }

            this._setLeadingDebounced(document, layers, leading);
        },

        /**
         * Set the paragraph alignment of the selected text layers.
         * 
         * @private
         * @param {string} alignment Either "left", "center", "right", or "justifyAll"
         */
        _handleAlignmentChange: function (alignment) {
            var document = this.props.document,
                layers = document.layers.selected;

            this._setAlignmentDebounced(document, layers, alignment);
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
                if (style.indexOf("italic") > -1){
                    return "italic";
                } else if (style.indexOf("oblique") > -1){
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

            var locked = layers.some(function (layer) {
                return layer.kind !== layer.layerKinds.TEXT ||
                    layer.locked ||
                    (layer.text && layer.text.hasTransform) ||
                    doc.layers.hasLockedAncestor(layer);
            });

            var characterStyles = layers.reduce(function (characterStyles, layer) {
                if (layer.text && layer.text.characterStyles) {
                    // TextStyle colors are always opaque; opacity is ONLY stored
                    // as the layer opacity. However, we want to show an RGBA color
                    // in the UI, so we temporarily clone the text style objects here,
                    // merging the layer opacity and the opaque color into a translucent
                    // color for the view.
                    var opacity = layer.opacity,
                        styles = layer.text.characterStyles.map(function (characterStyle) {
                            return characterStyle.set("color", characterStyle.color.setOpacity(opacity));
                        });

                    characterStyles = characterStyles.concat(styles);
                }
                return characterStyles;
            }, Immutable.List());

            // All type postScriptNames, sizes and colors for all text styles
            // for all selected layers
            var postScriptNames = collection.pluck(characterStyles, "postScriptName"),
                sizes = collection.pluck(characterStyles, "size"),
                colors = collection.pluck(characterStyles, "color"),
                trackings = collection.pluck(characterStyles, "tracking"),
                leadings = characterStyles.map(function (characterStyle) {
                    if (!characterStyle || characterStyle.leading === null) {
                        return strings.STYLE.TYPE.AUTO_LEADING;
                    } else {
                        return characterStyle.leading;
                    }
                });

            var texts = collection.pluck(layers, "text"),
                paragraphStyles = collection.pluck(texts, "paragraphStyles").flatten(true),
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

            return (
                <div className="type sub-section">
                    <header className="sub-header">
                        <h3>
                            {strings.STYLE.TYPE.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule"/>
                        <Gutter />
                        <div className="button-cluster">
                            <button
                                className="button-glyphs"
                                ref="glyphs"
                                title={strings.TOOLTIPS.SHOW_GLYPHS}>
                            æ
                            </button>
                            <Gutter
                                size="column-half" />
                            <button
                                className="button-settings"
                                title={strings.TOOLTIPS.TYPE_SETTINGS} />
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
                            list="typefaces"
                            disabled={locked}
                            value={familyName || strings.STYLE.TYPE.MISSING}
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
                            list="weights"
                            disabled={!styleTitle || locked}
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
                            id="type"
                            context={collection.pluck(this.props.document.layers.selected, "id")}
                            title={strings.TOOLTIPS.SET_TYPE_COLOR}
                            editable={!locked}
                            defaultValue={colors}
                            onChange={this._handleColorChange}
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
                                id="text-left"
                                selected={alignment === "left"}
                                disabled={locked}
                                onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.LEFT)}
                                title={strings.TOOLTIPS.ALIGN_TYPE_LEFT} />
                            <SplitButtonItem
                                id="text-center"
                                selected={alignment === "center"}
                                disabled={locked}
                                onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.CENTER)}
                                title={strings.TOOLTIPS.ALIGN_TYPE_CENTER} />
                            <SplitButtonItem
                                id="text-right"
                                selected={alignment === "right"}
                                disabled={locked}
                                onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.RIGHT)}
                                title={strings.TOOLTIPS.ALIGN_TYPE_RIGHT} />
                            <SplitButtonItem
                                id="text-justified"
                                selected={alignment === "justifyAll"}
                                disabled={locked || !box}
                                onClick={this._handleAlignmentChange.bind(this, textLayer.alignmentTypes.JUSTIFY)}
                                title={strings.TOOLTIPS.ALIGN_TYPE_JUSTIFIED} />
                        </SplitButtonList>
                        <Gutter />
                    </div>
                </div>
            );
        },
    });

    module.exports = Type;
});
