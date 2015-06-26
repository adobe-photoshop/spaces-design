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
        events = require("./events"),
        storeIndex = require("./stores/index"),
        actionIndex = require("./actions/index"),
        AsyncDependencyQueue = require("./util/async-dependency-queue"),
        synchronization = require("./util/synchronization"),
        performance = require("./util/performance"),
        log = require("./util/log"),
        global = require("./util/global");

    /**
     * Suffix used to name throttled actions.
     * 
     * @const
     * @type {string} 
     */
    var THROTTLED_ACTION_SUFFIX = "Throttled";


    /**
     * Maximum delay after which reset retry will continue
     *  before failing definitively.
     *  
     * @const
     * @type {number} 
     */
    var MAX_RETRY_WINDOW = 6400;

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
     * Manages the lifecycle of a Fluxxor instance.
     *
     * @constructor
     */
    var FluxController = function (testStores) {
        EventEmitter.call(this);

        var cores = window.navigator.hardwareConcurrency || 8;
        this._actionQueue = new AsyncDependencyQueue(cores);

        var actions = this._synchronizeAllModules(actionIndex),
            stores = storeIndex.create(),
            allStores = _.merge(stores, testStores || {});

        this._flux = new Fluxxor.Flux(allStores, actions);
        this._resetHelper = synchronization.throttle(this._resetWithDelay, this);
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
     * Whether the flux instance is running
     * @private
     * @type {boolean} 
     */
    FluxController.prototype._running = false;

    /**
     * Used to synchronize flux action execution
     * 
     * @private
     * @type {ActionQueue} 
     */
    FluxController.prototype._actionQueue = null;

    /**
     * Per-action cache of action receivers
     * 
     * @private
     * @type {Map.<Action, ActionReceiver>} 
     */
    FluxController.prototype._actionReceivers = null;

    Object.defineProperties(FluxController.prototype, {
        "flux": {
            enumerable: true,
            get: function () {
                return this._flux;
            }
        },
        "active": {
            enumerable: true,
            get: function () {
                return this._running && !this._resetPending;
            }
        }
    });

    /**
     * Construct a receiver for the given action that augments the standard
     * Fluxxor "dispatch binder" with additional action-specific helper methods.
     *
     * @private
     * @param {object} proto Fluxxor dispatch binder
     * @param {Action} action Action definition
     * @param {string} actionName The fully qualified action name (i.e., "module.action")
     * @return {ActionReceiver}
     */
    FluxController.prototype._makeActionReceiver = function (proto, action, actionName) {
        var currentReads = action.reads || locks.ALL_LOCKS,
            currentWrites = action.writes || locks.ALL_LOCKS,
            self = this,
            resolvedPromise;

        // Always interpret the set of read locks as the union of read and write locks
        currentReads = _.union(currentReads, currentWrites);

        var receiver = Object.create(proto, {
            /**
             * Provides direct controller access to actions
             * @type {FluxController} 
             */
            controller: {
                value: self
            },

            /**
             * The name of this action
             * @type {string} 
             */
            actionName: {
                value: actionName
            },

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
                    if (!nextAction || (typeof nextAction !== "function")) {
                        throw new Error("Transfer passed an undefined action");
                    }

                    var nextReads = _.union(nextAction.reads, nextAction.writes) || locks.ALL_LOCKS;
                    if (!_subseteq(nextReads, currentReads)) {
                        log.error("Missing read locks:", _.difference(nextReads, currentReads).join(", "));
                        throw new Error("Next action requires additional read locks");
                    }

                    var nextWrites = nextAction.writes || locks.ALL_LOCKS;
                    if (!_subseteq(nextWrites, currentWrites)) {
                        log.error("Missing write locks:", _.difference(nextWrites, currentWrites).join(", "));
                        throw new Error("Next action requires additional write locks");
                    }

                    var lockUI = nextAction.lockUI;
                    if (lockUI) {
                        self.emit("lock");
                    }
    
                    var params = Array.prototype.slice.call(arguments, 1);
                    return self._applyAction(nextAction, this, params);
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
     * Get an action receiver for the given action, creating it if necessary.
     *
     * @param {{flux: Flux, dispatch: function}} proto Fluxxor "dispatch binder",
     *  which is used as the prototype for the action receiver.
     * @param {Action} action
     * @return {ActionReceiver}
     */
    FluxController.prototype._getActionReceiver = function (proto, action, actionName) {
        var receiver = this._actionReceivers.get(action);
        if (!receiver) {
            receiver = this._makeActionReceiver(proto, action, actionName);
            this._actionReceivers.set(action, receiver);
        }

        return receiver;
    };

    /**
     * Apply the given action, bound to the given action receiver, to
     * the given actual parameters. Verifies any postconditions defined as part
     * of the action.
     *
     * @param {Action} action
     * @param {ActionReceiver} actionReceiver
     * @param {Array.<*>} params
     * @return {Promise}
     */
    FluxController.prototype._applyAction = function (action, actionReceiver, params) {
        var lockUI = action.lockUI,
            post = action.post,
            parentActionName = actionReceiver.actionName,
            actionName = action.id,
            actionTitle = "action " + parentActionName;

        if (parentActionName !== actionName) {
            actionTitle = "sub-action " + actionName + " of " + actionTitle;
        }

        var actionPromise = action.apply(actionReceiver, params);
        if (!(actionPromise instanceof Promise)) {
            var valueError = new Error("Action " + actionName + " did not return a promise");
            valueError.returnValue = actionPromise;
            actionPromise = Promise.reject(valueError);
        }

        if (lockUI) {
            this.emit("lock");
        }

        return actionPromise
            .bind(this)
            .tap(function () {
                if (global.debug && post && post.length > 0) {
                    var postStart = Date.now(),
                        postTitle = post.length + " postcondition" + (post.length > 1 ? "s" : "");

                    log.debug("Verifying " + postTitle + " for " + actionTitle);

                    var postPromises = post.map(function (conjunct, index) {
                        return conjunct.apply(this)
                            .catch(function () {
                                log.error("Verification of postcondition " + index + " failed for " + actionTitle);
                            });
                    }, this);

                    return Promise.all(postPromises)
                        .then(function () {
                            var postElapsed = Date.now() - postStart;
                            log.debug("Verified " + postTitle + " for " + actionTitle +
                                " in " + postElapsed + "ms");
                        });
                }
            })
            .tap(function () {
                if (lockUI) {
                    this.emit("unlock");
                }
            });
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
            reads = action.reads || locks.ALL_LOCKS,
            writes = action.writes || locks.ALL_LOCKS,
            modal = action.modal || false;

        action.id = actionName;

        return function () {
            var args = Array.prototype.slice.call(arguments, 0),
                enqueued = Date.now();

            // The receiver of the action, augmented to include a transfer
            // function that allows it to safely transfer control to another action
            var actionReceiver = self._getActionReceiver(this, action, actionName);

            log.debug("Enqueuing action %s; %d/%d",
                actionName, actionQueue.active(), actionQueue.pending());

            var jobPromise = actionQueue.push(function () {
                var start = Date.now(),
                    toolStore = this.flux.store("tool"),
                    modalPromise;

                if (toolStore.getModalToolState() && !modal) {
                    log.debug("Killing modal state for action %s", actionName);
                    modalPromise = ps.endModalToolState(true);
                } else {
                    modalPromise = Promise.resolve();
                }

                return modalPromise
                    .bind(this)
                    .then(function () {
                        log.debug("Executing action %s after waiting %dms; %d/%d",
                            actionName, start - enqueued, actionQueue.active(), actionQueue.pending());

                        return this._applyAction(action, actionReceiver, args);
                    })
                    .tap(function () {
                        var finished = Date.now(),
                            elapsed = finished - start,
                            total = finished - enqueued;

                        log.debug("Finished action %s in %dms with RTT %dms; %d/%d",
                            actionName, elapsed, total, actionQueue.active(), actionQueue.pending());

                        if (global.debug) {
                            performance.recordAction(namespace, name, enqueued, start, finished);
                        }
                    })
                    .catch(function (err) {
                        var message = err instanceof Error ? (err.stack || err.message) : err;

                        log.error("Action " + actionName + " failed:", message);

                        // Reset all action modules on failure
                        this._reset(err);
                        throw err;
                    });
            }.bind(self), reads, writes, actionName);

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

            var throttledName = name + THROTTLED_ACTION_SUFFIX,
                synchronizedAction = this._synchronize(namespace, module, name),
                throttledAction = synchronization.throttle(synchronizedAction);

            exports[name] = synchronizedAction;
            exports[throttledName] = throttledAction;

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
     * @param {Object.<string,*>|*} params Either a mapping from module name
     *  to parameter value, or a constant value applied to all methods.
     * @return {Promise} Resolves once all the applied methods have resolved
     */
    FluxController.prototype._invokeActionMethods = function (methodName, params) {
        var getParam = function (name) {
            if (typeof params === "object") {
                return params[name];
            } else {
                return params;
            }
        };

        var allMethodPromises = Object.keys(actionIndex)
                .filter(function (moduleName) {
                    if (this._flux.actions[moduleName].hasOwnProperty(methodName)) {
                        return true;
                    }
                }, this)
                .sort(_actionModuleComparator)
                .map(function (moduleName) {
                    var module = this._flux.actions[moduleName],
                        methodPromise = module[methodName].call(module, getParam(moduleName));

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

        var beforeStartupPromise = this._invokeActionMethods("beforeStartup");

        beforeStartupPromise
            .bind(this)
            .then(function (results) {
                this.emit("ready");
                return this._invokeActionMethods("afterStartup", results);
            })
            .then(function () {
                this._running = true;
            });

        return beforeStartupPromise;
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

        this._running = false;
        this.emit("lock");

        return this._invokeActionMethods("onShutdown");
    };

    /**
     * Checks to see if an action with the given name is currently in queue
     *
     * @param {string} name module + action name e.g. "tools.selectTool"
     *
     * @return {Boolean} True if an instance of the action is in pending queue
     */
    FluxController.prototype.isActionQueued = function (name) {
        return !!this._actionQueue.findPending(name);
    };

    /**
     * Checks to see if an action with the given name is currently being processed
     *
     * @param {string} name module + action name e.g. "tools.selectTool"
     *
     * @return {Boolean} True if an instance of the action is running
     */
    FluxController.prototype.isActionActive = function (name) {
        return !!this._actionQueue.findActive(name);
    };

    /**
     * Whether there is a reset pending
     * @private
     * @type {boolean} 
     */
    FluxController.prototype._resetPending = false;
    
    /**
     * Initial reset retry delay
     * @private
     * @const
     * @type {number} 
     */
    FluxController.prototype._resetRetryDelayInitial = 200;

    /**
     * Current reset retry delay. Increases exponentially until quiescence.
     * @private
     * @type {number} 
     */
    FluxController.prototype._resetRetryDelay = FluxController.prototype._resetRetryDelayInitial;

    /**
     * Invoke the reset method on all action modules with an increasing delay,
     * followed by the beforeStartup and afterStartup methods.
     * Reset the delay upon quiesence.
     * 
     * @return {Promise}
     */
    FluxController.prototype._resetWithDelay = function () {
        var retryDelay = this._resetRetryDelay,
            flux = this._flux.dispatchBinder;

        // Double the delay for the next re-entrant reset
        this._resetRetryDelay *= 2;

        // Dispatch an event that all stores should listen to to clear their state
        flux.dispatch.call(flux, events.RESET);

        return this._invokeActionMethods("onReset")
            .bind(this)
            .then(this._invokeActionMethods.bind(this, "beforeStartup", true))
            .then(function (results) {
                this.emit("unlock");

                return this._invokeActionMethods("afterStartup", results);
            })
            .then(function () {
                this._resetPending = false;
            })
            .catch(function (err) {
                var message = err instanceof Error ? (err.stack || err.message) : err;

                log.warn("Reset failed:", message);
            })
            .delay(retryDelay)
            .then(function () {
                if (!this._resetPending) {
                    this._resetRetryDelay = this._resetRetryDelayInitial;
                }
            });
    };

    /**
     * Progressively throttled reset helper function
     * @private
     * @type {function()} 
     */
    FluxController.prototype._resetHelper = null;

    /**
     * Attempt to reset all action modules. If this is not possible, emit an
     * "error" event.
     * 
     * @private
     * @param {Error} err
     */
    FluxController.prototype._reset = function (err) {
        this._actionQueue.removeAll();

        if (!this._running || this._resetRetryDelay > MAX_RETRY_WINDOW) {
            this.emit("error", {
                cause: err
            });
            this._resetPending = false;
            this._resetRetryDelay = this._resetRetryDelayInitial;
            return;
        }

        this._resetPending = true;
        this.emit("lock");
        this._resetHelper();
    };

    module.exports = FluxController;
});
