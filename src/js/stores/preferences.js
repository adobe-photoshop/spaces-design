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

define(function (require, exports, module) {
    "use strict";

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable");

    var events = require("../events"),
        log = require("js/util/log");

    /**
     * The key at which the preferences index is stored.
     * 
     * @const
     * @type {string} 
     */
    var PREF_INDEX = "com.adobe.photoshop.prefs.index";

    /**
     * The prefix with which preference keys are qualified.
     * 
     * @const
     * @type {string} 
     */
    var PREF_PREFIX = "com.adobe.photoshop.prefs.keys.";

    /**
     * @private
     * @type {Storage}
     */
    var _storage = window.localStorage;

    /**
     * Gets a key name qualified with a unique prefix.
     *
     * @private
     * @param {string} key
     * @return {string}
     */
    var _getQualifiedKey = function (key) {
        return PREF_PREFIX + key;
    };

    /**
     * Manages the set of preferences, including persistent loading and storing.
     */
    var PreferencesStore = Fluxxor.createStore({
        /**
         * The preferences map. Values can be any JSON.stringifyable type.
         * 
         * @private
         * @type {Immutable.Map.<string, *>}
         */
        _preferences: null,

        /** 
         * Loads saved preferences from local storage and binds flux actions.
         */
        initialize: function () {
            this._loadPreferences();

            this.bindActions(
                events.RESET, this._loadPreferences,
                events.preferences.SET_PREFERENCE, this._setPreference,
                events.preferences.SET_PREFERENCES, this._setPreferences,
                events.preferences.DELETE_PREFERENCE, this._deletePreference,
                events.preferences.CLEAR_PREFERENCES, this._clearPreferences
            );
        },

        /**
         * Get the preferences table.
         *
         * @return {Immutable.Map.<string, *>}
         */
        getState: function () {
            return this._preferences;
        },

        /**
         * Load persisted preferences and initialize the preferences table.
         *
         * @private
         */
        _loadPreferences: function () {
            var keysJSON = _storage.getItem(PREF_INDEX);
            if (keysJSON === null) {
                this._preferences = Immutable.Map();
                return;
            }

            try {
                var keys = JSON.parse(keysJSON),
                    prefs = keys.reduce(function (map, key) {
                        var qualifiedKey = _getQualifiedKey(key),
                            valueJSON = _storage.getItem(qualifiedKey),
                            value = JSON.parse(valueJSON);

                        return map.set(key, value);
                    }.bind(this), new Map());

                this._preferences = Immutable.Map(prefs);
            } catch (e) {
                log.debug("Failed to load preferences index", e);
                this._saveIndex(Immutable.Map());
            }
        },

        /**
         * Save and new set of preferences and persist its index.
         *
         * @param {Immutable.Map.<string, *>} newPrefs
         */
        _saveIndex: function (newPrefs) {
            var keys = newPrefs.keySeq().toArray(),
                keysJSON = JSON.stringify(keys);

            this._preferences = newPrefs;
            _storage.setItem(PREF_INDEX, keysJSON);
            this.emit("change");
        },

        /**
         * Set a single preference.
         *
         * @private
         * @param {{key: string, value: *}} payload
         */
        _setPreference: function (payload) {
            var key = payload.key,
                value = payload.value;

            try {
                var valueJSON = JSON.stringify(value),
                    qualifiedKey = _getQualifiedKey(key);

                _storage.setItem(qualifiedKey, valueJSON);
                this._saveIndex(this._preferences.set(key, value));
                this.emit("change");
            } catch (err) {
                var message = err instanceof Error ? (err.stack || err.message) : err;

                log.error("Failed to set preference", key, value, message);
            }
        },

        /**
         * Set a set of preferences.
         *
         * @private
         * @param {Object.<string, *>} payload
         */
        _setPreferences: function (payload) {
            var prefs = payload.prefs;

            try {
                Object.keys(prefs).forEach(function (key) {
                    var value = prefs[key],
                        valueJSON = JSON.stringify(value),
                        qualifiedKey = _getQualifiedKey(key);

                    _storage.setItem(qualifiedKey, valueJSON);
                });

                this._saveIndex(this._preferences.merge(prefs));
                this.emit("change");
            } catch (err) {
                var message = err instanceof Error ? (err.stack || err.message) : err;

                log.error("Failed to set preferences", prefs, message);
            }
        },

        /**
         * Delete a single preference.
         *
         * @private
         * @param {{key: string}} payload
         */
        _deletePreference: function (payload) {
            var key = payload.key,
                qualifiedKey = _getQualifiedKey(key);

            _storage.removeItem(qualifiedKey);
            this._saveIndex(this._preferences.delete(key));
            this.emit("change");
        },

        /**
         * Clear all preferences.
         *
         * @private
         */
        _clearPreferences: function () {
            this._preferences.keySeq().forEach(function (key) {
                var qualifiedKey = _getQualifiedKey(key);
                _storage.removeItem(qualifiedKey);
            }, this);

            this._saveIndex(Immutable.Map());
            this.emit("change");
        }
    });

    module.exports = PreferencesStore;
});
