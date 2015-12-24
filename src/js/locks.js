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

import * as _ from "lodash";

/**
 * The set of available locks, each of which corresponds to a distinct
 * resource.
 * 
 * @const
 * @type {{string: string}}
 */
const LOCKS = {
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
    JS_PANEL: "jsPanel",
    JS_PREF: "jsPref",
    JS_HISTORY: "jsHistory",
    JS_STYLE: "jsStyle",
    JS_LIBRARIES: "jsLibraries",
    JS_EXPORT: "jsExport",
    JS_SEARCH: "jsSearch",
    CC_LIBRARIES: "ccLibraries",
    OS_CLIPBOARD: "osClipboard"
};
export default LOCKS;

/**
 * An array of all available locks. If an action does not specify a
 * particular set of locks, all locks are assumed.
 * 
 * @const
 * @type {Array.<string>}
 */
export var ALL_LOCKS = _.values(LOCKS);

/**
 * An array of all Photoshop-specific locks.
 *
 * @const
 * @type {Array.<string>}
 */
export var ALL_PS_LOCKS = [
    LOCKS.PS_APP,
    LOCKS.PS_DOC,
    LOCKS.PS_TOOL,
    LOCKS.PS_MENU
];

/**
 * An array of all native (Photoshop and OS) locks.
 *
 * @const
 * @type {Array.<string>}
 */
export var ALL_NATIVE_LOCKS = ALL_PS_LOCKS.concat(LOCKS.CC_LIBRARIES, LOCKS.OS_CLIPBOARD);
