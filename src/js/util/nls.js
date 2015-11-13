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

define(function (require, exports) {
    "use strict";

    var log = require("js/util/log");

    var dictionaries = {
        strings: require("i18n!nls/strings"),
        menus: require("i18n!nls/menu"),
        macShortcuts: require("i18n!nls/shortcuts-mac"),
        winShortcuts: require("i18n!nls/shortcuts-win")
    };
        
    /**
     * Thin wrapper around i18n so it's centralized
     * which will help us replace it easily later on
     *
     * @param {string} key of the format [file].[dot-separated-key]
     *
     * @return {string|Object} Translated, or fallen-back string, or the sub-tree for the ID
     */
    var localize = function (key) {
        var value = dictionaries;

        key.split(".").some(function (part) {
            if (value.hasOwnProperty(part)) {
                value = value[part];
            } else {
                value = null;
                log.warn("Translation not found for: " + key);
                return true;
            }
        });

        return value;
    };

    exports.localize = localize;
});
