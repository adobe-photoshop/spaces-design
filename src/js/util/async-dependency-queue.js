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
     * A job managed by an AsyncDependencyQueue instance.
     * 
     * @constructor
     * @protected
     * @param {function (): Promise} fn
     * @param {Array.<string>} reads
     * @param {Array.<string>} writes 
     */
    var Job = function (fn, reads, writes) {
        // Ensure that the read set subsumes the write set
        reads = _.union(reads, writes);

        var deferred = {};
        deferred.promise = new Promise(function (resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });

        this.id = Job._idCounter++;
        this.fn = fn;
        this.reads = reads;
        this.writes = writes;
        this.deferred = deferred;
    };

    /**
     * @private
     * @type {number}
     */
    Job._idCounter = 0;

    /**
     * @type {function(): Promise}
     */
    Job.prototype.fn = null;

    /**
     * @type {Array.<string>}
     */
    Job.prototype.reads = null;

    /**
     * @type {Array.<string>}
     */
    Job.prototype.writes = null;

    /**
     * @type {{promise: Promise, resolve: function(), reject: function()}}
     */
    Job.prototype.deferred = null;

    /**
     * @type {?Promise}
     */
    Job.prototype.promise = null;

    /**
     * A pausable queue of asynchronous operations to be executed in sequence.
     * 
     * @constructor
     * @param {!number} maxJobs The maximum allowed number of concurrently
     *  executing jobs
     */
    var AsyncDependencyQueue = function (maxJobs) {
        EventEmitter.call(this);

        this._maxJobs = maxJobs;
        this._pending = [];
        this._current = {};
    };

    util.inherits(AsyncDependencyQueue, EventEmitter);

    /**
     * The ordered list of pending jobs.
     * 
     * @type {Array.<Job>}
     */
    AsyncDependencyQueue.prototype._pending = null;

    /**
     * The set of currently executing jobs, indexed by Job ID.
     *
     * @type {{number: Job}}
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
     * @param {!function(): Promise} fn The asynchronous command to execute
     * @param {!Array.<string>} reads The set of read locks required
     * @param {!Array.<string>} writes The set of write locks required
     * @return {Promise} Resolves once the job has completed execution with the
     *  resulting value; rejects if the job fails or is canceled before execution.
     */
    AsyncDependencyQueue.prototype.push = function (fn, reads, writes) {
        var job = new Job(fn, reads, writes);

        this._pending.push(job);

        this._processNext();

        return job.deferred.promise;
    };

    /**
     * Remove all operations from the queue. Does not affect the currently
     * executing operation.
     */
    AsyncDependencyQueue.prototype.removeAll = function () {
        this._pending.forEach(function (job) {
            job.deferred.reject(new Error("Job canceled before execution"));
        });

        this._pending.length = 0;
    };

    /**
     * Determines whether the given lock is conflicted w.r.t. the given set of
     * currently held locks.
     * 
     * @private
     * @param {string} set Either "reads" or "writes"
     * @param {string} lock The lock for which conflicts should be checked
     * @return {boolean} Indicates whether the lock is currently conflicted
     */
    AsyncDependencyQueue.prototype._checkLockConflicts = function (set, lock) {
        // TODO: it might be more efficient to also maintain sets of currently
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

    /**
     * Determines whether any of the given locks are conflicted w.r.t. the given
     * set of currently held locks.
     * 
     * @private
     * @see AsyncDependencyQueue.prototype._checkLockConflicts
     * @param {string} set Either "reads" or "writes"
     * @param {string} locks The locks for which conflicts should be checked
     * @return {boolean} Indicates whether any lock is currently conflicted
     */
    AsyncDependencyQueue.prototype._checkLockSetConflicts = function (set, locks) {
        return locks.some(function (lock) {
            return this._checkLockConflicts(set, lock);
        }, this);
    };

    /**
     * Determines whether any of the given write locks are conflicted w.r.t. the
     * set of currently held read locks.
     * 
     * @private
     * @see AsyncDependencyQueue.prototype._checkLockSetConflicts
     * @param {string} writes The write locks for which conflicts should be checked
     * @return {boolean} Indicates whether any lock is currently conflicted
     */
    AsyncDependencyQueue.prototype._checkWriteConflicts = function (writes) {
        return this._checkLockSetConflicts("reads", writes);
    };

    /**
     * Determines whether any of the given read locks are conflicted w.r.t. the
     * set of currently held write locks.
     * 
     * @private
     * @see AsyncDependencyQueue.prototype._checkLockSetConflicts
     * @param {string} reads The read locks for which conflicts should be checked
     * @return {boolean} Indicates whether any lock is currently conflicted
     */
    AsyncDependencyQueue.prototype._checkReadConflicts = function (reads) {
        return this._checkLockSetConflicts("writes", reads);
    };

    /**
     * Attempt to remove a job from the queue of pending jobs for processing.
     * May fail and return null if all of the pending jobs are conflicted w.r.t.
     * the currently held locks. If successful, the queue of pending jobs is
     * mutated.
     *
     * @private
     * @return {?Job} The job to be processed, or null if none are available.
     */
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
        if (this._isPaused) {
            // The queue is paused; give up
            return;
        }

        if (this._pending.length === 0) {
            // No pending jobs; give up
            return;
        }
        
        var ids = Object.keys(this._current);
        if (ids.length >= this._maxJobs) {
            // Too many jobs currently active; give up
            return;
        }

        var job = this._pickJob();
        if (!job) {
            // All pending jobs are conflicted; give up
            return;
        }

        // Execute the chosen job and add it to the current set
        this._current[job.id] = job;
        job.promise = job.fn()
            .bind(this)
            .then(function (value) {
                job.deferred.resolve(value);
            }, function (err) {
                job.deferred.reject(err);
                this.emit("error", err);
            })
            .finally(function () {
                delete this._current[job.id];

                if (!this._isPaused) {
                    this._processNext();
                }
            })
            .done();

        // Continue attempting to process jobs
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

        this._processNext();
    };

    /**
     * The number of pending jobs
     * 
     * @return {number}
     */
    AsyncDependencyQueue.prototype.pending = function () {
        return this._pending.length;
    };

    /**
     * The number of currently executing jobs
     * 
     * @return {number}
     */
    AsyncDependencyQueue.prototype.active = function () {
        return Object.keys(this._current).length;
    };

    module.exports = AsyncDependencyQueue;
});
