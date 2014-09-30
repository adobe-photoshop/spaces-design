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

/* global module, asyncTest, equal, start, expect, ok */

define(function (require) {
    "use strict";

    var fluxxorTestHelper = require("../util/fluxxor-test-helper"),
        events = require("js/events");

    module("actions/example", {
        setup: fluxxorTestHelper.setup
    });

    asyncTest("Tests the synchronous example actions", function () {
        var count = 123;

        expect(1);

        this.bindTestAction(events.example.SYNC_ACTION, function (payload) {
            equal(payload.count, count, "Example sync action has correct payload");
            start();
        });

        this.flux.actions.example.syncAction(count);
    });

    asyncTest("Tests the asynchronous example actions", function () {
        var count = 123;

        expect(2);

        this.bindTestAction(events.example.ASYNC_ACTION_START, function (payload) {
            equal(payload.count, count, "Example async start action has correct payload");
        });

        this.bindTestAction(events.example.ASYNC_ACTION_SUCCESS, function (payload) {
            equal(payload.count, count, "Example async success action has correct payload");
            start();
        });

        this.bindTestAction(events.example.ASYNC_ACTION_FAIL, function () {
            ok(false, "Example async fail action is not called");
        });

        this.flux.actions.example.asyncActionReadOnly(count);
    });
});
