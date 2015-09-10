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

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable");
    
    var events = require("../events"),
        log = require("js/util/log");

    var FontStore = Fluxxor.createStore({

        /**
         * Whether or not the font list has been initialized.
         *
         * @private
         * @type {boolean}
         */
        _initialized: false,

        /**
         * Map of family names to a map of font names to style-postScriptName records.
         *
         * @private
         * @type {Immutable.Map.<string, Map.<string, {style: string, postScriptName: string}>>}
         */
        _familyMap: Immutable.Map(),

        /**
         * Map of postscript names to font-family name records.
         *
         * @private
         * @type {Immutable.Map.<string, {family: string, font: string}>}
         */
        _postScriptMap: Immutable.Map(),

        /**
         * List of typefaces for populating datalists
         *
         * @type {Immutable.List.<{id: string, font: string}>}
         */
        _typefaces: Immutable.List(),

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.font.INIT_FONTS, this._handleInitFonts
            );
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._initialized = false;
            this._familyMap = Immutable.Map();
            this._postScriptMap = Immutable.Map();
        },

        /**
         * The familyMap maps family names to maps from font names to style/postscript-name pairs.
         * The postScriptMap maps postscript names to family/font-name pairs.
         *
         * @return {{initialized: boolean, familyMap: Immutable.Map, postScriptMap: Immutable.Map}}
         */
        getState: function () {
            return {
                initialized: this._initialized,
                familyMap: this._familyMap,
                postScriptMap: this._postScriptMap,
                typefaces: this._typefaces
            };
        },

        /**
         * Get the postScriptName of a given font family name and style name.
         *
         * @param {string} family
         * @param {string} style
         * @return {?string}
         */
        getPostScriptFromFamilyStyle: function (family, style) {
            var familyMap = this._familyMap.get(family);
            if (!familyMap) {
                return null;
            }

            var fontObj = familyMap.find(function (fontObj) {
                return fontObj.style === style;
            });

            return fontObj && fontObj.postScriptName;
        },
        
        /**
         * Get the font-family name of a given postScritName. 
         *
         * @param {string} postScriptName
         * @return {?{family: string, font: string}}
         */
        getFontFamilyFromPostScriptName: function (postScriptName) {
            return this._postScriptMap.get(postScriptName);
        },

        /**
         * Given a layer, builds a type object acceptable by cc libraries
         * and other dependent apps as a renderable character style
         *
         * As we add more properties in Design Space, we should add them to this object here
         *
         * @param {Layer} layer Source layer
         *
         * @return {Object} 
         */
        getTypeObjectFromLayer: function (layer) {
            if (layer.kind !== layer.layerKinds.TEXT) {
                throw new Error("Trying to build a type style from a non-text layer!");
            }

            var obj = {},
                textStyle = layer.text.characterStyle,
                psName = textStyle.postScriptName,
                fontObj = this._postScriptMap.get(psName, null);
                
            // If it's mixed, or there is no fontObj, we skip adding these values to the type object
            // adbeFont, fontFamily, fontStyle, fontWeight
            if (fontObj) {
                var family = fontObj.family,
                    fontRecord = this._familyMap.get(family),
                    psObj = fontRecord.get(fontObj.font, null);

                if (!psObj) {
                    log.warn("The font for layer is not available!");
                } else {
                    obj.adbeFont = {
                        family: fontObj.family,
                        name: fontObj.font,
                        postScriptName: psObj.postScriptName,
                        style: psObj.style
                    };

                    obj.fontFamily = fontObj.family;

                    var style = psObj.style.toLowerCase();
                    if (style.indexOf("italic") !== -1) {
                        obj.fontStyle = "italic";
                    } else if (style.indexOf("oblique") !== -1) {
                        obj.fontStyle = "oblique";
                    }

                    if (style.indexOf("bold") !== -1) {
                        obj.fontWeight = "bold";
                    }

                    if (style.indexOf("light") !== -1 || style.indexOf("thin") !== -1) {
                        obj.fontWeight = "lighter";
                    }
                }
            }

            if (textStyle.textSize) {
                obj.fontSize = {
                    "type": "pt",
                    "value": textStyle.textSize
                };
            }

            if (textStyle.color) {
                var color = textStyle.color;
                obj.color = {
                    mode: "RGB",
                    value: color,
                    type: "process"
                };
            } else {
                obj.color = {
                    mode: "RGB",
                    value: {
                        r: 0,
                        g: 0,
                        b: 0
                    },
                    type: "process"
                };
            }

            if (textStyle.tracking) {
                obj.adbeTracking = textStyle.tracking;
                // Adobe tracking is a value of thousandths of an em so store that value for CSS letter-spacing
                obj.letterSpacing = {
                    type: "em",
                    value: (obj.adbeTracking / 1000.0).toFixed(2)
                };
            }

            if (textStyle.leading >= 0) {
                obj.lineHeight = {
                    type: "pt",
                    value: textStyle.leading
                };
            } else {
                obj.adbeAutoLeading = true;
            }

            return obj;
        },
        
        /**
         * Create lookup tables for the list of installed fonts.
         * 
         * @private
         * @param {{fontFamilyName: Array.<string>, fontName: Array.<string>, fontStyleNames: Array.<string>}} payload
         */
        _handleInitFonts: function (payload) {
            var familyNames = payload.fontFamilyName,
                fontNames = payload.fontName,
                fontStyleNames = payload.fontStyleName,
                fontPostScriptNames = payload.fontPostScriptName;

            // Maps families to constituent fonts and styles
            var FontRec = Immutable.Record({
                style: null,
                postScriptName: null
            });
            this._familyMap = Immutable.fromJS(familyNames.reduce(function (fontFamilies, familyName, index) {
                var fontName = fontNames[index],
                    fontStyleName = fontStyleNames[index],
                    fontPostScriptName = fontPostScriptNames[index],
                    family;

                if (!fontFamilies.hasOwnProperty(familyName)) {
                    fontFamilies[familyName] = {};
                }

                family = fontFamilies[familyName];
                if (!family.hasOwnProperty(fontName)) {
                    family[fontName] = new FontRec({
                        style: fontStyleName,
                        postScriptName: fontPostScriptName
                    });
                } else {
                    log.warn("Skipping duplicate font named %s in family %s with style",
                        fontName, familyName, fontStyleName);
                }

                return fontFamilies;
            }, {}));

            // Maps postScriptNames to families and fonts
            var PostScriptRec = Immutable.Record({
                family: null,
                font: null
            });
            this._postScriptMap = Immutable.Map(fontPostScriptNames.reduce(function (map, postScriptName, index) {
                var familyName = familyNames[index],
                    fontName = fontNames[index];

                return map.set(postScriptName, new PostScriptRec({
                    family: familyName,
                    font: fontName
                }));
            }, new Map()));

            // The list of all selectable type faces
            this._typefaces = this._postScriptMap
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

            this._initialized = true;
            this.emit("change");
        }
    });

    module.exports = FontStore;
});
