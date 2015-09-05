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

    var adapterUI = require("adapter/ps/ui"),
        adapterOS = require("adapter/os"),
        events = require("js/events"),
        locks = require("js/locks"),
        PolicyStore = require("js/stores/policy"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy;

    /**
     * The previous policies during temporary policies disabling
     *
     * @type {?EventPolicySet}
     */
    var _cachedKeyboardPolicies = null;

    /**
     * The previous default keyboard mode during temporary policies disabling
     *
     * @type {?number}
     */
    var _cachedKeyboardMode = null;

    /**
     * For a given policy kind, fetch the master policy list and set it in photoshop
     * If a policyListID is provided, then attempt to remove it on error
     *
     * @param {string} kind
     * @param {number=} policyListID
     *
     * @return {Promise} Resolves when polices are set in photoshop
     */
    var _syncPolicies = function (kind, policyListID) {
        var policyStore = this.flux.store("policy"),
            masterPolicyList = policyStore.getMasterPolicyList(kind),
            promise;

        if (kind === PolicyStore.eventKind.KEYBOARD) {
            promise = adapterUI.setKeyboardEventPropagationPolicy(masterPolicyList);
        } else {
            promise = adapterUI.setPointerEventPropagationPolicy(masterPolicyList);
        }

        return promise.catch(function (err) {
                if (policyListID) {
                    try {
                        policyStore.removePolicyList(kind, policyListID);
                    } catch (err2) {
                        // ignore
                    }
                }
                    
                throw err;
            })
            .bind(this)
            .tap(function () {
                this.dispatch(events.policies.POLICIES_INSTALLED);
            });
    };

    /**
     * Install a new policy list.
     *
     * @private 
     * @param {string} kind A value defined in PolicyStore.eventKind
     * @param {Array.<KeyboardEventPolicy>} policies
     * @return {Promise}
     */
    var _addPolicies = function (kind, policies) {
        if (_cachedKeyboardPolicies && kind === PolicyStore.eventKind.KEYBOARD) {
            var msg = "Trying to add keyboard policies but a cached state exists";
            return Promise.reject(new Error(msg));
        }
        var policyStore = this.flux.store("policy"),
            policyListID = policyStore.addPolicyList(kind, policies);

        return _syncPolicies.call(this, kind, policyListID).return(policyListID);
    };

    /**
     * Remove an already-installed policy list.
     *
     * @param {string} kind A value defined in PolicyStore.eventKind
     * @param {number} id The ID of the installed policy list
     * @param {boolean=} commit Whether to commit the removal to Photoshop. If
     *  not set, the state will be changed locally, but Photoshop state will
     *  not be updated until the next commit. Useful when swapping policies.
     * @return {Promise}
     */
    var _removePolicies = function (kind, id, commit) {
        if (_cachedKeyboardPolicies && kind === PolicyStore.eventKind.KEYBOARD) {
            var msg = "Trying to remove keyboard policies but a cached state exists: " + id;
            return Promise.reject(new Error(msg));
        }
        var policyStore = this.flux.store("policy");

        if (policyStore.removePolicyList(kind, id)) {
            if (commit) {
                return _syncPolicies.call(this, kind);
            } else {
                return Promise.resolve();
            }
        } else {
            return Promise.reject(new Error("No policies found for id: " + id));
        }
    };

    /**
     * Install a new keyboard policy list.
     *
     * @param {Array.<KeyboardEventPolicy>} policies
     * @return {Promise}
     */
    var addKeyboardPolicies = function (policies) {
        return _addPolicies.call(this, PolicyStore.eventKind.KEYBOARD, policies);
    };
    addKeyboardPolicies.reads = [];
    addKeyboardPolicies.writes = [locks.PS_APP, locks.JS_POLICY];
    addKeyboardPolicies.modal = true;

    /**
     * Helper command to construct and install a single keydown policy.
     * 
     * @param {boolean} propagate Whether to propagate the keydown to Photoshop
     * @param {number|string} key Either a keyCode or a keyChar
     * @param {{shift: boolean=, control: boolean=, alt: boolean=, command: boolean=}} modifiers
     * @return {Promise.<number>} Resolves with the installed policy list ID
     */
    var addKeydownPolicy = function (propagate, key, modifiers) {
        var policyAction = propagate ?
                adapterUI.policyAction.ALWAYS_PROPAGATE :
                adapterUI.policyAction.NEVER_PROPAGATE,
            eventKind = adapterOS.eventKind.KEY_DOWN;

        var policy = new KeyboardEventPolicy(policyAction, eventKind, modifiers, key);

        return this.transfer(addKeyboardPolicies, [policy], true);
    };
    addKeydownPolicy.reads = [];
    addKeydownPolicy.writes = [locks.PS_APP, locks.JS_POLICY];
    addKeydownPolicy.transfers = [addKeyboardPolicies];

    /**
     * Remove an already-installed keyboard policy list.
     *
     * @param {number} id The ID of the installed keyboard policy list
     * @param {boolean=} commit Whether to commit the removal to Photoshop. If
     *  not set, the state will be changed locally, but Photoshop state will
     *  not be updated until the next commit. Useful when swapping keyboard
     *  policies.
     * @return {Promise}
     */
    var removeKeyboardPolicies = function (id, commit) {
        return _removePolicies.call(this, PolicyStore.eventKind.KEYBOARD, id, commit);
    };
    removeKeyboardPolicies.reads = [];
    removeKeyboardPolicies.writes = [locks.PS_APP, locks.JS_POLICY];
    removeKeyboardPolicies.modal = true;

    /**
     * Install a new pointer policy list.
     *
     * @param {Array.<PointerEventPolicy>} policies
     * @return {Promise}
     */
    var addPointerPolicies = function (policies) {
        return _addPolicies.call(this, PolicyStore.eventKind.POINTER, policies);
    };
    addPointerPolicies.reads = [];
    addPointerPolicies.writes = [locks.PS_APP, locks.JS_POLICY];

    /**
     * Remove an already-installed pointer policy list.
     *
     * @param {number} id The ID of the installed pointer policy list
     * @param {boolean=} commit Whether to commit the removal to Photoshop. If
     *  not set, the state will be changed locally, but Photoshop state will
     *  not be updated until the next commit. Useful when swapping pointer
     *  policies.
     * @return {Promise}
     */
    var removePointerPolicies = function (id, commit) {
        return _removePolicies.call(this, PolicyStore.eventKind.POINTER, id, commit);
    };
    removePointerPolicies.reads = [];
    removePointerPolicies.writes = [locks.PS_APP, locks.JS_POLICY];

    /**
     * Temporarily disable keyboard policies, caching the previous state
     *
     * @return {Promise}
     */
    var disableKeyboardPolicies = function () {
        if (_cachedKeyboardPolicies || _cachedKeyboardMode) {
            return Promise.reject(new Error("Can not disable keyboard policies if a cached state exists"));
        }

        var policyStore = this.flux.store("policy"),
            kind = PolicyStore.eventKind.KEYBOARD;

        _cachedKeyboardPolicies = policyStore.getPolicies(kind);

        return adapterUI.getKeyboardPropagationMode()
            .bind(this)
            .then(function (mode) {
                _cachedKeyboardMode = mode;
                policyStore.clearPolicies(kind);
                return _syncPolicies.call(this, kind);
            })
            .then(function () {
                return adapterUI.setKeyboardPropagationMode(
                    { defaultMode: adapterUI.keyboardPropagationMode.FOCUS_PROPAGATE });
            });
    };
    disableKeyboardPolicies.reads = [];
    disableKeyboardPolicies.writes = [locks.PS_APP, locks.JS_POLICY];

    /**
     * Re-enabled cached keyboard policies
     *
     * @return {Promise}
     */
    var reenableKeyboardPolicies = function () {
        if (!_cachedKeyboardPolicies || !_cachedKeyboardMode) {
            return Promise.reject(new Error("Can not re-renable keyboard policies, no previously cached state"));
        }

        var kind = PolicyStore.eventKind.KEYBOARD,
            policyStore = this.flux.store("policy");

        policyStore.setPolicies(kind, _cachedKeyboardPolicies);

        return adapterUI.setKeyboardPropagationMode({ defaultMode: _cachedKeyboardMode })
            .bind(this)
            .then(function () {
                return _syncPolicies.call(this, kind);
            })
            .finally(function () {
                _cachedKeyboardPolicies = null;
                _cachedKeyboardMode = null;
            });
    };
    reenableKeyboardPolicies.reads = [];
    reenableKeyboardPolicies.writes = [locks.PS_APP, locks.JS_POLICY];

    /**
     * Set the default keyboard propagation policy.
     *
     * @return {Promise}
     */
    var beforeStartup = function () {
        var policyMode = adapterUI.keyboardPropagationMode.NEVER_PROPAGATE,
            policyDescriptor = {
                defaultMode: policyMode
            };

        return adapterUI.setKeyboardPropagationMode(policyDescriptor);
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [locks.PS_APP, locks.JS_POLICY];

    /**
     * Reset
     *
     * @return {Promise}
     */
    var onReset = function () {
        _cachedKeyboardPolicies = null;
        _cachedKeyboardMode = null;

        return Promise.resolve();
    };
    onReset.reads = [];
    onReset.writes = [];

    exports.addKeydownPolicy = addKeydownPolicy;
    exports.addKeyboardPolicies = addKeyboardPolicies;
    exports.removeKeyboardPolicies = removeKeyboardPolicies;
    exports.addPointerPolicies = addPointerPolicies;
    exports.removePointerPolicies = removePointerPolicies;
    exports.disableKeyboardPolicies = disableKeyboardPolicies;
    exports.reenableKeyboardPolicies = reenableKeyboardPolicies;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
