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

    var fluxxorTestHelper = require("../util/fluxxor-test-helper"),
        spacesMockHelper = require("../util/spaces-mock-helper"),
        events = require("../events");

    module("actions/application", {
        setup: function () {
            fluxxorTestHelper.setup.call(this);
            spacesMockHelper.setup.call(this);
        },
        teardown: function () {
            spacesMockHelper.teardown.call(this);
        }
    });

    asyncTest("Test application host version action", function () {
        expect(4);

        // Determines whether the mock get method should respond to this request.
        var referenceTest = function (reference) {
            return reference._ref[0]._property === "hostVersion" &&
                reference._ref[1]._ref === "application" &&
                reference._ref[1]._enum === "ordinal" &&
                reference._ref[1]._value === "targetEnum";
        };

        // If the request passes the test above, this will be the mock response.
        // Note that the response can either be an {err: ?object, result: object=}
        // value OR a function that returns such a value if the response depends
        // on the exact request
        var response = {
            err: null,
            result: {
                "hostVersion": {
                    "_obj": "version",
                    "versionFix": 0,
                    "versionMajor": 15,
                    "versionMinor": 2
                }
            }
        };

        // Add the get-test/response pair to the test mock
        this.mockGet(referenceTest, response);

        // Bind the test store to the given event below; use the handler for verification
        this.bindTestAction(events.application.HOST_VERSION, function (payload) {
            ok(payload.hasOwnProperty("hostVersion"), "Payload has hostVersion property");

            var hostVersion = payload.hostVersion;
            equal(hostVersion.versionMajor, 15, "versionMajor is 15");
            equal(hostVersion.versionMinor, 2, "versionMinor is 2");
            equal(hostVersion.versionFix, 0, "versionFix is 0");

            start();
        });

        this.flux.actions.application.hostVersion();
    });
});
