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

/* global module, ok, test */

define(function (require) {
    "use strict";

    var fluxxorTestHelper = require("../util/fluxxor-test-helper"),
        events = require("js/events"),
        _ = require("lodash");

    module("stores/document", {
        setup: fluxxorTestHelper.setup
    });

    test("Document store initialize", function () {
        var payload = {
            documentsArray: [
                {
                    documentID: 13,
                    title: "Test 1",
                    index: 1
                },
                {
                    documentID: 14,
                    title: "Test 2",
                    index: 2
                }
            ],
            selectedDocumentIndex: 1
        };
        this.dispatch(events.documents.DOCUMENT_LIST_UPDATED, payload);

        var openDocuments = this.flux.store("document").getState().openDocuments,
            result = payload.documentsArray.reduce(function (result, document) {
                result[document.documentID] = document;
                return result;
            }, {});

        ok(_.isEqual(result, openDocuments), "Document store loaded documents correctly");
    });
});
