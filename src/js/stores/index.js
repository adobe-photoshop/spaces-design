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

    /**
     * The master set of store constructors.
     * 
     * @private
     * @type {Object.<string, function()>}
     */
    var _imports = {
        "application": require("./application"),
        "document": require("./document"),
        "font": require("./font"),
        "tool": require("./tool"),
        "policy": require("./policy"),
        "menu": require("./menu"),
        "preferences": require("./preferences"),
        "ui": require("./ui"),
        "shortcut": require("./shortcut"),
        "example-one": require("./example-one"),
        "example-two": require("./example-two"),
        "dialog": require("./dialog"),
        "history": require("./history"),
        "draganddrop": require("./draganddrop"),
        "library": require("./library")
    };

    /**
     * Builds a set of instantiated store objects.
     * 
     * @return {Object.<string, Fluxxor.Store>}
     */
    var create = function () {
        return Object.keys(_imports).reduce(function (stores, key) {
            var Store = _imports[key];
            stores[key] = new Store();
            return stores;
        }, {});
    };

    exports.create = create;
});
