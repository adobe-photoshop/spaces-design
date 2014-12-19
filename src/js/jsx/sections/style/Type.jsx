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
        _ = require("lodash");

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
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ColorPicker = require("jsx!js/jsx/shared/ColorPicker"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        colorUtil = require("js/util/color"),
        tinycolor = require("tinycolor");

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

            var family = this._getPostScriptFontFamily(postScriptName),
                style = this._getPostScriptFontStyle(postScriptName);

            this._setFaceDebounced(this.props.document, this.props.layers, family, style);
        },

        /**
         * Set the size of the selected text layers.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {number} size
         */
        _handleSizeChange: function (event, size) {
            this._setSizeDebounced(this.props.document, this.props.layers, size);
        },

        /**
         * Set the color of the selected text layers.
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {string|Color} color
         */
        _handleColorChange: function (event, color) {
            var psColor = tinycolor(color).toRgb();
            this._setColorDebounced(this.props.document, this.props.layers, psColor);
        },

        /**
         * Toggle the color picker dialog on click.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _toggleColorPicker: function (event) {
            this.refs.dialog.toggle(event);
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
            if (style.indexOf("italic") > -1){
                return "italic";
            } else if (style.indexOf("oblique") > -1){
                return "oblique";
            } else {
                return "normal";
            }
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

            return this.state.postScriptMap.get(postScriptName).font;
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

            return this.state.postScriptMap.get(postScriptName).family;
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
                font = family.get(fontName);

            return font.style;
        },

        render: function () {
            if (!this.props.document || this.props.layers.length === 0) {
                return null;
            }

            var someTypeLayers = _.any(this.props.layers, function (layer) {
                return layer.kind === layer.layerKinds.TEXT;
            });

            if (!someTypeLayers) {
                return null;
            }

            var locked = _.any(this.props.layers, function (layer) {
                return layer.kind !== layer.layerKinds.TEXT ||
                    layer.locked ||
                    layer.isAncestorLocked();
            });

            var textStyles = this.props.layers.reduce(function (textStyles, layer) {
                if (layer.textStyles) {
                    // TextStyle colors are always opaque; opacity is ONLY stored
                    // as the layer opacity. However, we want to show an RGBA color
                    // in the UI, so we temporarily clone the text style objects here,
                    // merging the layer opacity and the opaque color into a translucent
                    // color for the view.
                    var opacity = layer.opacity,
                        styles = layer.textStyles.map(function (textStyle) {
                            return {
                                postScriptName: textStyle.postScriptName,
                                size: textStyle.size,
                                color: colorUtil.withAlpha(textStyle.color, opacity)
                            };
                        });

                    textStyles = textStyles.concat(styles);
                }
                return textStyles;
            }, []);

            // All type postScriptNames, sizes and colors for all text styles
            // for all selected layers
            var postScriptNames = _.pluck(textStyles, "postScriptName"),
                sizes = _.pluck(textStyles, "size"),
                colors = _.pluck(textStyles, "color");

            // Downsampled postScriptNames and colors. NumberInput downsamples
            // the size internally.
            var postScriptName = collection.uniformValue(postScriptNames),
                color = collection.uniformValue(colors, _.isEqual);

            // The typeface family name and style for display in the UI
            var familyName,
                styleTitle;

            if (postScriptNames.length > 0) {
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
                familyFontOptions = [];
                familyFonts.forEach(function (familyFontObj) {
                    var style = familyFontObj.style,
                        searchableStyle = style.toLowerCase();

                    familyFontOptions.push({
                        id: familyFontObj.postScriptName,
                        title: style,
                        style: {
                            "fontFamily": familyName,
                            "fontStyle": this._getCSSFontStyle(searchableStyle),
                            "fontWeight": this._getCSSFontWeight(searchableStyle)
                        }
                    });
                }, this);
            }

            // The list of all selectable type faces
            var postScriptMap = this.state.postScriptMap || new Map(),
                typefaces = [];

            postScriptMap.forEach(function (fontObj, psName) {
                // FIXME: The style attribute is disabled below for performance reasons.
                typefaces.push({
                    id: psName,
                    title: fontObj.font,
                    style: {
                        // "font-family": fontObj.family
                    }
                });
            });

            return (
                <div>
                    <header className="sub-header">
                        <h3>
                            {strings.STYLE.TYPE.TITLE}
                        </h3>
                        <div className="button-cluster">
                            <button
                                className="button-lorem-ipsum"
                                ref="lorem"
                                title={strings.TOOLTIPS.SHOW_LOREM_IPSUM}>
                                ℒ
                            </button>
                            <Gutter
                                size="column-half"/>
                            <button
                                className="button-glyphs"
                                ref="glyphs"
                                title={strings.TOOLTIPS.SHOW_GLYPHS}>
                                æ
                            </button>
                            <Gutter
                                size="column-half"/>
                            <button
                                className="button-settings"
                                title={strings.TOOLTIPS.TYPE_SETTINGS}
                                />
                        </div>
                    </header>

                    <ul>
                        <li className="formline" >
                            <Label
                                title={strings.TOOLTIPS.SET_TYPEFACE}>
                                {strings.STYLE.TYPE.TYPEFACE}
                            </Label>
                            <Gutter />
                            <Datalist
                                list="typefaces"
                                disabled={locked}
                                value={familyName}
                                defaultSelected={postScriptName}
                                options={typefaces}
                                onChange={this._handleTypefaceChange}
                            />
                            <Gutter />
                        </li>
                        
                        <li className="formline">
                            <Label
                                title={strings.TOOLTIPS.SET_WEIGHT}>
                                {strings.STYLE.TYPE.WEIGHT}
                            </Label>
                            <Gutter />
                            <Datalist
                                list="weights"
                                disabled={!styleTitle || locked}
                                value={styleTitle}
                                defaultSelected={postScriptName}
                                options={familyFontOptions}
                                onChange={this._handleTypefaceChange}
                            />
                            <Gutter />
                        </li>

                        <li className="formline">
                            <Gutter />
                            <ColorInput
                                title={strings.TOOLTIPS.SET_TYPE_COLOR}
                                editable={locked}
                                defaultColor={colors}
                                onChange={this._handleColorChange}
                                onClick={this._toggleColorPicker}
                            />
                            <Dialog ref="dialog"
                                id="colorpicker-typeface"
                                disabled={locked}
                                dismissOnDocumentChange
                                dismissOnSelectionTypeChange
                                dismissOnWindowClick>
                                <ColorPicker
                                    color={color}
                                    onChange={this._handleColorChange.bind(this, null)} />
                            </Dialog>
                            <Label
                                title={strings.TOOLTIPS.SET_TYPE_SIZE}
                                size="column-3">
                                {strings.STYLE.TYPE.SIZE}
                            </Label>
                            <Gutter />
                            <NumberInput
                                value={sizes}
                                onChange={this._handleSizeChange}
                                disabled={locked} />
                        </li>

                        <li className="formline">
                            <Label
                                title={strings.TOOLTIPS.SET_LETTERSPACING}>
                                {strings.STYLE.TYPE.LETTER}
                            </Label>
                            <Gutter />
                            <TextInput
                                valueType="simple"
                            />
                            <Gutter />
                            <Gutter />
                            <Gutter />
                            <Label
                                title={strings.TOOLTIPS.SET_LINESPACING}
                                size="column-3">
                                {strings.STYLE.TYPE.LINE}
                            </Label>
                            <Gutter />
                            <TextInput
                                valueType="simple"
                            />
                            <Gutter
                                size="column-2"/>
                        </li>

                        <li className="formline">
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
                        </li>
                    </ul>
                </div>
            );
        },
    });

    module.exports = Type;
});
