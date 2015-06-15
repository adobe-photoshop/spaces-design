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

    var _ = require("lodash");

    var log = require("../util/log");

    /**
     * A map from namespaces to sets of action times.
     * 
     * @private
     * @type {{string: {string: {idle: number, executing: number}}}}
     */
    var _actionTimes = {};

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
        if (!_actionTimes.hasOwnProperty(namespace)) {
            _actionTimes[namespace] = {};
        }

        var times = _actionTimes[namespace];

        if (!times.hasOwnProperty(action)) {
            times[action] = [];
        }

        times[action].push({
            idle: startTime - enqueueTime,
            executing: finishTime - startTime
        });
    };

    /**
     * Log a summary of the given action times to the console.
     * 
     * @private
     * @param {string} prop Either "idle" or "executing"
     */
    var _printActionTimes = function (prop) {
        var allTimes = Object.keys(_actionTimes)
            .reduce(function (allActions, moduleName) {
                var times = _actionTimes[moduleName];
                Object.keys(times).forEach(function (actionName) {
                    allActions[moduleName + "." + actionName] = times[actionName];
                });
                return allActions;
            }, {});

        var sum = function (a, b) {
            return a + b;
        };

        var timeTable = Object.keys(allTimes).map(function (action) {
            var times = allTimes[action],
                count = times.length,
                values = _.pluck(times, prop).sort(),
                max = _.max(values),
                med = values[Math.floor(values.length / 2)],
                min = _.min(values),
                total = _.reduce(values, sum),
                avg = total / count;

            return {
                action: action,
                count: count,
                total: total,
                max: max,
                med: med,
                avg: avg,
                min: min
            };
        });

        log.table(timeTable);
        log.debug("Total: %d actions in %dms", _.size(timeTable),
            _.chain(timeTable).pluck("total").reduce(sum).value());
    };

    /**
     * Log a summary of action idle times to the console.
     */
    var printIdleTimes = function () {
        _printActionTimes("idle");
    };

    /**
     * Log a summary of action execution times to the console.
     */
    var printExecTimes = function () {
        _printActionTimes("executing");
    };

    // TODO: occasionally save these records in localStorage, and restore them
    // in memory from localStorage on startup.

    exports.recordAction = recordAction;
    exports.printIdleTimes = printIdleTimes;
    exports.printExecTimes = printExecTimes;
    exports._actionTimes = _actionTimes;
});
