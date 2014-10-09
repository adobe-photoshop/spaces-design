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

    var events = require("js/events"),
        locks = require("js/locks"),
        policy = require("js/actions/policy");

    /**
     * Add a keyboard shortcut command. Registers the handler function and sets
     * the appropriate keyboard propagation policy.
     * 
     * @param {string} keyChar Single character string
     * @param {boolean} shiftKey
     * @param {boolean} altKey
     * @param {boolean} ctrlKey
     * @param {boolean} metaKey
     * @param {function()} fn Nullary function triggered by the keyboard shortcut
     * @return {Promise}
     */
    var addShortcutCommand = function (keyChar, shiftKey, altKey, ctrlKey, metaKey, fn) {
        var keyCode = keyChar.charCodeAt(0),
            payload = {
                keyCode: keyCode,
                shiftKey: shiftKey,
                altKey: altKey,
                ctrlKey: ctrlKey,
                metaKey: metaKey,
                fn: fn
            };

        return this.transfer(policy.addKeydownPolicy, false, keyCode, shiftKey, altKey, ctrlKey, metaKey)
            .bind(this)
            .then(function () {
                this.dispatch(events.shortcuts.ADD_SHORTCUT, payload);
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

        window.addEventListener("keydown", function (event) {
            var fn = shortcutStore.matchShortcut(event);
            if (fn) {
                event.stopPropagation();
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
