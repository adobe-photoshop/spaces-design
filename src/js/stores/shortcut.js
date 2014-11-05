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

    var events = require("js/events"),
        keyutil = require("js/util/key");

    /**
     * 
     * @constructor
     */
    var ShortcutStore = Fluxxor.createStore({
        _shortcuts: null,

        initialize: function () {
            this._shortcuts = [];

            this.bindActions(events.shortcuts.ADD_SHORTCUT, this._handleAddShortcut);
        },

        /**
         * Handler for the ADD_SHORTCUT event.
         * 
         * @private
         * @param {{key: number|string, modifiers: object, fn: function}} payload
         */
        _handleAddShortcut: function (payload) {
            this._shortcuts.push(payload);
        },

        /**
         * Find a matching keyboard shortcut command for the given KeyboardEvent.
         * 
         * @param {ExternalKeyEvent} event
         * @return {?function} Matching keyboard shortcut command, or null if there is no match.
         */
        matchShortcut: function (event) {
            var keyCode = event.keyCode,
                keyChar = event.keyChar,
                fn = null;

            this._shortcuts.some(function (shortcut) {
                if (shortcut.key !== keyCode && shortcut.key !== keyChar) {
                    return;
                }

                var shortcutModifierBits = keyutil.modifiersToBits(shortcut.modifiers);
                if (event.modifiers !== shortcutModifierBits) {
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
