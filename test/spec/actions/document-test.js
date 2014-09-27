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
        playgroundMockHelper = require("../util/playground-mock-helper"),
        events = require("js/events"),
        _ = require("lodash");

    var staticDocumentJSON = require("text!../static/document.json"),
        staticDocument = JSON.parse(staticDocumentJSON),
        staticLayersJSON = require("text!../static/layers.json"),
        staticLayers = JSON.parse(staticLayersJSON);

    module("actions/document", {
        setup: function () {
            fluxxorTestHelper.setup.call(this);
            playgroundMockHelper.setup.call(this);
        },
        teardown: function () {
            playgroundMockHelper.teardown.call(this);
        }

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
        expect(10);

        var makeTestDocument = function (id) {
            var doc = _.cloneDeep(staticDocument);

            doc.documentID = id;

            return doc;
        };

        var TEST_DOCUMENT_SET = {
            1: makeTestDocument(1),
            3: makeTestDocument(3),
            5: makeTestDocument(5),
            7: makeTestDocument(7)
        };

        var TEST_DOCUMENT_LIST = _.values(TEST_DOCUMENT_SET),
            CURRENT_DOCUMENT = TEST_DOCUMENT_LIST[0];

        var numberOfDocumentsGetTest = function (reference) {
            return reference.ref[0].property === "numberOfDocuments" &&
                reference.ref[1].ref === "application";
        };

        var numberOfDocumentsGetResponse = {
            err: null,
            result: {
                "numberOfDocuments": TEST_DOCUMENT_LIST.length
            }
        };

        this.mockGet(numberOfDocumentsGetTest, numberOfDocumentsGetResponse);

        var documentGetTest = function (reference) {
            return reference.ref === "document" &&
                TEST_DOCUMENT_LIST.hasOwnProperty(reference.index - 1);
        };

        var documentGetResponse = function (reference) {
            var index = reference.index - 1;

            var err, response;
            if (0 <= index && index < TEST_DOCUMENT_LIST.length) {
                err = null;
                response = TEST_DOCUMENT_LIST[index];
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
            ok(_.isEqual(payload.documentsArray, TEST_DOCUMENT_LIST), "documentsArray is correct");

            start();
        });


        var layerReferenceGetTest = function (reference) {
            var documentID = reference.ref[1].id,
                isDocumentRef = reference.ref[1].ref === "document" &&
                TEST_DOCUMENT_SET.hasOwnProperty(documentID);

            var index = reference.ref[0].index,
                document = TEST_DOCUMENT_SET[documentID],
                validLayer = index === 0 ?
                    document.hasBackgroundLayer :
                    document.targetLayers.hasOwnProperty(index - 1),
                isLayerRef = reference.ref[0].ref === "layer" && validLayer;

            return isDocumentRef && isLayerRef;
        };

        var layerReferenceGetResponse = function (reference) {
            var index = reference.ref[0].index;

            return {
                err: null,
                result: staticLayers[index]
            };
        };

        this.mockGet(layerReferenceGetTest, layerReferenceGetResponse);

        var documentUpdatedCounter = 0;
        this.bindTestAction(events.documents.DOCUMENT_UPDATED, function (payload) {
            ok(payload.document, "Has a document");
            ok(_.isEqual(payload.layerArray.reverse(), staticLayers, "Has correct layers"));

            if (documentUpdatedCounter++ === TEST_DOCUMENT_LIST.length) {
                start();
            }
        });

        this.flux.actions.documents.updateDocumentList();
    });
});
