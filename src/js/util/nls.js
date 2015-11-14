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

    /**
     * All the dictionaries we use for our strings
     *
     * @private
     * @type {Object}
     */
    var _dictionaries = {
        strings: require("i18n!nls/strings"),
        menu: require("i18n!nls/menu"),
        "shortcuts-mac": require("i18n!nls/shortcuts-mac"),
        "shortcuts-win": require("i18n!nls/shortcuts-win")
    };
        
    /**
     * Thin wrapper around i18n so it's centralized
     * which will help us replace it easily later on
     *
     * @param {string} key of the format [file].[dot-separated-key]
     * @return {string|Object} Translated, or fallen-back string, or the sub-tree for the ID
     */
    var localize = function (key) {
        var value = objectUtil.getPath(_dictionaries, key);

        if (!value) {
            throw new Error("Translation not found for: " + key);
        } else {
            return value;
        }
    };

    exports.localize = localize;
});
