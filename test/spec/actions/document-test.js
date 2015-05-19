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
        events = require("js/events"),
        Document = require("js/models/document"),
        _ = require("lodash");

    var staticDocumentJSON = require("text!../static/document.json"),
        staticDocument = JSON.parse(staticDocumentJSON),
        staticLayersJSON = require("text!../static/layers.json"),
        staticLayers = JSON.parse(staticLayersJSON);

    module("actions/document", {
        setup: function () {
            fluxxorTestHelper.setup.call(this);
            spacesMockHelper.setup.call(this);
        },
        teardown: function () {
            spacesMockHelper.teardown.call(this);
        }

    });

    asyncTest("selectDocument action success", function () {
        expect(2);

        var document = new Document(staticDocument),
            id = document.id;

        // Determines whether the mock play method should respond to this request.
        var playTest = function (command, descriptor) {
            return command === "select" &&
                descriptor.null._ref === "document" &&
                descriptor.null._id === id;
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

        this.flux.actions.documents.selectDocument(document);
    });

    /**
     * Mocks get calls for layers from a given set of documents.
     * 
     * @param {Object.<number, object>} documentSet
     */
    var _layerReferenceGetMockHelper = function (documentSet) {
        var layerReferenceGetTest = function (reference) {
            var documentID = reference._ref[1]._id,
                isDocumentRef = reference._ref[1]._ref === "document" &&
                    documentSet.hasOwnProperty(documentID);

            if (!isDocumentRef) {
                return false;
            }

            var index = reference._ref[0]._index,
                document = documentSet[documentID],
                layerCount = document.numberOfLayers,
                startIndex = document.hasBackgroundLayer ? 0 : 1,
                endIndex = (layerCount + 1) - startIndex,
                validLayer = startIndex <= index && index < endIndex,
                isLayerRef = reference._ref[0]._ref === "layer" && validLayer;

            return isLayerRef;
        };

        var layerReferenceGetResponse = function (reference) {
            var index = reference._ref[0]._index;

            return {
                err: null,
                result: staticLayers[index]
            };
        };

        this.mockGet(layerReferenceGetTest, layerReferenceGetResponse);
    };

    asyncTest("updateDocument action", function () {
        expect(2);

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

        var CURRENT_DOCUMENT = TEST_DOCUMENT_SET[1];

        var documentGetTest = function (reference) {
            return reference._ref === "document" &&
                TEST_DOCUMENT_SET.hasOwnProperty(reference._id);
        };

        var documentGetResponse = function (reference) {
            var id = reference._id;

            var err, response;
            if (TEST_DOCUMENT_SET.hasOwnProperty(id)) {
                err = null;
                response = TEST_DOCUMENT_SET[id];
            } else {
                err = new Error("No such document: " + id);
            }

            return {
                err: err,
                result: response
            };
        };

        this.mockGet(documentGetTest, documentGetResponse);

        _layerReferenceGetMockHelper.call(this, TEST_DOCUMENT_SET);

        this.bindTestAction(events.documents.DOCUMENT_UPDATED, function (payload) {
            equal(payload.document.documentID, CURRENT_DOCUMENT.documentID, "Has correct document");
            ok(_.isEqual(payload.layers.reverse(), staticLayers, "Has correct layers"));

            start();
        });

        this.flux.actions.documents.updateDocument(CURRENT_DOCUMENT.documentID);
    });

    asyncTest("initDocuments action: some documents", function () {
        expect(9);

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
            return reference._ref[0]._property === "numberOfDocuments" &&
                reference._ref[1]._ref === "application";
        };

        var numberOfDocumentsGetResponse = {
            err: null,
            result: {
                "numberOfDocuments": TEST_DOCUMENT_LIST.length
            }
        };

        this.mockGet(numberOfDocumentsGetTest, numberOfDocumentsGetResponse);

        var documentGetTest = function (reference) {
            return reference._ref === "document" &&
                TEST_DOCUMENT_LIST.hasOwnProperty(reference._index - 1);
        };

        var documentGetResponse = function (reference) {
            var index = reference._index - 1;

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
                "_ref": "document",
                "_enum": "ordinal",
                "_value": "targetEnum"
            };

            return _.isEqual(reference, currentDocumentRef);
        };

        var currentDocumentGetResponse = {
            err: null,
            result: CURRENT_DOCUMENT
        };

        this.mockGet(currentDocumentGetTest, currentDocumentGetResponse);

        _layerReferenceGetMockHelper.call(this, TEST_DOCUMENT_SET);

        var documentUpdatedCounter = 0,
            currentDocumentUpdated = false;
        this.bindTestAction(events.documents.CURRENT_DOCUMENT_UPDATED, function (payload) {
            ok(payload.document.documentID, "Has a document ID");
            ok(_.isEqual(payload.layers.reverse(), staticLayers), "Has correct layers");
            ok(!currentDocumentUpdated, "Current document only updated once");

            currentDocumentUpdated = true;
            if (++documentUpdatedCounter === TEST_DOCUMENT_LIST.length) {
                start();
            }
        });

        this.bindTestAction(events.documents.DOCUMENT_UPDATED, function (payload) {
            ok(payload.document.documentID, "Has a document ID");
            ok(_.isEqual(payload.layers.reverse(), staticLayers), "Has correct layers");

            if (++documentUpdatedCounter === TEST_DOCUMENT_LIST.length) {
                start();
            }
        });

        this.flux.actions.documents.initDocuments();
    });
});
