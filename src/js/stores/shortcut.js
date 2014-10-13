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
         * @param {{keyCode: number, modifiers: object, fn: function}} payload
         */
        _handleAddShortcut: function (payload) {
            var keyCode = payload.keyCode,
                modifiers = payload.modifiers,
                fn = payload.fn;

            this.addShortcut(keyCode, modifiers, fn);
        },

        /**
         * Register a single keyboard shortcut
         *
         * @param {number} keyCode
         * @param {{shift: boolean, control: boolean, meta: boolean, option: boolean}} modifiers
         * @param {function} fn
         */
        addShortcut: function (keyCode, modifiers, fn) {
            if (!this._shortcuts.hasOwnProperty(keyCode)) {
                this._shortcuts[keyCode] = [];
            }

            this._shortcuts[keyCode].push({
                keyCode: keyCode,
                modifiers: modifiers,
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
            var isMac = navigator.platform.indexOf("Mac") === 0,
                keyCode = event.keyCode,
                shortcuts = this._shortcuts[keyCode] || [],
                fn = null;

            shortcuts.some(function (shortcut) {
                var modifiers = shortcut.modifiers;

                if (modifiers.shift !== event.shiftKey) {
                    return;
                }

                if (modifiers.control !== event.ctrlKey) {
                    return;
                }

                if (isMac) {
                    if (modifiers.meta !== event.metaKey) {
                        return;
                    }

                    if (modifiers.option !== event.altKey) {
                        return;
                    }
                } else {
                    if (modifiers.meta !== event.altKey) {
                        return;
                    }
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
