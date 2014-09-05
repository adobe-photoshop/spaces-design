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

    var async = require("async");

    var log = require("js/util/log");

    /**
     * An asynchronous queue of actions.
     * 
     * @type {async.queue}
     */
    var actionQueue = async.queue(function (task, callback) {
        var name = task.name,
            receiver = task.receiver,
            fn = task.fn,
            args = task.args,
            enqueued = task.enqueued,
            start = Date.now();

        log.debug("Executing action %s after waiting %dms", name, start - enqueued);

        fn.apply(receiver, args).then(callback.bind(null))
            .catch(callback)
            .finally(function () {
                var finished = Date.now(),
                    elapsed = finished - start,
                    total = finished - enqueued;

                log.debug("Finished action %s in %dms with RTT %dms", name, elapsed, total);
            });
    }, 1);

    /**
     * Given a promise-returning method, returns a synchronized function that
     * enqueues an application of that method.
     * 
     * @param {object} module
     * @param {string} name The name of the function in the module
     * @return {function}
     */
    var synchronize = function (module, name) {
        return function () {
            log.debug("Enqueued action %s behind %d", name, actionQueue.length());

            var task = {
                name: name,
                receiver: this,
                fn: module[name],
                args: Array.prototype.slice.call(arguments, 0),
                enqueued: Date.now()
            };

            actionQueue.push(task);
        };
    };

    /**
     * Given a module, returns a copy in which the methods have been synchronized.
     * 
     * @param {object} module
     * @return {object} The synchronized module
     */
    var synchronizeModule = function (module) {
        return Object.keys(module).reduce(function (exports, name) {
            exports[name] = synchronize(module, name);

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

            exports[moduleName] = synchronizeModule(rawModule);

            return exports;
        }, {});
    };

    var rawModules = {
        dummy: require("./dummy")
    };

    module.exports = synchronizeAllModules(rawModules);
});
