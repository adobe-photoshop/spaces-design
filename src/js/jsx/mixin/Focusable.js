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

    var React = require("react");

    var OS = require("adapter/os"),
        UI = require("adapter/ps/ui"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy;

    var log = require("js/util/log");

    var arrowUpKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
            OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_UP),
        arrowDownKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
            OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_DOWN),
        arrowLeftKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
            OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_LEFT),
        arrowRightKeyPolicy = new KeyboardEventPolicy(UI.policyAction.NEVER_PROPAGATE,
            OS.eventKind.KEY_DOWN, null, OS.eventKeyCode.ARROW_RIGHT);

    var keyboardPolicyList = [
        arrowUpKeyPolicy,
        arrowDownKeyPolicy,
        arrowLeftKeyPolicy,
        arrowRightKeyPolicy
    ];

    var _keyboardPolicy = null;

    module.exports = {
        acquireFocus: function () {
            OS.acquireKeyboardFocus().catch(function (err) {
                var message = err instanceof Error ? (err.stack || err.message) : err;

                log.error("Failed to acquire keyboard focus:", message);
            });

            this.getFlux().actions.policy.addKeyboardPolicies(keyboardPolicyList)
                .then(function (policy) {
                    _keyboardPolicy = policy;
                });
        },
        releaseFocus: function () {
            if (_keyboardPolicy) {
                this.getFlux().actions.policy.removeKeyboardPolicies(_keyboardPolicy);
            }
            
            return OS.releaseKeyboardFocus()
                .catch(function (err) {
                    var message = err instanceof Error ? (err.stack || err.message) : err;

                    log.error("Failed to release keyboard focus on reset:", message);
                });
        },
        componentDidMount: function () {
            React.findDOMNode(this).addEventListener("mousedown", this.acquireFocus);
        },
        componentWillUnmount: function () {
            React.findDOMNode(this).removeEventListener("mousedown", this.acquireFocus);
        }
    };
});
