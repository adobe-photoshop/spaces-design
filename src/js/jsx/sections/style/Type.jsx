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
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        Datalist = require("jsx!js/jsx/shared/Datalist"),
        strings = require("i18n!nls/strings"),
        synchronization = require("js/util/synchronization"),
        collection = require("js/util/collection"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput");

    var Type = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("font")],

        shouldComponentUpdate: function (nextProps) {
            var getTextStyles = function (document) {
                if (!document) {
                    return null;
                }

                return collection.pluck(document.layers.selected, "textStyles");
            };

            var getOpacities = function (document) {
                if (!document) {
                    return null;
                }

                return collection.pluck(document.layers.selected, "opacity");
            };

            return !Immutable.is(getTextStyles(this.props.document), getTextStyles(nextProps.document)) ||
                !Immutable.is(getOpacities(this.props.document), getOpacities(nextProps.document));
        },

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

        getStateFromFlux: function () {
            var fontStore = this.getFlux().store("font");
            
            return fontStore.getState();
        },

        componentWillMount: function () {
            var flux = this.getFlux();

            this._setFaceDebounced = synchronization.debounce(flux.actions.type.setFace);
            this._setColorDebounced = synchronization.debounce(flux.actions.type.setColor);
            this._setSizeDebounced = synchronization.debounce(flux.actions.type.setSize);
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

            var someTypeLayers = layers.some(function (layer) {
                return layer.kind === layer.layerKinds.TEXT;
            });

            if (!someTypeLayers) {
                return null;
            }

            var locked = layers.some(function (layer) {
                return layer.kind !== layer.layerKinds.TEXT ||
                    layer.locked ||
                    doc.layers.hasLockedAncestor(layer);
            });

            var textStyles = layers.reduce(function (textStyles, layer) {
                if (layer.textStyles) {
                    // TextStyle colors are always opaque; opacity is ONLY stored
                    // as the layer opacity. However, we want to show an RGBA color
                    // in the UI, so we temporarily clone the text style objects here,
                    // merging the layer opacity and the opaque color into a translucent
                    // color for the view.
                    var opacity = layer.opacity,
                        styles = layer.textStyles.map(function (textStyle) {
                            return textStyle.set("color", textStyle.color.setOpacity(opacity));
                        });

                    textStyles = textStyles.concat(styles);
                }
                return textStyles;
            }, Immutable.List());

            // All type postScriptNames, sizes and colors for all text styles
            // for all selected layers
            var postScriptNames = collection.pluck(textStyles, "postScriptName"),
                sizes = collection.pluck(textStyles, "size"),
                colors = collection.pluck(textStyles, "color");

            // Downsampled postScriptNames. NumberInput and ColorInput downsamples
            // the size and color resp. internally.
            var postScriptName = collection.uniformValue(postScriptNames);

            // The typeface family name and style for display in the UI
            var familyName,
                styleTitle;

            if (postScriptNames.size > 0) {
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
            var familyFontOptions;
            if (!familyFonts) {
                familyFontOptions = null;
            } else {
                familyFontOptions = familyFonts
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

            // The list of all selectable type faces
            var typefaces = this.state.postScriptMap
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

            var typeOverlay = function (colorTiny) {
                 // I put this here, because the scope of typeOverlay function wasn't allowing access
                // to this._getCSSFontWeight
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
                            title={familyName}
                            list="typefaces"
                            disabled={locked}
                            value={familyName}
                            defaultSelected={postScriptName}
                            options={typefaces}
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
                            editable={!this.props.readOnly}
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
                                    <TextInput
                                        valueType="size" />
                                </div>
                                <Gutter />
                                <div className="compact-stats__body__column">
                                    <Label
                                        size="column-4"
                                        title={strings.TOOLTIPS.SET_LINESPACING}>
                                            {strings.STYLE.TYPE.LINE}
                                    </Label>
                                    <TextInput
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
                                selected={false}
                                disabled={false}
                                onClick={null}
                                title={strings.TOOLTIPS.ALIGN_TYPE_LEFT} />
                            <SplitButtonItem
                                id="text-center"
                                selected={false}
                                disabled={false}
                                onClick={null}
                                title={strings.TOOLTIPS.ALIGN_TYPE_CENTER} />
                            <SplitButtonItem
                                id="text-right"
                                selected={false}
                                disabled={false}
                                onClick={null}
                                title={strings.TOOLTIPS.ALIGN_TYPE_RIGHT} />
                            <SplitButtonItem
                                id="text-justified"
                                selected={false}
                                disabled={false}
                                onClick={null}
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
