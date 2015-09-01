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
        events = require("../events");

    var ExampleStoreOne = Fluxxor.createStore({
        initialize: function () {
            this.bindActions(
                events.example.ASYNC_ACTION_START, this.start,
                events.example.ASYNC_ACTION_SUCCESS, this.success,
                events.example.ASYNC_ACTION_FAIL, this.fail,
                events.example.SYNC_ACTION, this.setCounter
            );
        },

        getState: function () {
            return {
                time: this.elapsedTime
            };
        },
        
        /** @ignore */
        start: function () {
            this.elapsedTime = null;
            this.startTime = new Date().getTime();
        },

        
        /** @ignore */
        success: function () {
            var stopTime = new Date().getTime();

            this.elapsedTime = stopTime - this.startTime;
            this.startTime = null;
            this.emit("change");
        },
        
        /** @ignore */
        fail: function () {
            this.elapsedTime = null;
            this.startTime = null;
            this.emit("change");
        },
        startTime: null,
        elapsedTime: null,
        
        /** @ignore */
        setCounter: function (payload) {
            var counter = payload.count;
            this.counter = counter;
        }
    });

    module.exports = ExampleStoreOne;
});
