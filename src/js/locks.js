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

    var _ = require("lodash");

    /**
     * The set of available locks, each of which corresponds to a distinct
     * resource.
     * 
     * @const
     * @type {{string: string}}
     */
    var LOCKS = {
        PS_APP: "psApp",
        JS_APP: "jsApp",
        PS_DOC: "psDoc",
        JS_DOC: "jsDoc",
        PS_TOOL: "psTool",
        JS_TOOL: "jsTool",
        PS_MENU: "psMenu",
        JS_MENU: "jsMenu",
        JS_DIALOG: "jsDialog",
        JS_TYPE: "jsType",
        JS_POLICY: "jsPolicy",
        JS_SHORTCUT: "jsShortcut",
        JS_UI: "jsUI",
        JS_PREF: "jsPref",
        JS_HISTORY: "jsHistory",
        JS_STYLE: "jsStyle",
        JS_LIBRARIES: "jsLibraries",
        JS_EXPORT: "jsExport",
        CC_LIBRARIES: "ccLibraries",
        OS_CLIPBOARD: "osClipboard",
        GENERATOR: "generator"
    };

    /**
     * An array of all available locks. If an action does not specify a
     * particular set of locks, all locks are assumed.
     * 
     * @const
     * @type {Array.<string>}
     */
    var ALL_LOCKS = _.values(LOCKS);

    /**
     * An array of all Photoshop-specific locks.
     *
     * @const
     * @type {Array.<string>}
     */
    var ALL_PS_LOCKS = [
        LOCKS.PS_APP,
        LOCKS.PS_DOC,
        LOCKS.PS_TOOL,
        LOCKS.PS_MENU
    ];

    var ALL_NATIVE_LOCKS = ALL_PS_LOCKS.concat(LOCKS.CC_LIBRARIES, LOCKS.OS_CLIPBOARD, LOCKS.GENERATOR);

    module.exports = LOCKS;
    module.exports.ALL_LOCKS = ALL_LOCKS;
    module.exports.ALL_PS_LOCKS = ALL_PS_LOCKS;
    module.exports.ALL_NATIVE_LOCKS = ALL_NATIVE_LOCKS;
});
