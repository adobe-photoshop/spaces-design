/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

    /**
     * Task queue.
     *
     * @type {Array.<{fn: function(), receiver: object=}>}
     */
    var _queue = [];

    /**
     * Hidden div on on which changes are triggered.
     *
     * @private
     * @type {HTMLElement}
     */
    var _hiddenDiv = document.createElement("div");

    /**
     * Processes the task queue when a change is observed.
     *
     * @private
     * @type {MutationObserver}
     */
    var _observer = new MutationObserver(function () {
            var queueList = _queue.slice();
            _queue.length = 0;
            queueList.forEach(function (task) {
                task.fn.call(task.receiver);
            });
        });

    _observer.observe(_hiddenDiv, {
        attributes: true
    });

    /**
     * Execute the given function in the next tick of the event loop, ala Node's
     * process.nextTick. This is faster than setTimeout(fn, 0).
     *
     * @param {!function()} fn
     * @param {object=} receiver
     */
    var nextTick = function (fn, receiver) {
        if (!_queue.length) {
            _hiddenDiv.setAttribute("yes", "no");
        }

        _queue.push({
            fn: fn,
            receiver: receiver
        });
    };

    exports.nextTick = nextTick;
});
