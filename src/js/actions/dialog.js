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

    var events = require("../events"),
        locks = require("js/locks");

    /**
     * Open a dialog with a given ID and optional dismissal policy.
     * Must pre-register if the dismissal policy is to be excluded
     *
     * @private
     * @param {string} id
     * @param {object=} dismissalPolicy
     * @return {Promise}
     */
    var openDialog = function (id, dismissalPolicy) {
        var payload = {
            id: id,
            dismissalPolicy: dismissalPolicy
        };

        return this.dispatchAsync(events.dialog.OPEN_DIALOG, payload);
    };
    openDialog.reads = [];
    openDialog.writes = [locks.JS_DIALOG];
    openDialog.modal = true;

    /**
     * Close an already open dialog with the given ID.
     *
     * @private
     * @param {string} id
     * @return {Promise}
     */
    var closeDialog = function (id) {
        var payload = {
            id: id
        };

        return this.dispatchAsync(events.dialog.CLOSE_DIALOG, payload);
    };
    closeDialog.reads = [];
    closeDialog.writes = [locks.JS_DIALOG];
    closeDialog.modal = true;

    /**
     * Close all open dialogs.
     *
     * @private
     * @return {Promise}
     */
    var closeAllDialogs = function () {
        return this.dispatchAsync(events.dialog.CLOSE_DIALOG);
    };
    closeAllDialogs.reads = [];
    closeAllDialogs.writes = [locks.JS_DIALOG];
    closeAllDialogs.modal = true;

    exports.openDialog = openDialog;
    exports.closeDialog = closeDialog;
    exports.closeAllDialogs = closeAllDialogs;
});
