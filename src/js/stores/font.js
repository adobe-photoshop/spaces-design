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
        events = require("../events");

    var FontStore = Fluxxor.createStore({

        /**
         * Map of family names to a map of font names to style-postScriptName records.
         *
         * @private
         * @type {Map.<string, Map.<string, {style: string, postScriptName: string}>>}
         */
        _familyMap: null,

        /**
         * Map of postscript names to font-family name records.
         *
         * @private
         * @type {Map.<string, {family: string, font: string}>}
         */
        _postScriptMap: null,

        initialize: function () {
            this._textStyles = {};

            this.bindActions(
                events.type.INIT_FONTS, this._handleInitFonts
            );
        },

        getState: function () {
            return {
                familyMap: this._familyMap,
                postScriptMap: this._postScriptMap
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

            // HACK: r.js doesn't support for..of
            var fontObjIter = familyMap.values(),
                nextValue = fontObjIter.next(),
                fontObj;

            while (!nextValue.done) {
                fontObj = nextValue.value;
                if (fontObj.style === style) {
                    return fontObj.postScriptName;
                }
                nextValue = fontObjIter.next();
            }

            return null;
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
            this._familyMap = familyNames.reduce(function (fontFamilies, familyName, index) {
                var fontName = fontNames[index],
                    fontStyleName = fontStyleNames[index],
                    fontPostScriptName = fontPostScriptNames[index],
                    family;

                if (!fontFamilies.has(familyName)) {
                    fontFamilies.set(familyName, new Map());
                }

                family = fontFamilies.get(familyName);
                if (family.has(fontName)) {
                    throw new Error("Duplicate font name:", fontName);
                }

                family.set(fontName, {
                    style: fontStyleName,
                    postScriptName: fontPostScriptName
                });

                return fontFamilies;
            }, new Map());

            // Maps postScriptNames to families and fonts
            this._postScriptMap = fontPostScriptNames.reduce(function (postScriptMap, postScriptName, index) {
                var familyName = familyNames[index],
                    fontName = fontNames[index];

                postScriptMap.set(postScriptName, {
                    family: familyName,
                    font: fontName
                });

                return postScriptMap;
            }, new Map());

            this.emit("change");
        }
    });

    module.exports = FontStore;
});
