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
        adapterOS = require("adapter/os");

    var events = require("js/events"),
        locks = require("js/locks"),
        PolicyStore = require("js/stores/policy"),
        EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy;

    /**
     * For a given policy kind, fetch the master policy list and set it in photoshop
     *
     * @param {string} kind
     * @return {Promise} Resolves when polices are set in photoshop
     */
    var syncPolicies = function (kind) {
        var policyStore = this.flux.store("policy"),
            masterPolicyList = policyStore.getMasterPolicyList(kind),
            dispatchPromise = this.dispatchAsync(events.policies.POLICIES_INSTALLED),
            policyPromise;

        if (kind === PolicyStore.eventKind.KEYBOARD) {
            policyPromise = adapterUI.setKeyboardEventPropagationPolicy(masterPolicyList);
        } else {
            policyPromise = adapterUI.setPointerEventPropagationPolicy(masterPolicyList);
        }

        return Promise.join(dispatchPromise, policyPromise);
    };
    syncPolicies.reads = [locks.JS_POLICY];
    syncPolicies.writes = [locks.PS_APP];
    syncPolicies.transfers = [];
    syncPolicies.modal = true;

    /**
     * Install a new policy list.
     *
     * @param {string} kind A value defined in PolicyStore.eventKind
     * @param {Array.<KeyboardEventPolicy>} policies
     * @return {Promise.<number>} Resolves with the new policy list ID
     */
    var addPolicies = function (kind, policies) {
        var policyStore = this.flux.store("policy"),
            policyListID = policyStore.addPolicyList(kind, policies);

        return this.transfer(syncPolicies, kind, policyListID).return(policyListID);
    };
    addPolicies.reads = [];
    addPolicies.writes = [locks.JS_POLICY];
    addPolicies.transfers = [syncPolicies];
    addPolicies.modal = true;

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
    var removePolicies = function (kind, id, commit) {
        var policyStore = this.flux.store("policy");

        if (policyStore.removePolicyList(kind, id)) {
            if (commit) {
                return this.transfer(syncPolicies, kind);
            } else {
                return Promise.resolve();
            }
        } else {
            return Promise.reject(new Error("No policies found for id: " + id));
        }
    };
    removePolicies.reads = [];
    removePolicies.writes = [locks.JS_POLICY];
    removePolicies.transfers = [syncPolicies];
    removePolicies.modal = true;

    /**
     * Install a new keyboard policy list.
     *
     * @param {Array.<KeyboardEventPolicy>} policies
     * @return {Promise.<number>}
     */
    var addKeyboardPolicies = function (policies) {
        return this.transfer(addPolicies, PolicyStore.eventKind.KEYBOARD, policies);
    };
    addKeyboardPolicies.reads = [];
    addKeyboardPolicies.writes = [];
    addKeyboardPolicies.transfers = [addPolicies];
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
    addKeydownPolicy.modal = true;

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
        return this.transfer(removePolicies, PolicyStore.eventKind.KEYBOARD, id, commit);
    };
    removeKeyboardPolicies.reads = [];
    removeKeyboardPolicies.writes = [];
    removeKeyboardPolicies.transfers = [removePolicies];
    removeKeyboardPolicies.modal = true;

    /**
     * Install a new pointer policy list.
     *
     * @param {Array.<PointerEventPolicy>} policies
     * @return {Promise.<number>}
     */
    var addPointerPolicies = function (policies) {
        return this.transfer(addPolicies, PolicyStore.eventKind.POINTER, policies);
    };
    addPointerPolicies.reads = [];
    addPointerPolicies.writes = [];
    addPointerPolicies.transfers = [addPolicies];
    addPointerPolicies.modal = true;

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
        return this.transfer(removePolicies, PolicyStore.eventKind.POINTER, id, commit);
    };
    removePointerPolicies.reads = [];
    removePointerPolicies.writes = [];
    removePointerPolicies.transfers = [removePolicies];
    removePointerPolicies.modal = true;

    /**
     * Set the propagation mode for the given policy kind. If no mode is supplied,
     * a default mode will be used.
     *
     * @param {number} kind
     * @param {number=} mode
     * @return {Promise}
     */
    var setMode = function (kind, mode) {
        var setModeFn;
        switch (kind) {
        case PolicyStore.eventKind.KEYBOARD:
            setModeFn = adapterUI.setKeyboardPropagationMode;
            if (mode === undefined) {
                mode = adapterUI.keyboardPropagationMode.FOCUS_PROPAGATE;
            }
            break;
        case PolicyStore.eventKind.POINTER:
            setModeFn = adapterUI.setPointerPropagationMode;
            if (mode === undefined) {
                mode = adapterUI.pointerPropagationMode.ALPHA_PROPAGATE;
            }
            break;
        default:
            return Promise.reject(new Error("Unknown kind:" + kind));
        }

        var setModePromise = setModeFn.call(adapterUI, { defaultMode: mode }),
            dispatchPromise = this.dispatchAsync(events.policies.MODE_CHANGED, {
                kind: kind,
                mode: mode
            });

        return Promise.join(setModePromise, dispatchPromise);
    };
    setMode.reads = [];
    setMode.writes = [locks.PS_APP, locks.JS_POLICY];
    setMode.transfers = [];
    setMode.modal = true;

    /**
     * Temporarily suspend policies of the given kind
     *
     * @param {number} kind
     * @return {Promise}
     */
    var suspendPolicies = function (kind) {
        var policyStore = this.flux.store("policy");
        if (policyStore.isSuspended(kind)) {
            return Promise.reject(new Error("Policies are already suspended"));
        }
        
        policyStore.suspend(kind);

        var setModePromise = this.transfer(setMode, kind),
            syncPoliciesPromise = this.transfer(syncPolicies, kind);

        return Promise.join(setModePromise, syncPoliciesPromise);
    };
    suspendPolicies.reads = [];
    suspendPolicies.writes = [locks.JS_POLICY];
    suspendPolicies.transfers = [setMode, syncPolicies];
    suspendPolicies.modal = true;

    /**
     * Restore suspended keyboard policies
     *
     * @param {number} kind     
     * @return {Promise}
     */
    var restorePolicies = function (kind) {
        var policyStore = this.flux.store("policy");
        if (!policyStore.isSuspended(kind)) {
            return Promise.reject(new Error("Policies not suspended"));
        }

        policyStore.restore(kind);

        var mode = policyStore.getMode(kind),
            setModePromise = this.transfer(setMode, kind, mode),
            syncPoliciesPromise = this.transfer(syncPolicies, kind);

        return Promise.join(setModePromise, syncPoliciesPromise);
    };
    restorePolicies.reads = [];
    restorePolicies.writes = [locks.JS_POLICY];
    restorePolicies.transfers = [setMode, syncPolicies];
    restorePolicies.modal = true;

    /**
     * Suspend both keyboard and pointer policies.
     *
     * @return {Promise}
     */
    var suspendAllPolicies = function () {
        var keyboardPromise = this.transfer(suspendPolicies, PolicyStore.eventKind.KEYBOARD),
            pointerPromise = this.transfer(suspendPolicies, PolicyStore.eventKind.POINTER);

        return Promise.join(keyboardPromise, pointerPromise);
    };
    suspendAllPolicies.reads = [];
    suspendAllPolicies.writes = [];
    suspendAllPolicies.transfers = [suspendPolicies];
    suspendAllPolicies.modal = true;

    /**
     * Restore both keyboard and pointer policies.
     *
     * @return {Promise}
     */
    var restoreAllPolicies = function () {
        var keyboardPromise = this.transfer(restorePolicies, PolicyStore.eventKind.KEYBOARD),
            pointerPromise = this.transfer(restorePolicies, PolicyStore.eventKind.POINTER);

        return Promise.join(keyboardPromise, pointerPromise);
    };
    restoreAllPolicies.reads = [];
    restoreAllPolicies.writes = [];
    restoreAllPolicies.transfers = [restorePolicies];
    restoreAllPolicies.modal = true;

    /**
     * Set the default keyboard propagation policy.
     *
     * @return {Promise}
     */
    var beforeStartup = function () {
        var defaultKeyboardMode = adapterUI.keyboardPropagationMode.FOCUS_PROPAGATE,
            keyboardModePromise = this.transfer(setMode, PolicyStore.eventKind.KEYBOARD,
                defaultKeyboardMode),
            defaultPointerMode = adapterUI.pointerPropagationMode.ALPHA_PROPAGATE,
            // Alpha is the default pointer mode, but we set it here anyway so that we can reset 
            // to the correct default mode when error occurs.
            pointerModePromise = this.transfer(setMode, PolicyStore.eventKind.POINTER,
                defaultPointerMode);

        return Promise.join(keyboardModePromise, pointerModePromise);
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [locks.PS_APP, locks.JS_POLICY];
    beforeStartup.transfers = ["policy.setMode"];

    exports.syncPolicies = syncPolicies;
    exports.setMode = setMode;
    exports.addPolicies = addPolicies;
    exports.removePolicies = removePolicies;
    exports.addKeydownPolicy = addKeydownPolicy;
    exports.addKeyboardPolicies = addKeyboardPolicies;
    exports.removeKeyboardPolicies = removeKeyboardPolicies;
    exports.addPointerPolicies = addPointerPolicies;
    exports.removePointerPolicies = removePointerPolicies;
    exports.suspendPolicies = suspendPolicies;
    exports.suspendAllPolicies = suspendAllPolicies;
    exports.restorePolicies = restorePolicies;
    exports.restoreAllPolicies = restoreAllPolicies;

    exports.beforeStartup = beforeStartup;
});
