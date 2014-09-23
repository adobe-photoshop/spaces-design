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

    var Fluxxor = require("fluxxor"),
        EventPolicySet = require("js/models/eventpolicyset");

    /**
     * The PolicyStore tracks the set of active keyboard and pointer event
     * policies and provides an API for updating these policies.
     * 
     * @constructor
     */
    var PolicyStore = Fluxxor.createStore({
        /**
         * The currently active keyboard event policies
         * 
         * @private
         * @type {Array.<EventPolicySet>}
         */
        _keyboardPolicySet: null,

        /**
         * The currently active pointer event policies
         * 
         * @private
         * @type {Array.<EventPolicySet>}
         */
        _pointerPolicySet: null,

        /**
         * Initialize the store
         */
        initialize: function () {
            this._keyboardPolicySet = new EventPolicySet();
            this._pointerPolicySet = new EventPolicySet();
        },

        /**
         * Remove an already installed keyboard event policy list
         *
         * @param {!number} id
         */
        removeKeyboardPolicyList: function (id) {
            return this._keyboardPolicySet.removePolicyList(id);
        },

        /**
         * Remove an already installed pointer event policy list
         *
         * @param {!number} id
         */
        removePointerPolicyList: function (id) {
            return this._pointerPolicySet.removePolicyList(id);
        },

        /**
         * Add a new keyboard event policy list
         *
         * @param {!Array.<KeyboardEventPolicy>} policyList
         * @return {number} ID of the newly installed policy list
         */
        addKeyboardPolicyList: function (policyList) {
            return this._keyboardPolicySet.addPolicyList(policyList);
        },

        /**
         * Add a new pointer event policy list
         *
         * @param {!Array.<PointerEventPolicy>} policyList
         * @return {number} ID of the newly installed policy list
         */
        addPointerPolicyList: function (policyList) {
            return this._pointerPolicySet.addPolicyList(policyList);
        },

        /**
         * Get the master keyboard event policy list
         * 
         * @return {Array.<object>}
         */
        getMasterKeyboardPolicyList: function () {
            return this._keyboardPolicySet.getMasterPolicyList();
        },

        /**
         * Get the master pointer event policy list
         * 
         * @return {Array.<object>}
         */
        getMasterPointerPolicyList: function () {
            return this._pointerPolicySet.getMasterPolicyList();
        }
    });

    module.exports = new PolicyStore();
});
