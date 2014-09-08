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

    var AsyncDependencyQueue = require("js/util/async-dependency-queue"),
        log = require("js/util/log");

    var cores = navigator.hardwareConcurrency || 8,
        actionQueue = new AsyncDependencyQueue(cores);

    /**
     * The set of available locks, each of which corresponds to a distinct
     * resource.
     * 
     * @type {{string: string}}
     */
    var LOCKS = {
        APP: "app"
    };

    /**
     * An array of all availble locks. If an action does not specify a
     * particular set of locks, all locks are assumed.
     * 
     * @type {Array.<string>}
     */
    var ALL_LOCKS = _.values(LOCKS);


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
            var action = module[name],
                fn = action.command,
                reads = action.reads || ALL_LOCKS,
                writes = action.writes || ALL_LOCKS,
                args = Array.prototype.slice.call(arguments, 0),
                enqueued = Date.now();

            actionQueue.push(function () {
                var start = Date.now();

                log.debug("Executing action %s after waiting %dms", name, start - enqueued);

                return fn.apply(this, args)
                    .finally(function () {
                        var finished = Date.now(),
                            elapsed = finished - start,
                            total = finished - enqueued;

                        log.debug("Finished action %s in %dms with RTT %dms", name, elapsed, total);
                    });
            }.bind(this), reads, writes);

            log.debug("Enqueued action %s behind %d", name, actionQueue.length());
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

    exports.synchronizeAllModules = synchronizeAllModules;
    exports.LOCKS = LOCKS;
    exports.ALL_LOCKS = ALL_LOCKS;
});
