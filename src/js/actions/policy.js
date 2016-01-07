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

    var adapterUI = require("adapter").ps.ui,
        adapterOS = require("adapter").os;

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
        var policyStore = this.flux.store("policy");

        if (this.isHeadless || !policyStore.isDirty(kind)) {
            return Promise.resolve();
        }

        var masterPolicyList = policyStore.getMasterPolicyList(kind),
            dispatchPromise = this.dispatchAsync(events.policies.POLICIES_INSTALLED, {
                kind: kind
            }),
            policyPromise;

        if (kind === PolicyStore.eventKind.KEYBOARD) {
            policyPromise = adapterUI.setKeyboardEventPropagationPolicy(masterPolicyList);
        } else {
            policyPromise = adapterUI.setPointerEventPropagationPolicy(masterPolicyList);
        }

        return Promise.join(dispatchPromise, policyPromise);
    };
    syncPolicies.action = {
        reads: [locks.JS_POLICY],
        writes: [locks.PS_APP],
        transfers: [],
        modal: true
    };

    /**
     * Sync all policies to Photoshop.
     *
     * @return {Promise}
     */
    var syncAllPolicies = function () {
        var keyboardPromise = this.transfer(syncPolicies, PolicyStore.eventKind.KEYBOARD),
            pointerPromise = this.transfer(syncPolicies, PolicyStore.eventKind.POINTER);

        return Promise.join(keyboardPromise, pointerPromise);
    };
    syncAllPolicies.action = {
        reads: [],
        writes: [],
        transfers: [syncPolicies],
        modal: true
    };

    /**
     * Install a new policy list.
     *
     * @param {string} kind A value defined in PolicyStore.eventKind
     * @param {Array.<KeyboardEventPolicy>} policies
     * @param {boolean=} noCommit Whether or not to commit the change to Photoshop.
     * @return {Promise.<number>} Resolves with the new policy list ID
     */
    var addPolicies = function (kind, policies, noCommit) {
        var policyStore = this.flux.store("policy"),
            policyListID = policyStore.addPolicyList(kind, policies),
            syncPromise = noCommit ? Promise.resolve() : this.transfer(syncPolicies, kind, policyListID);

        return syncPromise.return(policyListID);
    };
    addPolicies.action = {
        reads: [],
        writes: [locks.JS_POLICY],
        transfers: [syncPolicies],
        modal: true
    };

    /**
     * Remove an already-installed policy list.
     *
     * @param {string} kind A value defined in PolicyStore.eventKind
     * @param {number} id The ID of the installed policy list
     * @param {boolean=} noCommit Whether or not to commit the change to Photoshop.
     * @return {Promise}
     */
    var removePolicies = function (kind, id, noCommit) {
        var policyStore = this.flux.store("policy");

        if (policyStore.removePolicyList(kind, id)) {
            if (noCommit) {
                return Promise.resolve();
            } else {
                return this.transfer(syncPolicies, kind);
            }
        } else {
            return Promise.reject(new Error("No policies found for id: " + id));
        }
    };
    removePolicies.action = {
        reads: [],
        writes: [locks.JS_POLICY],
        transfers: [syncPolicies],
        modal: true
    };

    /**
     * Install a new keyboard policy list.
     *
     * @param {Array.<KeyboardEventPolicy>} policies
     * @param {boolean=} noCommit
     * @return {Promise.<number>}
     */
    var addKeyboardPolicies = function (policies, noCommit) {
        return this.transfer(addPolicies, PolicyStore.eventKind.KEYBOARD, policies, noCommit);
    };
    addKeyboardPolicies.action = {
        reads: [],
        writes: [],
        transfers: [addPolicies],
        modal: true
    };

    /**
     * Helper command to construct and install a single keydown policy.
     * 
     * @param {boolean} propagate Whether to propagate the keydown to Photoshop
     * @param {number|string} key Either a keyCode or a keyChar
     * @param {{shift: boolean=, control: boolean=, alt: boolean=, command: boolean=}} modifiers
     * @param {boolean=} noCommit 
     * @return {Promise.<number>} Resolves with the installed policy list ID
     */
    var addKeydownPolicy = function (propagate, key, modifiers, noCommit) {
        var policyAction = propagate ?
                adapterUI.policyAction.PROPAGATE_TO_PHOTOSHOP :
                adapterUI.policyAction.PROPAGATE_TO_BROWSER,
            eventKind = adapterOS.eventKind.KEY_DOWN;

        var policy = new KeyboardEventPolicy(policyAction, eventKind, modifiers, key);

        return this.transfer(addKeyboardPolicies, [policy], noCommit);
    };
    addKeydownPolicy.action = {
        reads: [],
        writes: [locks.PS_APP, locks.JS_POLICY],
        transfers: [addKeyboardPolicies],
        modal: true
    };

    /**
     * Remove an already-installed keyboard policy list.
     *
     * @param {number} id The ID of the installed keyboard policy list
     * @param {boolean=} noCommit Whether or not to commit the change to Photoshop.
     * @return {Promise}
     */
    var removeKeyboardPolicies = function (id, noCommit) {
        return this.transfer(removePolicies, PolicyStore.eventKind.KEYBOARD, id, noCommit);
    };
    removeKeyboardPolicies.action = {
        reads: [],
        writes: [],
        transfers: [removePolicies],
        modal: true
    };

    /**
     * Install a new pointer policy list.
     *
     * @param {Array.<PointerEventPolicy>} policies
     * @param {boolean=} noCommit
     * @return {Promise.<number>}
     */
    var addPointerPolicies = function (policies, noCommit) {
        return this.transfer(addPolicies, PolicyStore.eventKind.POINTER, policies, noCommit);
    };
    addPointerPolicies.action = {
        reads: [],
        writes: [],
        transfers: [addPolicies],
        modal: true
    };

    /**
     * Remove an already-installed pointer policy list.
     *
     * @param {number} id The ID of the installed pointer policy list
     * @param {boolean=} noCommit Whether or not to commit the change to Photoshop.
     * @return {Promise}
     */
    var removePointerPolicies = function (id, noCommit) {
        return this.transfer(removePolicies, PolicyStore.eventKind.POINTER, id, noCommit);
    };
    removePointerPolicies.action = {
        reads: [],
        writes: [],
        transfers: [removePolicies],
        modal: true
    };

    /**
     * Set the propagation mode for the given policy kind. If no mode is supplied,
     * a default mode will be used.
     *
     * @param {number} kind
     * @param {number=} mode
     * @return {Promise}
     */
    var setMode = function (kind, mode) {
        if (this.isHeadless) {
            return Promise.resolve();
        }

        var setModeFn;
        switch (kind) {
        case PolicyStore.eventKind.KEYBOARD:
            setModeFn = adapterUI.setKeyboardPropagationMode;
            if (mode === undefined) {
                mode = adapterUI.keyboardPropagationMode.PROPAGATE_BY_FOCUS;
            }
            break;
        case PolicyStore.eventKind.POINTER:
            setModeFn = adapterUI.setPointerPropagationMode;
            if (mode === undefined) {
                mode = adapterUI.pointerPropagationMode.PROPAGATE_BY_ALPHA;
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
    setMode.action = {
        reads: [],
        writes: [locks.PS_APP, locks.JS_POLICY],
        transfers: [],
        modal: true
    };

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
    suspendPolicies.action = {
        reads: [],
        writes: [locks.JS_POLICY],
        transfers: [setMode, syncPolicies],
        modal: true
    };

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
    restorePolicies.action = {
        reads: [],
        writes: [locks.JS_POLICY],
        transfers: [setMode, syncPolicies],
        modal: true
    };

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
    suspendAllPolicies.action = {
        reads: [],
        writes: [],
        transfers: [suspendPolicies],
        modal: true
    };

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
    restoreAllPolicies.action = {
        reads: [],
        writes: [],
        transfers: [restorePolicies],
        modal: true
    };

    /**
     * Set the default keyboard propagation policy.
     *
     * @return {Promise}
     */
    var beforeStartup = function () {
        if (this.isHeadless) {
            var keyboardPolicyPromise = adapterUI.setKeyboardEventPropagationPolicy([]),
                pointerPolicyPromise = adapterUI.setPointerEventPropagationPolicy([]),
                photoshopPropagateMode = adapterUI.keyboardPropagationMode.PROPAGATE_BY_FOCUS,
                psKeyboardModePromise = adapterUI.setKeyboardPropagationMode({ defaultMode: photoshopPropagateMode });

            return Promise.join(keyboardPolicyPromise, pointerPolicyPromise, psKeyboardModePromise);
        } else {
            var defaultKeyboardMode = adapterUI.keyboardPropagationMode.PROPAGATE_TO_BROWSER,
                keyboardModePromise = this.transfer(setMode, PolicyStore.eventKind.KEYBOARD,
                    defaultKeyboardMode),
                defaultPointerMode = adapterUI.pointerPropagationMode.PROPAGATE_BY_ALPHA,
                // Alpha is the default pointer mode, but we set it here anyway so that we can reset 
                // to the correct default mode when error occurs.
                pointerModePromise = this.transfer(setMode, PolicyStore.eventKind.POINTER,
                    defaultPointerMode);

            return Promise.join(keyboardModePromise, pointerModePromise);
        }
    };
    beforeStartup.action = {
        reads: [],
        writes: [locks.PS_APP, locks.JS_POLICY],
        transfers: ["policy.setMode"]
    };

    exports.syncPolicies = syncPolicies;
    exports.syncAllPolicies = syncAllPolicies;
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
    exports._priority = 1;
});
