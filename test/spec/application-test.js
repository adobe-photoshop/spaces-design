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

/* global module, asyncTest, start, expect, ok, equal */

define(function (require) {
    "use strict";

    var fluxxorTestHelper = require("./util/fluxxor-test-helper"),
        playgroundMockHelper = require("./util/playground-mock-helper"),
        events = require("js/events");

    var applicationJSON = require("text!./static/application.json"),
        applicationDescriptor = JSON.parse(applicationJSON);

    module("application", {
        setup: function () {
            fluxxorTestHelper.setup.call(this);
            playgroundMockHelper.setup.call(this);
        },
        teardown: function () {
            playgroundMockHelper.teardown.call(this);
        }
    });

    asyncTest("Test application host version action", function () {
        expect(4);

        // Determines whether the mock get method should respond to this request.
        var referenceTest = function (reference) {
            return reference.ref === "application" &&
                reference.enum === "$Ordn" &&
                reference.value === "$Trgt";
        };

        // If the request passes the test above, this will be the mock response.
        // Note that the response can either be an {err: ?object, result: object=}
        // value OR a function that returns such a value if the response depends
        // on the exact request
        var response = {
            err: null,
            result: applicationDescriptor
        };

        // Add the get-test/response pair to the test mock
        this.mockGet(referenceTest, response);

        // Bind the test store to the given event below; use the handler for verification
        this.bindTestAction(events.application.HOST_VERSION, function (payload) {
            ok(payload.hasOwnProperty("hostVersion"), "Payload has hostVersion property");

            var hostVersion = payload.hostVersion;
            equal(typeof hostVersion.versionMajor, "number", "versionMajor is a number");
            equal(typeof hostVersion.versionMinor, "number", "versionMinor is a number");
            equal(typeof hostVersion.versionFix, "number", "versionFix is a number");

            start();
        });

        this.flux.actions.application.hostVersion();
    });
});
