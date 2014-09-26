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

/* global module, asyncTest, start, expect, ok, test, equal */

define(function (require) {
    "use strict";

    var fluxxorTestHelper = require("./util/fluxxor-test-helper"),
        playgroundMockHelper = require("./util/playground-mock-helper"),
        events = require("js/events"),
        _ = require("lodash");

    var staticDocumentJSON = require("text!./static/document.json"),
        staticDocument = JSON.parse(staticDocumentJSON);

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

    asyncTest("selectDocument action success", function () {
        expect(2);

        var id = 1;

        // Determines whether the mock play method should respond to this request.
        var playTest = function (command, descriptor) {
            return command === "select" &&
                descriptor.null.id === id;
        };

        // If the request passes the test above, this will be the mock response.
        // Note that the response can either be an {err: ?object, result: object=}
        // value OR a function that returns such a value if the response depends
        // on the exact request
        var response = {
            err: null,
            result: {}
        };

        // Add the play-test/response pair to the test mock
        this.mockPlay(playTest, response);

        // Bind the test store to the given event below; use the handler for verification
        this.bindTestAction(events.documents.SELECT_DOCUMENT, function (payload) {
            ok(payload.hasOwnProperty("selectedDocumentID"), "Payload has selectedDocumentID property");
            equal(payload.selectedDocumentID, id, "selectedDocumentID is " + id);

            start();
        });

        this.flux.actions.documents.selectDocument(id);
    });

    asyncTest("updateDocumentList action: some documents", function () {
        expect(2);

        var makeTestDocument = function (id) {
            var doc = _.cloneDeep(staticDocument);

            doc.documentID = id;

            return doc;
        };

        var TEST_DOCUMENTS = [
            makeTestDocument(1),
            makeTestDocument(2),
            makeTestDocument(3),
            makeTestDocument(4)
        ];

        var CURRENT_DOCUMENT = TEST_DOCUMENTS[0];

        var numberOfDocumentsGetTest = function (reference) {
            return reference.ref[0].property === "numberOfDocuments" &&
                reference.ref[1].ref === "application";
        };

        var numberOfDocumentsGetResponse = {
            err: null,
            result: {
                "numberOfDocuments": TEST_DOCUMENTS.length
            }
        };

        this.mockGet(numberOfDocumentsGetTest, numberOfDocumentsGetResponse);

        var documentGetTest = function (reference) {
            return reference.ref === "document" &&
                reference.index > 0 &&
                reference.index <= TEST_DOCUMENTS.length;
        };

        var documentGetResponse = function (reference) {
            var index = reference.index - 1;

            var err, response;
            if (0 <= index && index < TEST_DOCUMENTS.length) {
                err = null;
                response = TEST_DOCUMENTS[index];
            } else {
                err = new Error("Index out of bounds");
            }

            return {
                err: err,
                result: response
            };
        };

        this.mockGet(documentGetTest, documentGetResponse);

        var currentDocumentGetTest = function (reference) {
            var currentDocumentRef = {
                "ref": [
                    {
                        "ref": "property",
                        "property": "documentID"
                    },
                    {
                        "ref": "document",
                        "enum": "ordinal",
                        "value": "targetEnum"
                    }
                ]
            };

            return _.isEqual(reference, currentDocumentRef);
        };

        var currentDocumentGetResponse = {
            err: null,
            result: CURRENT_DOCUMENT
        };

        this.mockGet(currentDocumentGetTest, currentDocumentGetResponse);

        this.bindTestAction(events.documents.DOCUMENT_LIST_UPDATED, function (payload) {
            ok(_.isEqual(payload.selectedDocumentID, CURRENT_DOCUMENT.documentID), "selectedDocumentID is correct");
            ok(_.isEqual(payload.documentsArray, TEST_DOCUMENTS), "documentsArray is correct");

            start();
        });

        this.flux.actions.documents.updateDocumentList();
    });
});
