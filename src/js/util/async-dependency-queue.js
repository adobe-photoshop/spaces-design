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

    var EventEmitter = require("eventEmitter"),
        Promise = require("bluebird"),
        _ = require("lodash");

    var util = require("adapter/util");

    /**
     * A pausable queue of asynchronous operations to be executed in sequence.
     * 
     * @constructor
     */
    var AsyncDependencyQueue = function (maxJobs) {
        EventEmitter.call(this);

        this._maxJobs = maxJobs;
        this._pending = [];
        this._current = {};
        this._jobCounter = 0;
    };

    util.inherits(AsyncDependencyQueue, EventEmitter);

    /**
     * A list of pending jobs.
     * 
     * @type {Array.<{fn: function(): Promise>, deferred: Deferred}}
     */
    AsyncDependencyQueue.prototype._pending = null;

    /**
     * The promise for the current executing operation, or null if the queue is
     * quiescent.
     *
     * @type {?Promise}
     */
    AsyncDependencyQueue.prototype._current = null;

    /**
     * Indicates whether or not the queue is paused; i.e., is not consuming and
     * executing additional jobs.
     * 
     * @type {boolean}
     */
    AsyncDependencyQueue.prototype._isPaused = false;

    /**
     * Add a new asynchronous operation to the queue.
     * 
     * @param {function(): Promise} fn
     */
    AsyncDependencyQueue.prototype.push = function (fn, reads, writes) {
        // Ensure that the read set subsumes the write set
        reads = _.union(reads, writes);

        return new Promise(function (resolve, reject) {
            var deferred = {
                resolve: resolve,
                reject: reject
            },
            job = {
                id: this._jobCounter++,
                fn: fn,
                reads: reads,
                writes: writes,
                deferred: deferred
            };

            this._pending.push(job);

            if (this._pending.length === 1 && !this._isPaused) {
                this._processNext();
            }
        }.bind(this));
    };

    /**
     * Remove all operations from the queue. Does not affect the currently executing operaiton.
     */
    AsyncDependencyQueue.prototype.removeAll = function () {
        this._pending.forEach(function (job) {
            job.deferred.reject();
        });

        this._pending.length = 0;
    };

    AsyncDependencyQueue.prototype._checkLockConflicts = function (set, lock) {
        // TODO: it would be more effficient to also maintain a set of currently
        // held read and write locks instead of just traversing all the current
        // jobs and inspecting their read and write locks
        var ids = Object.keys(this._current);
        return ids.some(function (id) {
            var job = this._current[id],
                lockSet = job[set];

            return lockSet.some(function (heldLock) {
                return heldLock === lock;
            });
        }, this);
    };

    AsyncDependencyQueue.prototype._checkLockSetConflicts = function (set, locks) {
        return locks.some(function (lock) {
            return this._checkLockConflicts(set, lock);
        }, this);
    };

    AsyncDependencyQueue.prototype._checkWriteConflicts = function (writes) {
        return this._checkLockSetConflicts("reads", writes);
    };

    AsyncDependencyQueue.prototype._checkReadConflicts = function (reads) {
        return this._checkLockSetConflicts("writes", reads);
    };

    AsyncDependencyQueue.prototype._pickJob = function () {
        var length = this._pending.length,
            job, index, reads, writes;

        for (index = 0; index < length; index++) {
            job = this._pending[index];
            reads = job.reads;
            writes = job.writes;

            // confirm that no reads or writes are in progress for the write set
            if (this._checkWriteConflicts(writes)) {
                continue;
            }

            // confirm that no writes are in progress for the read set
            if (this._checkReadConflicts(reads)) {
                continue;
            }

            this._pending.splice(index, 1);
            return job;
        }

        return null;
    };

    /**
     * Execute the next job in the queue, if any.
     * 
     * @private
     */
    AsyncDependencyQueue.prototype._processNext = function () {
        if (this._pending.length === 0) {
            return;
        }
        
        var ids = Object.keys(this._current);
        if (ids.length >= this._maxJobs) {
            return;
        }

        var job = this._pickJob();
        if (!job) {
            return;
        }

        this._current[job.id] = job;
        job.promise = job.fn()
            .bind(this)
            .catch(function (err) {
                this.emit("error", err);
            })
            .finally(function () {
                job.deferred.resolve();
                delete this._current[job.id];

                if (!this._isPaused) {
                    this._processNext();
                }
            })
            .done();

        this._processNext();
    };

    /**
     * Pause the queue, returning a promise that resolves when the queue has
     * quiesced. If there is no currently executing job, the promise is returned
     * as resolved. Otherwise, it resolves when the currently executing job is
     * complete.
     * 
     * @return {Promise}
     */
    AsyncDependencyQueue.prototype.pause = function () {
        this._isPaused = true;

        var ids = Object.keys(this._current);
        if (ids.length > 0) {
            return Promise.settle(ids.map(function (id) {
                return this._current[id].promise;
            }, this));
        } else {
            return Promise.resolve();
        }
    };

    /**
     * Unpause the queue, continuing to process the existing jobs.
     */
    AsyncDependencyQueue.prototype.unpause = function () {
        this._isPaused = false;

        var ids = Object.keys(this._current);
        if (ids.length > 0) {
            this._processNext();
        }
    };

    AsyncDependencyQueue.prototype.length = function () {
        return this._pending.length;
    };

    module.exports = AsyncDependencyQueue;
});
