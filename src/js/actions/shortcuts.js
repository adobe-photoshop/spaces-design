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
     * @param {string|number} key Single character string or number representing keyCode
     * @param {{shift: boolean=, control: boolean=, alt: boolean=, command: boolean=}} modifiers
     * @param {function()} fn Nullary function triggered by the keyboard shortcut
     * @param {string=} id Named identifier of this shortcut, used for later removal
     * @param {boolean=} capture Whether the shortcut should be handled during
     *  bubble (default) or capture phase
     * @return {Promise}
     */
    var addShortcutCommand = function (key, modifiers, fn, id, capture) {
        var shortcutStore = this.flux.store("shortcut");
        if (shortcutStore.getByID(id)) {
            return Promise.resolve();
        }

        if (typeof key === "string") {
            key = key.toLowerCase();
        }

        return this.transfer(policy.addKeydownPolicy, false, key, modifiers)
            .bind(this)
            .then(function (policyID) {
                var payload = {
                    id: id,
                    capture: !!capture,
                    key: key,
                    modifiers: modifiers,
                    fn: fn,
                    policy: policyID
                };

                this.dispatch(events.shortcut.ADD_SHORTCUT, payload);

                return policyID;
            });
    };

    /**
     * Remove a keyboard shortcut command. Unregisters the handler function and unsets
     * the appropriate keyboard propagation policy.
     * 
     * @param {!string} id Name of shortcut to remove
     * @return {Promise}
     */
    var removeShortcutCommand = function (id) {
        var shortcutStore = this.flux.store("shortcut"),
            shortcut = shortcutStore.getByID(id);

        if (!shortcut) {
            return Promise.resolve();
        }

        return this.transfer(policy.removeKeyboardPolicies, shortcut.policy, true)
            .bind(this)
            .then(function () {
                this.dispatch(events.shortcut.REMOVE_SHORTCUT, {
                    id: id
                });
            });
    };

    /**
     * Registers a keydown event handlers on the browser window in order to
     * dispatch shortcut commands.
     * 
     * @return {Promise}
     */
    var onStartupCommand = function () {
        var shortcutStore = this.flux.store("shortcut");

        var _getKeyDownHandlerForPhase = function (capture) {
            return function (event) {
                // If an HTML element is focused, only attempt to match the shortcut
                // if there are modifiers other than shift.
                if (event.target !== document.body &&
                    (event.detail.modifiers === os.eventModifiers.NONE ||
                        event.detail.modifiers === os.eventModifiers.SHIFT)) {
                    return;
                }

                var handlers = shortcutStore.matchShortcuts(event.detail, capture);
                handlers.forEach(function (handler) {
                    handler(event);
                });
            };
        };

        window.addEventListener("adapterKeydown", _getKeyDownHandlerForPhase(true), true);
        window.addEventListener("adapterKeydown", _getKeyDownHandlerForPhase(false), false);

        os.on(os.notifierKind.KEYBOARDFOCUS_CHANGED, function (event) {
            // FIXME: This event name is weird and will probably be changed.
            if (event["bool:isActive"] === false) {
                document.activeElement.blur();
            }
        });

        return Promise.resolve();
    };

    var addShortcut = {
        command: addShortcutCommand,
        reads: [],
        writes: [locks.PS_APP, locks.JS_APP]
    };

    var removeShortcut = {
        command: removeShortcutCommand,
        reads: [],
        writes: [locks.PS_APP, locks.JS_APP]
    };

    var onStartup = {
        command: onStartupCommand,
        reads: [locks.JS_APP],
        writes: []
    };

    exports.addShortcut = addShortcut;
    exports.removeShortcut = removeShortcut;
    exports.onStartup = onStartup;
});
