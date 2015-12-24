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

import * as Promise from "bluebird";

import * as events from "../events";
import * as locks from "js/locks";

/**
 * Example synchronous command. Note that all commands must return a promise.
 * 
 * @param {number} count Example paramter
 * @return {!Promise}
 */
export var syncAction = function (count) {
    var payload = {
        count: count
    };

    this.dispatch(events.example.SYNC_ACTION, payload);

    return Promise.resolve();
};
syncAction.action = {
    writes: locks.ALL_LOCKS
};

/**
 * Example asynchronous command. Returned promise does not resolve until all
 * events have been dispatched.
 * 
 * @param {number} count Example paramter
 * @return {!Promise}
 */
var async = function (count) {
    return new Promise(function (resolve) {
        var payload = {
            count: count
        };

        this.dispatch(events.example.ASYNC_ACTION_START, payload);

        window.setTimeout(function () {
            this.dispatch(events.example.ASYNC_ACTION_SUCCESS, payload);
            resolve();
        }.bind(this), 100);
    }.bind(this));
};

/**
 * Example asynchonous action. If the read set or write set is left unspecified
 * then all locks are assumed to be required. Also, any write locks are assumed
 * to also be included in the set of read locks.
 * 
 * This action acquires all write locks before executing. Hence, this action
 * will never be executed concurrently with any other action.
 *
 * @type {{command: function, reads: Array.<string>=, writes: Array.<string>=}}
 */
export var asyncActionReadWrite = function () { return async.apply(this, arguments); };
asyncActionReadWrite.action = {
    writes: locks.ALL_LOCKS
};

/**
 * Example asynchonous action. This action acquires all read locks but no
 * write locks before executing. Hence, this action may be executed concurrently
 * with other actions that only require read locks, but will never be executed
 * concurrently with other actions that require any write locks.
 *
 * @type {{command: function, reads: Array.<string>=, writes: Array.<string>=}}
 */
export var asyncActionReadOnly = function () { return async.apply(this, arguments); };
asyncActionReadOnly.action = {
    reads: locks.ALL_LOCKS,
    writes: []
};
