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

/* global module, test, equal */

define(function (require) {
    "use strict";

    var fluxxorTestHelper = require("./util/fluxxor-test-helper"),
        playgroundMockHelper = require("./util/playground-mock-helper"),
        events = require("js/events");

    module("document", {
        setup: function () {
            fluxxorTestHelper.setup.call(this);
            playgroundMockHelper.setup.call(this);
        },
        teardown: function () {
            playgroundMockHelper.teardown.call(this);
        }

    });

    test("Document store initialize", function () {
        var payload = {
            documents: [
                {
                    title: "Test 1",
                    index: 1
                },
                {
                    title: "Test 2",
                    index: 2
                }
            ],
            selectedDocumentIndex: 1
        };
        this.dispatch(events.documents.DOCUMENTS_UPDATED, payload);
        
        equal(this.flux.store("document").getState().openDocuments,
            payload.documents,
            "Document store loaded documents correctly"
        );
    });
    
    test("Switching documents", function () {
        var payload = {
            offset: 1
        };
        this.dispatch(events.documents.SCROLL_DOCUMENTS, payload);
        
        equal(this.flux.store("document").getState().selectedDocumentIndex, 2, "First switch works");
        
        this.dispatch(events.documents.SCROLL_DOCUMENTS, payload);
        
        equal(this.flux.store("document").getState().selectedDocumentIndex, 1, "Index overflow works");
        
    });

    asyncTest("Action: scrollDocuments", function () {
        expect(2);

        var offsetVal = 1;

        // Determines whether the mock play method should respond to this request.
        var playTest = function (command, descriptor) {
            return command === "select" &&
                descriptor.null.offset === offsetVal;
        };

        // If the request passes the test above, this will be the mock response.
        // Note that the response can either be an {err: ?object, result: object=}
        // value OR a function that returns such a value if the response depends
        // on the exact request
        var response = {
            err: null,
            result: {
                "null": {
                    "offset": offsetVal
                }
            }
        };

        // Add the play-test/response pair to the test mock
        this.mockPlay(playTest, response);

        // Bind the test store to the given event below; use the handler for verification
        this.bindTestAction(events.documents.SCROLL_DOCUMENTS, function (payload) {
            ok(payload.hasOwnProperty("offset"), "Payload has offset property");
            equal(payload.offset, offsetVal, "offset is " + offsetVal);

            start();
        });

        this.flux.actions.documents.scrollDocuments(offsetVal);
    });

});
