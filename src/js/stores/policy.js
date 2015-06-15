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
        EventPolicySet = require("../models/eventpolicyset");

    var _eventKind = Object.defineProperties({}, {
        KEYBOARD: {
            value: "keyboard",
            writeable: false,
            enumerable: true
        },
        POINTER: {
            value: "pointer",
            writeable: false,
            enumerable: true
        }
    });

    /**
     * The PolicyStore tracks the set of active keyboard and pointer event
     * policies and provides an API for updating these policies.
     * 
     * @constructor
     */
    var PolicyStore = Fluxxor.createStore({
        /**
         * The set of policy sets, indexed by event kind
         * 
         * @private
         * @type {Object.<string, Array.<EventPolicySet>>}
         */
        _policySets: null,

        /**
         * Initialize the policy sets
         */
        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._policySets = Object.keys(_eventKind).reduce(function (sets, kind) {
                sets[_eventKind[kind]] = new EventPolicySet();
                return sets;
            }.bind(this), {});
        },

        /**
         * Remove an already installed event policy list
         *
         * @param {!string} kind A value defined in PolicyStore.eventKind
         * @param {!number} id         
         * @return {Array.<EventPolicy>}
         */
        removePolicyList: function (kind, id) {
            return this._policySets[kind].removePolicyList(id);
        },

        /**
         * Remove an already installed keyboard event policy list
         *
         * @param {!number} id
         * @return {Array.<KeybaordEventPolicy>}
         */
        removeKeyboardPolicyList: function (id) {
            return this.removePolicyList(_eventKind.KEYBOARD, id);
        },

        /**
         * Remove an already installed pointer event policy list
         *
         * @param {!number} id
         * @return {Array.<PointerEventPolicy>}
         */
        removePointerPolicyList: function (id) {
            return this.removePolicyList(_eventKind.POINTER, id);
        },

        /**
         * Add a new event policy list
         *
         * @param {!string} kind A value defined in PolicyStore.eventKind
         * @param {!Array.<EventPolicy>} policyList
         * @return {number} ID of the newly installed policy list
         */
        addPolicyList: function (kind, policyList) {
            return this._policySets[kind].addPolicyList(policyList);
        },

        /**
         * Add a new keyboard event policy list
         *
         * @param {!Array.<KeyboardEventPolicy>} policyList
         * @return {number} ID of the newly installed policy list
         */
        addKeyboardPolicyList: function (policyList) {
            return this.addPolicyList(_eventKind.KEYBOARD, policyList);
        },

        /**
         * Add a new pointer event policy list
         *
         * @param {!Array.<PointerEventPolicy>} policyList
         * @return {number} ID of the newly installed policy list
         */
        addPointerPolicyList: function (policyList) {
            return this.addPolicyList(_eventKind.POINTER, policyList);
        },

        /**
         * Get the master event policy list
         * 
         * @param {!string} kind A value defined in PolicyStore.eventKind
         * @return {Array.<object>}
         */
        getMasterPolicyList: function (kind) {
            return this._policySets[kind].getMasterPolicyList();
        },

        /**
         * Get the master keyboard event policy list
         * 
         * @return {Array.<object>}
         */
        getMasterKeyboardPolicyList: function () {
            return this.getMasterPolicyList(_eventKind.KEYBOARD);
        },

        /**
         * Get the master pointer event policy list
         * 
         * @return {Array.<object>}
         */
        getMasterPointerPolicyList: function () {
            return this.getMasterPolicyList(_eventKind.POINTER);
        }
    });

    /**
     * The kinds of policy sets.
     * 
     * @const
     * @type {Object.<string, string>}
     */
    PolicyStore.eventKind = _eventKind;

    module.exports = PolicyStore;
});
