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

    var Fluxxor = require("fluxxor"),
        Promise = require("bluebird");

    var storeIndex = require("./stores/index"),
        actionIndex = require("./actions/index"),
        synchronization = require("./util/synchronization");

    /** 
     * The main Fluxxor instance.
     * @private
     * @type {?Fluxxor.Flux}
     */
    var _flux = null;

    /**
     * @private
     * @type {boolean} Whether the flux instance is running
     */
    var _running = false;

    /**
     * Priority order comparator for action modules.
     * 
     * @private
     * @param {string} moduleName1
     * @param {string} moduleName2
     * @return number
     */
    var _actionModuleComparator = function (moduleName1, moduleName2) {
        var module1 = actionIndex[moduleName1],
            module2 = actionIndex[moduleName2],
            priority1 = module1._priority || 0,
            priority2 = module2._priority || 0;

        // sort modules in descending priority order
        return priority2 - priority1;
    };

    /**
     * Invoke the given method, if it exists, on all action modules in priority
     * order.
     * 
     * @private
     * @param {string} methodName The method to invoke on each action module
     * @return {Promise} Resolves once all the applied methods have resolved
     */
    var _invokeActionMethods = function (methodName) {
        var allMethodPromises = Object.keys(actionIndex)
            .filter(function (moduleName) {
                return _flux.actions[moduleName].hasOwnProperty(methodName);
            })
            .sort(_actionModuleComparator)
            .map(function (moduleName) {
                var module = _flux.actions[moduleName];
                return module[methodName].call(module);
            });

        return Promise.all(allMethodPromises);
    };

    /**
     * Start the flux instance by starting up all action modules.
     * 
     * @return {Promise} Resolves once all the action module startup routines
     *  are complete.
     */
    var start = function () {
        if (_running) {
            return Promise.reject("The flux instance is already running");
        }

        return _invokeActionMethods("onStartup").then(function () {
            _running = true;
        });
    };

    /**
     * Stop the flux instance by shutting down all action modules.
     * 
     * @return {Promise} Resolves once all the action module shutdown routines
     *  are complete.
     */
    var stop = function () {
        if (!_running) {
            return Promise.reject("The flux instance is not running");
        }

        return _invokeActionMethods("onShutdown").then(function () {
            _running = false;
        });
    };

    /**
     * @private
     * @type {boolean} Whether there is a reset pending
     */
    var _resetPending = false;
    
    /**
     * @private
     * @const
     * @type {number} Initial reset retry delay
     */
    var _resetRetryDelayInitial = 200;

    /**
     * @private
     * @type {number} Current reset retry delay. Increases exponentially until quiesence.
     */
    var _resetRetryDelay = _resetRetryDelayInitial;

    /**
     * Invoke the reset method on all action modules with an increasing delay.
     * Reset the delay upon quiesence.
     * 
     * @return {Promise}
     */
    var _resetWithDelay = function () {
        var retryDelay = _resetRetryDelay;

        // double the delay for the next re-entrant reset
        _resetRetryDelay *= 2;
        _resetPending = false;

        return _invokeActionMethods("onReset")
            .delay(retryDelay)
            .finally(function () {
                if (!_resetPending) {
                    // reset the delay if there have been no re-entrant resets
                    _resetRetryDelay = _resetRetryDelayInitial;
                }
            });
    };

    /**
     * @private
     * @type {function()} Progressively throttled reset helper function
     */
    var _resetHelper;

    /**
     * Attempt to reset all action modules.
     */
    var reset = function () {
        if (!_running) {
            throw new Error("The flux instance is not running");
        }

        _resetPending = true;
        _resetHelper();
    };

    /**
     * Initialize the Fluxxor instance.
     */
    var init = function () {
        if (_flux) {
            throw new Error("Flux has already been initialized");
        }

        var stores = storeIndex.create(),
            actions = synchronization.synchronizeAllModules(actionIndex);
            
        _flux = new Fluxxor.Flux(stores, actions);
        _resetHelper = synchronization.debounce(_resetWithDelay);
    };

    /**
     * Get the Fluxxor instance.
     *
     * @return {?Fluxxor.Flux}
     */
    var getInstance = function () {
        return _flux;
    };

    exports.init = init;
    exports.start = start;
    exports.stop = stop;
    exports.reset = reset;
    exports.getInstance = getInstance;
});
