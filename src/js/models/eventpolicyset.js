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

    var _ = require("lodash");

    var math = require("js/util/math");

    /**
     * Manages a set of event policy lists.
     * 
     * @constructor
     * @param {number=} counter
     */
    var EventPolicySet = function (counter) {
        this._policyLists = {};
        this._policyListCounter = counter || 0;
    };

    /**
     * @type {{number: Array.<EventPolicy>}}
     */
    EventPolicySet.prototype._policyLists = null;

    /**
     * @type {number}
     */
    EventPolicySet.prototype._policyListCounter = null;

    /**
     * Add a new policy list.
     * 
     * @param {Array.<EventPolicy>} policies
     * @return {number} The ID of the newly added policy list
     */
    EventPolicySet.prototype.addPolicyList = function (policies) {
        var id = this._policyListCounter++;

        this._policyLists[id] = policies;

        return id;
    };

    /**
     * Remove a previously stored policy list.
     * 
     * @param {number} id The ID of the previously stored policy list
     * @return {Array.<EventPolicy>}
     */
    EventPolicySet.prototype.removePolicyList = function (id) {
        if (!this._policyLists.hasOwnProperty(id)) {
            throw new Error("Unknown policy ID: " + id);
        }
        
        var policyList = this._policyLists[id];

        delete this._policyLists[id];

        return policyList;
    };

    /**
     * Combines all stored policy lists into a single, master policy list
     * suitable for communication with the Spaces adapter.
     * 
     * @return {Array.<EventPolicy>}
     */
    EventPolicySet.prototype.getMasterPolicyList = function () {
        return _.chain(this._policyLists)
            .keys()
            .sortBy(function (policyList, policyID) {
                return math.parseNumber(policyID);
            })
            .reduceRight(function (result, policyListID) {
                var policyList = this._policyLists[policyListID],
                    jsonPolicyList = policyList.map(function (policy) {
                        return policy.toJSONObject();
                    });

                result = result.concat(jsonPolicyList);
                return result;
            }.bind(this), [])
            .value();
    };

    /**
     * Peek to get the next policy ID.
     *
     * @return {number}
     */
    EventPolicySet.prototype.getNextPolicyID = function () {
        return this._policyListCounter;
    };

    /**
     * Create a new EventPolicySet that is derived from this and a derived EventPolicySet.
     *
     * @param {EventPolicySet} policySet
     * @return {EventPolicySet}
     */
    EventPolicySet.prototype.append = function (policySet) {
        if (policySet._policyListCounter < this._policyListCounter) {
            throw new Error("Only newer event policy sets may be appended to older event event policy sets.");
        }

        var clone = new EventPolicySet(policySet._policyListCounter);
        clone._policyLists = _.merge({}, this._policyLists, policySet._policyLists);

        return clone;
    };

    module.exports = EventPolicySet;
});
