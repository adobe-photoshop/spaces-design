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
        Promise = require("bluebird"),
        EventEmitter = require("eventEmitter"),
        util = require("adapter/util");

    var storeIndex = require("./stores/index"),
        actionIndex = require("./actions/index"),
        synchronization = require("./util/synchronization");

    /**
     * Manages the lifecycle of a Fluxxor instance.
     *
     * @constructor
     */
    var FluxController = function () {
        EventEmitter.call(this);
        var stores = storeIndex.create(),
            actions = synchronization.synchronizeAllModules(actionIndex);
            
        this._flux = new Fluxxor.Flux(stores, actions);
        this._resetHelper = synchronization.debounce(this._resetWithDelay, undefined, this);
    };
    util.inherits(FluxController, EventEmitter);

    /** 
     * The main Fluxxor instance.
     * @private
     * @type {?Fluxxor.Flux}
     */
    FluxController.prototype._flux = null;

    Object.defineProperty(FluxController.prototype, "flux", {
        enumerable: true,
        get: function () { return this._flux; }
    });


    /**
     * @private
     * @type {boolean} Whether the flux instance is running
     */
    FluxController.prototype._running = false;

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
    FluxController.prototype._invokeActionMethods = function (methodName) {
        var allMethodPromises = Object.keys(actionIndex)
            .filter(function (moduleName) {
                return this._flux.actions[moduleName].hasOwnProperty(methodName);
            }, this)
            .sort(_actionModuleComparator)
            .map(function (moduleName) {
                var module = this._flux.actions[moduleName];
                return module[methodName].call(module);
            }, this);

        return Promise.all(allMethodPromises);
    };

    /**
     * Start the flux instance by starting up all action modules.
     * 
     * @return {Promise} Resolves once all the action module startup routines
     *  are complete.
     */
    FluxController.prototype.start = function () {
        if (this._running) {
            return Promise.reject("The flux instance is already running");
        }

        return this._invokeActionMethods("onStartup")
            .bind(this)
            .then(function () {
                this._running = true;
                this.emit("started");
            });
    };

    /**
     * Stop the flux instance by shutting down all action modules.
     * 
     * @return {Promise} Resolves once all the action module shutdown routines
     *  are complete.
     */
    FluxController.prototype.stop = function () {
        if (this._running) {
            return Promise.reject("The flux instance is not running");
        }

        return this._invokeActionMethods("onShutdown")
            .bind()
            .then(function () {
                this._running = false;
                this.emit("stopped");
            });
    };

    /**
     * @private
     * @type {boolean} Whether there is a reset pending
     */
    FluxController.prototype._resetPending = false;
    
    /**
     * @private
     * @const
     * @type {number} Initial reset retry delay
     */
    FluxController.prototype._resetRetryDelayInitial = 200;

    /**
     * @private
     * @type {number} Current reset retry delay. Increases exponentially until quiescence.
     */
    FluxController.prototype._resetRetryDelay = FluxController.prototype._resetRetryDelayInitial;

    /**
     * Invoke the reset method on all action modules with an increasing delay.
     * Reset the delay upon quiesence.
     * 
     * @return {Promise}
     */
    FluxController.prototype._resetWithDelay = function () {
        var retryDelay = this._resetRetryDelay;

        // double the delay for the next re-entrant reset
        this._resetRetryDelay *= 2;
        this._resetPending = false;

        return this._invokeActionMethods("onReset")
            .bind(this)
            .delay(retryDelay)
            .finally(function () {
                if (!this._resetPending) {
                    // reset the delay if there have been no re-entrant resets
                    this._resetRetryDelay = this._resetRetryDelayInitial;
                }
            });
    };

    /**
     * @private
     * @type {function()} Progressively throttled reset helper function
     */
    FluxController.prototype._resetHelper = null;

    /**
     * Attempt to reset all action modules.
     */
    FluxController.prototype.reset = function () {
        if (!this._running) {
            throw new Error("The flux instance is not running");
        }

        this._resetPending = true;
        this._resetHelper();
    };

    module.exports = FluxController;
});
