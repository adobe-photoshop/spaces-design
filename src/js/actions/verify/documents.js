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

    var Promise = require("bluebird"),
        _ = require("lodash");

    var descriptor = require("adapter").ps.descriptor,
        documentLib = require("adapter").lib.document;

    var locks = require("js/locks"),
        documentActions = require("../documents");

    /**
     * Verify the correctness of the list of open document IDs.
     *
     * @return {Promise} Rejects if the number or order of open document IDs in
     *  differs from Photoshop.
     */
    var verifyOpenDocuments = function () {
        var applicationStore = this.flux.store("application"),
            openDocumentIDs = applicationStore.getOpenDocumentIDs();

        return descriptor.getProperty("application", "numberOfDocuments")
            .bind(this)
            .then(function (docCount) {
                var docPromises = _.range(1, docCount + 1)
                    .map(function (index) {
                        var indexRef = documentLib.referenceBy.index(index);
                        return documentActions._getDocumentByRef(indexRef, ["documentID"], []);
                    });

                return Promise.all(docPromises);
            })
            .then(function (documentIDs) {
                if (openDocumentIDs.size !== documentIDs.length) {
                    throw new Error("Incorrect open document count: " + openDocumentIDs.size +
                        " instead of " + documentIDs.length);
                } else {
                    openDocumentIDs.forEach(function (openDocumentID, index) {
                        var documentID = documentIDs[index].documentID;
                        if (openDocumentID !== documentID) {
                            throw new Error("Incorrect document ID at index " + index + ": " + openDocumentID +
                                " instead of " + documentID);
                        }
                    });
                }
            });
    };
    verifyOpenDocuments.action = {
        reads: [locks.PS_APP, locks.JS_APP],
        writes: []
    };

    /**
     * Verify the correctness of the currently active document ID.
     *
     * @return {Promise} Rejects if active document ID differs from Photoshop.
     */
    var verifyActiveDocument = function () {
        var currentRef = documentLib.referenceBy.current,
            applicationStore = this.flux.store("application"),
            currentDocumentID = applicationStore.getCurrentDocumentID();

        return documentActions._getDocumentByRef(currentRef, ["documentID"], [])
            .bind(this)
            .get("documentID")
            .then(function (documentID) {
                if (currentDocumentID !== documentID) {
                    throw new Error("Incorrect active document: " + currentDocumentID +
                        " instead of " + documentID);
                }
            }, function () {
                if (typeof currentDocumentID === "number") {
                    throw new Error("Spurious active document: " + currentDocumentID);
                }
            });
    };
    verifyActiveDocument.action = {
        reads: [locks.PS_APP, locks.JS_APP],
        writes: []
    };

    exports.verifyActiveDocument = verifyActiveDocument;
    exports.verifyOpenDocuments = verifyOpenDocuments;
});
