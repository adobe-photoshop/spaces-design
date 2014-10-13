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

    var Promise = require("bluebird"),
        _ = require("lodash");

    var AsyncDependencyQueue = require("./async-dependency-queue"),
        performance = require("./performance"),
        locks = require("../locks"),
        log = require("./log");

    var cores = navigator.hardwareConcurrency || 8,
        actionQueue = new AsyncDependencyQueue(cores);

    /**
     * Determines whether the first array is a non-strict subset of the second.
     * 
     * @private
     * @param {Array.<*>} arr1
     * @param {Array.<*>} arr2
     * @return {boolean} True if the first array is a subset of the second.
     */
    var _subseteq = function (arr1, arr2) {
        return _.difference(arr1, arr2).length === 0;
    };

    /**
     * Safely transfer control of from action with the given read and write locks
     * to another action, confirm that that action doesn't require additional 
     * locks, and preserving the receiver of that action.
     * 
     * @param {Array.<string>} currentReads Read locks acquired on behalf of
     *  the current action
     * @param {Array.<string>} currentWrites Write locks acquired on behalf of
     *  the current action
     * @param {{command: function():Promise, reads: Array.<string>=, writes: Array.<string>=}} nextAction
     * @return {Promise} The result of executing the next action
     */
    var _transfer = function (currentReads, currentWrites, nextAction) {
        if (!nextAction || !nextAction.hasOwnProperty("command")) {
            throw new Error("Incorrect next action; passed command directly?");
        }

        // Always interpret the set of read locks as the union of read and write locks
        currentReads = _.union(currentReads, currentWrites);

        var nextReads = _.union(nextAction.reads, nextAction.writes) || locks.ALL_LOCKS;
        if (!_subseteq(nextReads, currentReads)) {
            throw new Error("Next action requires additional read locks");
        }

        var nextWrites = nextAction.writes || locks.ALL_LOCKS;
        if (!_subseteq(nextWrites, currentWrites)) {
            throw new Error("Next action requires additional write locks");
        }
        
        var params = Array.prototype.slice.call(arguments, 3);
        return nextAction.command.apply(this, params);
    };

    /**
     * Given a promise-returning method, returns a synchronized function that
     * enqueues an application of that method.
     * 
     * @param {string} namespace
     * @param {object} module
     * @param {string} name The name of the function in the module
     * @return {function(): Promise}
     */
    var synchronize = function (namespace, module, name) {
        return function () {
            var action = module[name],
                actionName = namespace + "." + name,
                fn = action.command,
                reads = action.reads || locks.ALL_LOCKS,
                writes = action.writes || locks.ALL_LOCKS,
                args = Array.prototype.slice.call(arguments, 0),
                enqueued = Date.now();

            // The receiver of the action command, augmented to include a transfer
            // function that allows it to safely transfer control to another action
            var actionReceiver = Object.create(this, {
                transfer: {
                    value: function () {
                        var params = Array.prototype.slice.call(arguments);
                        params.unshift(reads, writes);
                        return _transfer.apply(actionReceiver, params);
                    }
                }
            });

            var jobPromise = actionQueue.push(function () {
                var start = Date.now();

                log.debug("Executing action %s after waiting %dms; %d/%d",
                    actionName, start - enqueued, actionQueue.active(), actionQueue.pending());

                return fn.apply(this, args)
                    .catch(function (err) {
                        log.error("Action %s failed", actionName, err);
                    })
                    .finally(function () {
                        var finished = Date.now(),
                            elapsed = finished - start,
                            total = finished - enqueued;

                        log.debug("Finished action %s in %dms with RTT %dms; %d/%d",
                            actionName, elapsed, total, actionQueue.active(), actionQueue.pending());

                        performance.recordAction(namespace, name, enqueued, start, finished);
                    });
            }.bind(actionReceiver), reads, writes);

            log.debug("Enqueued action %s; %d/%d",
                actionName, actionQueue.active(), actionQueue.pending());

            return jobPromise;
        };
    };

    /**
     * Given a module, returns a copy in which the methods have been synchronized.
     * 
     * @param {string} namespace
     * @param {object} module
     * @return {object} The synchronized module
     */
    var synchronizeModule = function (namespace, module) {
        return Object.keys(module).reduce(function (exports, name) {
            exports[name] = synchronize(namespace, module, name);

            return exports;
        }, {});
    };

    /**
     * Given an object of modules, returns a copy of the object in which all
     * the modules have been synchronized.
     *
     * @param {object} modules
     * @return {object} An object of synchronized modules
     */
    var synchronizeAllModules = function (modules) {
        return Object.keys(modules).reduce(function (exports, moduleName) {
            var rawModule = modules[moduleName];

            exports[moduleName] = synchronizeModule(moduleName, rawModule);

            return exports;
        }, {});
    };

    /**
     * Build a debounced version of the provided function. If the debounced
     * function is called while a previous call is still in progress, the following
     * call will wait for the original call to complete. If the debounced function
     * is called multiple times while waiting, only one call will occur with the
     * arguments of the final call. Following calls can optionally be delayed by
     * a given number of milliseconds.
     *
     * @param {function(*):Promise=} fn The function to debounce. May either return
     *  a promise, or undefined.
     * @param {object=} receiver Optional receiver for the debounced function.
     * @param {number=} delay Optional number of milliseconds to delay successive
     *  calls.
     * @return {function(*)} The debounced function.
     */
    var debounce = function (fn, receiver, delay) {
        var promise = null,
            pending = null;

        // Handle omitted receiver
        if (typeof receiver === "number") {
            delay = receiver;
            receiver = undefined;
        }

        // Handle omitted delay
        delay = delay || 0;

        var debouncedFn = function () {
            if (!promise) {
                promise = (fn.apply(receiver, arguments) || Promise.resolve())
                    .delay(delay)
                    .finally(function () {
                        promise = null;
                        if (pending) {
                            debouncedFn.apply(receiver, pending);
                        }
                    });
                pending = null;
            } else {
                pending = arguments;
            }
        }.bind(this);

        return debouncedFn;
    };

    exports.synchronizeAllModules = synchronizeAllModules;
    exports.debounce = debounce;
});
