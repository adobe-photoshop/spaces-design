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

    var descriptor = require("adapter").ps.descriptor;

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
     * The operating system-specified decimal separator, for example "." or ",".
     *
     * @private
     * @type {?string}
     */
    var _decimalSeparator = null;

    /**
     * A number formatter for the operating-system specified decimal separator.
     *
     * @private
     * @type {?Intl.NumberFormat}
     */
    var _numberFormat = null;

    /**
     * Initialize the operatin system-specified decimal separator. This must be
     * called before getDecimalSeparator can be used.
     *
     * @see getDecimalSeparator
     * @return {Promise}
     */
    var initLocaleInfo = function () {
        return descriptor.getProperty("application", "localeInfo")
            .bind(this)
            .tap(function (localeInfo) {
                _decimalSeparator = localeInfo.decimalPoint || ".";

                var formatLocale;
                if (_decimalSeparator === ".") {
                    formatLocale = "en";
                } else {
                    formatLocale = "fr";
                }
                
                _numberFormat = new Intl.NumberFormat(formatLocale, {
                    useGrouping: false
                });
            });
    };

    /**
     * The operating system-specified decimal separator, for example "." or ",".
     * This must only be called after initDecimalSeparator has resolved.
     *
     * @return {string}
     */
    var getDecimalSeparator = function () {
        return _decimalSeparator;
    };

    /**
     * Format a decimal number as a string using the operating system-specified
     * decimal separator.
     *
     * @param {number} value
     * @return {string}
     */
    var formatDecimal = function (value) {
        return _numberFormat.format(value);
    };

    /**
     * Convert a string decimal expression with operating-system specified decimal
     * separators into one that uses "." instead.
     *
     * @param {string} expr
     * @return {string}
     */
    var normalizeDecimalExpr = function (expr) {
        if (_decimalSeparator === ",") {
            // Replace decimal separator , with . and replace argument separator ; with ,
            expr = expr.replace(new RegExp("\\,|\\;", "g"), function (match) {
                return match === "," ? "." : ",";
            });
        }

        return expr;
    };

    exports.localize = localize;
    exports.initLocaleInfo = initLocaleInfo;
    exports.getDecimalSeparator = getDecimalSeparator;
    exports.formatDecimal = formatDecimal;
    exports.normalizeDecimalExpr = normalizeDecimalExpr;
});
