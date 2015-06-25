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

    var Promise = require("bluebird");

    var dialog = require("./dialog"),
        locks = require("js/locks");

    /**
     * Open the First Launch dialog
     *
     * @return {Promise}
     */
    var openFirstLaunch = function () {
        return this.transfer(dialog.openDialog, "first-launch-dialog");
    };
    openFirstLaunch.reads = [];
    openFirstLaunch.writes = [locks.JS_DIALOG];

    /**
     * Open the keyboard shortcuts dialog.
     *
     * @return {Promise}
     */
    var openKeyboardShortcuts = function () {
        return this.transfer(dialog.openDialog, "keyboard-shortcut-dialog");
    };
    openKeyboardShortcuts.reads = [];
    openKeyboardShortcuts.writes = [locks.JS_DIALOG];

    /**
     * After startup, display the "first launch" dialog, 
     * based on "showFirstLaunch" preference
     * 
     * @return {Promise}
     */
    var afterStartup = function () {
        var preferences = this.flux.store("preferences").getState();

        if (preferences.get("showFirstLaunch", true)) {
            return this.transfer(openFirstLaunch);
        } else {
            return Promise.resolve();
        }
    };
    afterStartup.reads = [locks.JS_PREF];
    afterStartup.writes = [locks.JS_DIALOG];

    exports.openFirstLaunch = openFirstLaunch;
    exports.openKeyboardShortcuts = openKeyboardShortcuts;

    exports.afterStartup = afterStartup;
});
