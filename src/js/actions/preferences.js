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
     * Set a single preference.
     *
     * @param {string} key
     * @param {*} value Must be JSON.stringifyable
     * @return {Promise}
     */
    var setPreference = function (key, value) {
        return this.dispatchAsync(events.preferences.SET_PREFERENCE, {
            key: key,
            value: value
        });
    };
    setPreference.reads = [];
    setPreference.writes = [locks.JS_PREF];

    /**
     * Bulk set preferences.
     *
     * @param {Object.<string, *>} prefs Values must be JSON.stringifyable
     * @return {Promise}
     */
    var setPreferences = function (prefs) {
        return this.dispatchAsync(events.preferences.SET_PREFERENCES, {
            prefs: prefs
        });
    };
    setPreferences.reads = [];
    setPreferences.writes = [locks.JS_PREF];

    /**
     * Delete a single preference.
     *
     * @param {string} key
     * @return {Promise}
     */
    var deletePreference = function (key) {
        return this.dispatchAsync(events.preferences.DELETE_PREFERENCE, {
            key: key
        });
    };
    deletePreference.reads = [];
    deletePreference.writes = [locks.JS_PREF];

    /**
     * Clear all preferences.
     *
     * @return {Promise}
     */
    var clearPreferences = function () {
        return this.dispatchAsync(events.preferences.CLEAR_PREFERENCES);
    };
    clearPreferences.reads = [];
    clearPreferences.writes = [locks.JS_PREF];

    exports.setPreference = setPreference;
    exports.setPreferences = setPreferences;
    exports.deletePreference = deletePreference;
    exports.clearPreferences = clearPreferences;
});
