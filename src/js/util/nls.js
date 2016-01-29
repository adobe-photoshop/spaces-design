/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

define(function (require, exports) {
    "use strict";

    var objectUtil = require("js/util/object");

    // We resolve this in webpack
    var dictionary = require("nls/dictionary.json");

    /**
     * Thin wrapper around i18n so it's centralized
     * which will help us replace it easily later on
     *
     * Background: Webpack-i18n uses __(key) and only allows strings
     * however, we sometimes require the entire localized subtree
     * So, we build the dictionaries ourselves with fallbacks to English 
     * during compilation
     * 
     *
     * @param {string} key of the format [file].[dot-separated-key]
     * @return {string|Object} Translated, or fallen-back string, or the sub-tree for the ID
     */
    var localize = function (key) {
        var value = objectUtil.getPath(dictionary, key);

        if (!value) {
            throw new Error("Translation not found for: " + key);
        } else {
            return value;
        }
    };

    /**
     * The following tests whether or not decimals are separated by comma in the current locale.
     *
     * @type {boolean}
     */
    var commaDecimalSeparator = Number(0.5).toLocaleString().indexOf(",") > 0;

    exports.localize = localize;
    exports.commaDecimalSeparator = commaDecimalSeparator;
});
