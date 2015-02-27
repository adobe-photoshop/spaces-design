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

    var events = require("../events"),
        locks = require("js/locks");

    /**
     * Set a single preference.
     *
     * @param {string} key
     * @param {*} value Must be JSON.stringifyable
     * @return {Promise}
     */
    var setPreferenceCommand = function (key, value) {
        return Promise.bind(this).then(function () {
            this.dispatch(events.preferences.SET_PREFERENCE, {
                key: key,
                value: value
            });
        });
    };

    /**
     * Bulk set preferences.
     *
     * @param {Object.<string, *>} prefs Values must be JSON.stringifyable
     * @return {Promise}
     */
    var setPreferencesCommand = function (prefs) {
        return Promise.bind(this).then(function () {
            this.dispatch(events.preferences.SET_PREFERENCES, {
                prefs: prefs
            });
        });
    };

    /**
     * Delete a single preference.
     *
     * @param {string} key
     * @return {Promise}
     */
    var deletePreferenceCommand = function (key) {
        return Promise.bind(this).then(function () {
            this.dispatch(events.preferences.DELETE_PREFERENCE, {
                key: key
            });
        });
    };

    /**
     * Clear all preferences.
     *
     * @return {Promise}
     */
    var clearPreferencesCommand = function () {
        return Promise.bind(this).then(function () {
            this.dispatch(events.preferences.CLEAR_PREFERENCES);
        });
    };

    var setPreference = {
        command: setPreferenceCommand,
        reads: [],
        writes: [locks.JS_PREF]
    };

    var setPreferences = {
        command: setPreferencesCommand,
        reads: [],
        writes: [locks.JS_PREF]
    };

    var deletePreference = {
        command: deletePreferenceCommand,
        reads: [],
        writes: [locks.JS_PREF]
    };

    var clearPreferences = {
        command: clearPreferencesCommand,
        reads: [],
        writes: [locks.JS_PREF]
    };

    exports.setPreference = setPreference;
    exports.setPreferences = setPreferences;
    exports.deletePreference = deletePreference;
    exports.clearPreferences = clearPreferences;
});
