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

    var events = require("../events"),
        keyUtil = require("../util/key");

    /**
     * 
     * @constructor
     */
    var ShortcutStore = Fluxxor.createStore({
        /**
         * @private
         * @type {Array.<object>}
         */
        _shortcuts: null,

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.shortcut.ADD_SHORTCUT, this._handleAddShortcut,
                events.shortcut.REMOVE_SHORTCUT, this._handleRemoveShortcut
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._shortcuts = [];
        },

        /**
         * Handler for the ADD_SHORTCUT event.
         * 
         * @private
         * @param {Shortcut} payload Where the Shortcut object has the following type:
         *  { id: string,
         *    key: number|string,
         *    modifiers: object,
         *    fn: function,
         *    capture: boolean: policy: number }
         */
        _handleAddShortcut: function (payload) {
            if (!payload.id) {
                payload.id = window.Symbol();
            }

            this._shortcuts.push(payload);
        },

        /**
         * Handler for the REMOVE_SHORTCUT event.
         * 
         * @private
         * @param {{id: string}} payload
         */
        _handleRemoveShortcut: function (payload) {
            var id = payload.id,
                found = -1;

            this._shortcuts.some(function (shortcut, index) {
                if (shortcut.id === id) {
                    found = index;
                    return true;
                }
            });

            if (found > 0) {
                this._shortcuts.splice(found, 1);
            }
        },

        /**
         * Find a matching keyboard shortcut command for the given KeyboardEvent.
         * 
         * @param {ExternalKeyEvent} event
         * @param {boolean} capture Whether to match bubble or capture phase shortcuts
         * @return {Array.<function>} Matching keyboard shortcut commands
         */
        matchShortcuts: function (event, capture) {
            var keyCode = event.keyCode,
                keyChar = event.keyChar;

            return this._shortcuts.reduce(function (handlers, shortcut) {
                if ((shortcut.key !== keyCode && shortcut.key !== keyChar) ||
                    shortcut.capture !== capture) {
                    return handlers;
                }

                var shortcutModifierBits = keyUtil.modifiersToBits(shortcut.modifiers);
                if (event.modifierBits !== shortcutModifierBits) {
                    return handlers;
                }

                handlers.push(shortcut.fn);
                return handlers;
            }, []);
        },

        /**
         * Get a shortcut by a ID.
         *
         * @param {string} id
         * @return {?Shortcut}
         */
        getByID: function (id) {
            var found;
            this._shortcuts.some(function (shortcut) {
                if (shortcut.id === id) {
                    found = shortcut;
                    return true;
                }
            });
            return found;
        },

        getState: function () {
            return {
                shortcuts: this._shortcuts
            };
        }
    });

    module.exports = ShortcutStore;
});
