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

    var Promise = require("bluebird");

    /**
     * Build a throttled version of the provided function. If the throttled
     * function is called while a previous call is still in progress, the following
     * call will wait for the original call to complete. If the throttled function
     * is called multiple times while waiting, only one call will occur with the
     * arguments of the final call. Following calls can optionally be delayed by
     * a given number of milliseconds.
     *
     * Equivalent of _.throttle()
     *
     * @param {function(*):Promise=} fn The function to throttle. May either return
     *  a promise, or undefined.
     * @param {object=} receiver Optional receiver for the throttled function.
     * @param {number=} delay Optional number of milliseconds to delay successive
     *  calls.
     * @return {function(*)} The throttled function.
     */
    var throttle = function (fn, receiver, delay) {
        var promise = null,
            pending = null;

        // Handle omitted receiver
        if (typeof receiver === "number") {
            delay = receiver;
            receiver = undefined;
        }

        // Handle omitted delay
        delay = delay || 0;

        var throttledFn = function () {
            if (!promise) {
                var self = receiver;
                if (self === undefined) {
                    self = this;
                }

                promise = (fn.apply(self, arguments) || Promise.resolve())
                    .delay(delay)
                    .finally(function () {
                        promise = null;
                        if (pending) {
                            throttledFn.apply(self, pending);
                        }
                    });
                pending = null;
            } else {
                pending = arguments;
            }
        };

        return throttledFn;
    };

    /**
     * Debounce a promise-returning asynchronous function. Synchronous functions should
     * use _.debounce instead.
     *
     * @param {function(*):Promise=} fn The function to debounce. May either return
     *  a promise, or undefined.
     * @param {object=} receiver Optional receiver for the debounced function.
     * @param {number=} delay Optional number of milliseconds to wait after last call
     * @param {boolean=} immediate Flag to call debounced function at the beginning
     * @return {function(*)} The debounced function.
     */
    var debounce = function (fn, receiver, delay, immediate) {
        var debounceTimer = null,
            pending = null,
            promise = null;

        // Handle omitted receiver
        if (typeof receiver === "number") {
            immediate = delay;
            delay = receiver;
            receiver = undefined;
        }

        // Handle omitted delay/immediate flag
        delay = delay || 0;
        immediate = immediate || false;

        var debouncedFn = function () {
            var self = receiver;
            if (self === undefined) {
                self = this;
            }

            pending = arguments;

            if (debounceTimer) {
                window.clearTimeout(debounceTimer);
                debounceTimer = null;
            } else if (immediate) {
                immediate = false;
                promise = fn.apply(self, pending)
                    .finally(function () {
                        promise = null;
                    });
            }

            debounceTimer = window.setTimeout(function () {
                promise = fn.apply(self, pending)
                    .finally(function () {
                        promise = null;
                        debounceTimer = null;
                    });
            }, delay);
        };

        return debouncedFn;
    };

    exports.throttle = throttle;
    exports.debounce = debounce;
});
