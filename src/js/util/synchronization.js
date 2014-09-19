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

    var AsyncDependencyQueue = require("./async-dependency-queue"),
        performance = require("./performance"),
        locks = require("../locks"),
        log = require("./log");

    var cores = navigator.hardwareConcurrency || 8,
        actionQueue = new AsyncDependencyQueue(cores);

    /**
     * Given a promise-returning method, returns a synchronized function that
     * enqueues an application of that method.
     * 
     * @param {string} namespace
     * @param {object} module
     * @param {string} name The name of the function in the module
     * @return {function}
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

            actionQueue.push(function () {
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
            }.bind(this), reads, writes);

            log.debug("Enqueued action %s; %d/%d",
                actionName, actionQueue.active(), actionQueue.pending());
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

    exports.synchronizeAllModules = synchronizeAllModules;
});
