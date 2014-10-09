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

    var Fluxxor = require("fluxxor");

    var events = require("js/events");

    /**
     * 
     * @constructor
     */
    var ShortcutStore = Fluxxor.createStore({
        _shortcuts: null,

        initialize: function () {
            this._shortcuts = {};

            this.bindActions(events.shortcuts.ADD_SHORTCUT, this._handleAddShortcut);
        },

        /**
         * Handler for the ADD_SHORTCUT event.
         * 
         * @private
         * @param {{keyCode: number, shiftKey: boolean, altKey: boolean, ctrlKey: boolean, fn: function}}} payload
         */
        _handleAddShortcut: function (payload) {
            var keyCode = payload.keyCode,
                shiftKey = payload.shiftKey,
                altKey = payload.altKey,
                ctrlKey = payload.ctrlKey,
                metaKey = payload.metaKey,
                fn = payload.fn;

            this.addShortcut(keyCode, shiftKey, altKey, ctrlKey, metaKey, fn);
        },

        /**
         * Register a single keyboard shortcut
         *
         * @param {number} keyCode
         * @param {boolean} shiftKey
         * @param {boolean} altKey
         * @param {boolean} ctrlKey
         * @param {boolean} metaKey
         * @param {function} fn
         */
        addShortcut: function (keyCode, shiftKey, altKey, ctrlKey, metaKey, fn) {
            if (!this._shortcuts.hasOwnProperty(keyCode)) {
                this._shortcuts[keyCode] = [];
            }

            this._shortcuts[keyCode].push({
                keyCode: keyCode,
                shiftKey: shiftKey,
                altKey: altKey,
                ctrlKey: ctrlKey,
                metaKey: metaKey,
                fn: fn
            });
        },

        /**
         * Find a matching keyboard shortcut command for the given KeyboardEvent.
         * 
         * @param {KeyboardEvent} event
         * @return {?function} Matching keyboard shortcut command, or null if there is no match.
         */
        matchShortcut: function (event) {
            var keyCode = event.keyCode,
                shortcuts = this._shortcuts[keyCode] || [],
                fn = null;

            shortcuts.some(function (shortcut) {
                if (shortcut.shiftKey !== event.shiftKey) {
                    return;
                }

                if (shortcut.altKey !== event.altKey) {
                    return;
                }

                if (shortcut.ctrlKey !== event.ctrlKey) {
                    return;
                }

                if (shortcut.metaKey !== event.metaKey) {
                    return;
                }

                fn = shortcut.fn;
                return true;
            });

            return fn;
        },

        getState: function () {
            return {
                shortcuts: this._shortcuts
            };
        }
    });

    module.exports = ShortcutStore;
});
