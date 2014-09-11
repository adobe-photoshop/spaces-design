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

    /**
     * A map from namespaces to sets of action times.
     * 
     * @type {{string: {string: {idle: number, executing: number}}}}
     */
    var actionTimes = {};

    /**
     * Records a single action time event.
     * 
     * @param {string} namespace
     * @param {string} action
     * @param {number} enqueueTime
     * @param {number} startTime
     * @param {number} finishTime
     */
    var recordAction = function (namespace, action, enqueueTime, startTime, finishTime) {
        if (!actionTimes.hasOwnProperty(namespace)) {
            actionTimes[namespace] = {};
        }

        var times = actionTimes[namespace];

        if (!times.hasOwnProperty(action)) {
            times[action] = [];
        }

        times[action].push({
            idle: startTime - enqueueTime,
            executing: finishTime - startTime
        });
    };

    // TODO: occasionally save these records in localStorage, and restore them
    // in memory from localStorage on startup.

    exports.recordAction = recordAction;
});
