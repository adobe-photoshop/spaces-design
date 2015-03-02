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
        _ = require("lodash");

    var ps = require("adapter/ps"),
        util = require("adapter/util");

    var locks = require("./locks"),
        storeIndex = require("./stores/index"),
        actionIndex = require("./actions/index"),
        AsyncDependencyQueue = require("./util/async-dependency-queue"),
        synchronization = require("./util/synchronization"),
        performance = require("./util/performance"),
        log = require("./util/log");

    /**
     * @const
     * @type {string} Suffix used to name debounced actions.
     */
    var DEBOUNCED_ACTION_SUFFIX = "Debounced";

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
     * Construct a receiver for the given action that augments the standard
     * Fluxxor "dispatch binder" with additional action-specific helper methods.
     *
     * @private
     * @param {object} proto Fluxxor dispatch binder
     * @param {Action} action
     * @return {ActionReceiver}
     */
    var _makeActionReceiver = function (proto, action) {
        var currentReads = action.reads || locks.ALL_LOCKS,
            currentWrites = action.writes || locks.ALL_LOCKS,
            resolvedPromise;

        // Always interpret the set of read locks as the union of read and write locks
        currentReads = _.union(currentReads, currentWrites);

        var receiver = Object.create(proto, {
            /**
             * Safely transfer control from this action to another action, confirming
             * that that action doesn't require additional locks, and preserving the
             * receiver of that action.
             *
             * @param {Action} nextAction
             * @return {Promise} The result of executing the next action
             */
            transfer: {
                value: function (nextAction) {
                    if (!nextAction || !nextAction.hasOwnProperty("command")) {
                        throw new Error("Incorrect next action; passed command directly?");
                    }

                    var nextReads = _.union(nextAction.reads, nextAction.writes) || locks.ALL_LOCKS;
                    if (!_subseteq(nextReads, currentReads)) {
                        log.error("Missing read locks:", _.difference(nextReads, currentReads));
                        throw new Error("Next action requires additional read locks");
                    }

                    var nextWrites = nextAction.writes || locks.ALL_LOCKS;
                    if (!_subseteq(nextWrites, currentWrites)) {
                        log.error("Missing write locks:", _.difference(nextWrites, currentWrites));
                        throw new Error("Next action requires additional write locks");
                    }

                    var params = Array.prototype.slice.call(arguments, 1);
                    return nextAction.command.apply(this, params);
                }
            },

            /**
             * Dispatch an event using the Flux dispatcher on the next tick of the event loop.
             *
             * @param {string} event
             * @param {object=} payload
             * @return {Promise} Resolves immediately
             */
            dispatchAsync: {
                value: function (event, payload) {
                    return resolvedPromise.then(function () {
                        this.dispatch(event, payload);
                    });
                }
            }
        });

        resolvedPromise = Promise.bind(receiver);
        return receiver;
    };

    /**
     * Manages the lifecycle of a Fluxxor instance.
     *
     * @constructor
     */
    var FluxController = function (testStores) {
        EventEmitter.call(this);

        var cores = navigator.hardwareConcurrency || 8;
        this._actionQueue = new AsyncDependencyQueue(cores);

        var actions = this._synchronizeAllModules(actionIndex),
            stores = storeIndex.create(),
            allStores = _.merge(stores, testStores || {});

        this._flux = new Fluxxor.Flux(allStores, actions);
        this._resetHelper = synchronization.debounce(this._resetWithDelay, this);
        this._actionReceivers = new Map();
    };
    util.inherits(FluxController, EventEmitter);

    /** 
     * The main Fluxxor instance.
     * @private
     * @type {?Fluxxor.Flux}
     */
    FluxController.prototype._flux = null;

    /**
     * @private
     * @type {boolean} Whether the flux instance is running
     */
    FluxController.prototype._running = false;

    /**
     * @private
     * @type {ActionQueue} Used to synchronize flux action execution
     */
    FluxController.prototype._actionQueue = null;

    /**
     * @private
     * @type {Map.<Action, ActionReceiver>} Per-action cache of action receivers
     */
    FluxController.prototype._actionReceivers = null;

    Object.defineProperty(FluxController.prototype, "flux", {
        enumerable: true,
        get: function () { return this._flux; }
    });

    /**
     * Get an action receiver for the given action, creating it if necessary.
     *
     * @param {{flux: Flux: dispatch: function}} proto Fluxxor "dispatch binder",
     *  which is used as the prototype for the action receiver.
     * @param {Action} action
     * @return {ActionReceiver}
     */
    FluxController.prototype._getActionReceiver = function (proto, action) {
        var receiver = this._actionReceivers.get(action);
        if (!receiver) {
            receiver = _makeActionReceiver(proto, action);
            this._actionReceivers.set(action, receiver);
        }

        return receiver;
    };

    /**
     * Given a promise-returning method, returns a synchronized function that
     * enqueues an application of that method.
     *
     * @private
     * @param {string} namespace
     * @param {object} module
     * @param {string} name The name of the function in the module
     * @return {function(): Promise}
     */
    FluxController.prototype._synchronize = function (namespace, module, name) {
        var self = this,
            actionQueue = this._actionQueue,
            action = module[name],
            actionName = namespace + "." + name,
            fn = action.command,
            reads = action.reads || locks.ALL_LOCKS,
            writes = action.writes || locks.ALL_LOCKS,
            modal = action.modal || false;

        return function () {
            var toolStore = this.flux.store("tool"),
                args = Array.prototype.slice.call(arguments, 0),
                enqueued = Date.now(),
                actionReceiver = self._getActionReceiver(this, action);
                // The receiver of the action command, augmented to include a transfer
                // function that allows it to safely transfer control to another action

            log.debug("Enqueuing action %s; %d/%d",
                actionName, actionQueue.active(), actionQueue.pending());

            var jobPromise = actionQueue.push(function () {
                var start = Date.now(),
                    valueError;

                var modalPromise;
                if (toolStore.getModalToolState() && !modal) {
                    log.debug("Killing modal state for action %s", actionName);
                    modalPromise = ps.endModalToolState();
                } else {
                    modalPromise = Promise.resolve();
                }

                return modalPromise
                    .bind(this)
                    .then(function () {
                        log.debug("Executing action %s after waiting %dms; %d/%d",
                            actionName, start - enqueued, actionQueue.active(), actionQueue.pending());

                        var actionPromise = fn.apply(this, args);
                        if (!(actionPromise instanceof Promise)) {
                            valueError = new Error("Action did not return a promise");
                            valueError.returnValue = actionPromise;
                            actionPromise = Promise.reject(valueError);
                        }

                        return actionPromise;
                    })
                    .catch(function (err) {
                        log.error("Action %s failed:", actionName, err.message);
                        log.debug("Stack trace:", err.stack);

                        // Reset all action modules on failure
                        self.reset();
                    })
                    .finally(function () {
                        var finished = Date.now(),
                            elapsed = finished - start,
                            total = finished - enqueued;

                        log.debug("Finished action %s in %dms with RTT %dms; %d/%d",
                            actionName, elapsed, total, actionQueue.active(), actionQueue.pending());

                        if (window.__PG_DEBUG__) {
                            performance.recordAction(namespace, name, enqueued, start, finished);
                        }
                    });
            }.bind(actionReceiver), reads, writes);

            return jobPromise;
        };
    };

    /**
     * Given a module, returns a copy in which the methods have been synchronized.
     *
     * @private
     * @param {string} namespace
     * @param {object} module
     * @return {object} The synchronized module
     */
    FluxController.prototype._synchronizeModule = function (namespace, module) {
        return Object.keys(module).reduce(function (exports, name) {
            // Ignore underscore-prefixed exports
            if (name[0] === "_") {
                exports[name] = module[name];
                return exports;
            }

            var debouncedName = name + DEBOUNCED_ACTION_SUFFIX,
                synchronizedAction = this._synchronize(namespace, module, name),
                debouncedAction = synchronization.debounce(synchronizedAction);

            exports[name] = synchronizedAction;
            exports[debouncedName] = debouncedAction;

            return exports;
        }.bind(this), {});
    };

    /**
     * Given an object of modules, returns a copy of the object in which all
     * the modules have been synchronized.
     *
     * @private
     * @param {object} modules
     * @return {object} An object of synchronized modules
     */
    FluxController.prototype._synchronizeAllModules = function (modules) {
        return Object.keys(modules).reduce(function (exports, moduleName) {
            var rawModule = modules[moduleName];

            exports[moduleName] = this._synchronizeModule(moduleName, rawModule);

            return exports;
        }.bind(this), {});
    };

    /**
     * Invoke the given method, if it exists, on all action modules in priority
     * order.
     * 
     * @private
     * @param {string} methodName The method to invoke on each action module
     * @return {Promise} Resolves once all the applied methods have resolved
     */
    FluxController.prototype._invokeActionMethods = function (methodName, params) {
        params = params || {};

        var allMethodPromises = Object.keys(actionIndex)
                .filter(function (moduleName) {
                    if (this._flux.actions[moduleName].hasOwnProperty(methodName)) {
                        return true;
                    }
                }, this)
                .sort(_actionModuleComparator)
                .map(function (moduleName) {
                    var module = this._flux.actions[moduleName],
                        methodPromise = module[methodName].call(module, params[moduleName]);

                    return Promise.all([moduleName, methodPromise]);
                }, this);

        return Promise.all(allMethodPromises)
            .reduce(function (results, result) {
                results[result[0]] = result[1];
                return results;
            }, {});
    };

    /**
     * Start the flux instance by starting up all action modules.
     * 
     * @return {Promise} Resolves once all the action module startup routines
     *  are complete.
     */
    FluxController.prototype.start = function () {
        if (this._running) {
            return Promise.reject(new Error("The flux instance is already running"));
        }

        return this._invokeActionMethods("beforeStartup")
            .bind(this)
            .then(function (results) {
                this._running = true;
                this.emit("started");
                this._invokeActionMethods("afterStartup", results);
            });
    };

    /**
     * Stop the flux instance by shutting down all action modules.
     * 
     * @return {Promise} Resolves once all the action module shutdown routines
     *  are complete.
     */
    FluxController.prototype.stop = function () {
        if (!this._running) {
            return Promise.reject(new Error("The flux instance is not running"));
        }

        return this._invokeActionMethods("onShutdown")
            .bind(this)
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
