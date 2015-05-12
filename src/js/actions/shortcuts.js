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

    var os = require("adapter/os");

    var events = require("js/events"),
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
    var addShortcut = function (key, modifiers, fn, id, capture) {
        var shortcutStore = this.flux.store("shortcut");
        if (shortcutStore.getByID(id)) {
            return Promise.reject("Shortcut already exists: " + id);
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
    addShortcut.reads = [];
    addShortcut.writes = [locks.PS_APP, locks.JS_SHORTCUT, locks.JS_POLICY];
    addShortcut.modal = true;

    /**
     * Remove a keyboard shortcut command. Unregisters the handler function and unsets
     * the appropriate keyboard propagation policy.
     * 
     * @param {!string} id Name of shortcut to remove
     * @return {Promise}
     */
    var removeShortcut = function (id) {
        var shortcutStore = this.flux.store("shortcut"),
            shortcut = shortcutStore.getByID(id);

        if (!shortcut) {
            return Promise.reject(new Error("Shortcut does not exist: " + id));
        }

        return this.transfer(policy.removeKeyboardPolicies, shortcut.policy, true)
            .bind(this)
            .then(function () {
                this.dispatch(events.shortcut.REMOVE_SHORTCUT, {
                    id: id
                });
            });
    };
    removeShortcut.reads = [];
    removeShortcut.writes = [locks.PS_APP, locks.JS_SHORTCUT, locks.JS_POLICY];
    removeShortcut.modal = true;

    /**
     * Blur the active element on KEYBOARDFOCUS_CHANGED adapter events.
     *
     * @private
     * @param {object} event
     */
    var _keyboardFocusChangedHandler = function (event) {
        // Our keyboard shortcuts ONLY work when there is no active HTML
        // element. So we have to be careful to ensure that HTML elements
        // are only active while they're in active use. This blurs the active
        // element whenever the CEF application loses focus so that shortcuts
        // still work even when that happens.
        if (event.isActive === false) {
            window.document.activeElement.blur();
        }
    };

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _keydownHandlerBubble,
        _keydownHandlerCapture;

    /**
     * Registers a keydown event handlers on the browser window in order to
     * dispatch shortcut commands.
     * 
     * @return {Promise}
     */
    var beforeStartup = function () {
        var shortcutStore = this.flux.store("shortcut"),
            controller = this.controller;

        var _getKeyDownHandlerForPhase = function (capture) {
            return function (event) {
                // Disable shortcuts when the controller is inactive
                if (!controller.active) {
                    return;
                }

                // If an HTML element is focused, only attempt to match the shortcut
                // if there are modifiers other than shift.
                if (event.target !== window.document.body &&
                    (event.detail.modifierBits === os.eventModifiers.NONE ||
                        event.detail.modifierBits === os.eventModifiers.SHIFT)) {
                    return;
                }

                var handlers = shortcutStore.matchShortcuts(event.detail, capture);
                handlers.forEach(function (handler) {
                    handler(event);
                });
            };
        };

        _keydownHandlerCapture = _getKeyDownHandlerForPhase(true);
        _keydownHandlerBubble = _getKeyDownHandlerForPhase(false);

        window.addEventListener("adapterKeydown", _keydownHandlerCapture, true);
        window.addEventListener("adapterKeydown", _keydownHandlerBubble, false);

        os.on(os.notifierKind.KEYBOARDFOCUS_CHANGED, _keyboardFocusChangedHandler);

        return Promise.resolve();
    };
    beforeStartup.reads = [locks.JS_SHORTCUT];
    beforeStartup.writes = [];
    beforeStartup.modal = true;

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        os.removeListener(os.notifierKind.KEYBOARDFOCUS_CHANGED, _keyboardFocusChangedHandler);

        window.removeEventListener("adapterKeydown", _keydownHandlerCapture, true);
        window.removeEventListener("adapterKeydown", _keydownHandlerBubble, false);

        return Promise.resolve();
    };
    onReset.reads = [];
    onReset.writes = [];
    onReset.modal = true;

    exports.addShortcut = addShortcut;
    exports.removeShortcut = removeShortcut;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
