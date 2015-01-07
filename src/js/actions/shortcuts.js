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

    var os = require("adapter/os"),
        events = require("js/events"),
        locks = require("js/locks"),
        policy = require("js/actions/policy");

    /**
     * Add a keyboard shortcut command. Registers the handler function and sets
     * the appropriate keyboard propagation policy.
     * 
     * @param {string} keyChar Single character string
     * @param {{shift: boolean=, control: boolean=, alt: boolean=, command: boolean=}} modifiers
     * @param {function()} fn Nullary function triggered by the keyboard shortcut
     * @return {Promise}
     */
    var addShortcutCommand = function (keyChar, modifiers, fn) {
        keyChar = keyChar.toLowerCase();

        return this.transfer(policy.addKeydownPolicy, false, keyChar, modifiers)
            .bind(this)
            .then(function (policyID) {
                var payload = {
                    key: keyChar,
                    modifiers: modifiers,
                    fn: fn,
                    policy: policyID
                };

                this.dispatch(events.shortcut.ADD_SHORTCUT, payload);

                return policyID;
            });
    };

    /**
     * Registers a single keydown event handler on the browser window object
     * that dispatches keyboard shortcut commands.
     * 
     * @return {Promise}
     */
    var onStartupCommand = function () {
        var shortcutStore = this.flux.store("shortcut");

        os.on(os.notifierKind.EXTERNAL_KEYEVENT, function (event) {
            if (event.eventKind !== os.eventKind.KEY_DOWN) {
                return;
            }

            // If an HTML element is focused, only attempt to match the shortcut
            // if there are no modifiers, or if shift is the only modifier
            if (document.activeElement !== document.body &&
                (event.modifiers === os.eventModifiers.NONE ||
                    event.modifiers === os.eventModifiers.SHIFT)) {
                return;
            }

            var fn = shortcutStore.matchShortcut(event);
            if (fn) {
                fn();
            }
        });

        return Promise.resolve();
    };

    var addShortcut = {
        command: addShortcutCommand,
        reads: [],
        writes: [locks.PS_APP, locks.JS_APP]
    };

    var onStartup = {
        command: onStartupCommand,
        reads: [locks.JS_APP],
        writes: []
    };

    exports.addShortcut = addShortcut;
    exports.onStartup = onStartup;
});
