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

    var ApplicationStore = Fluxxor.createStore({
        // Photoshop Version
        _hostVersion: null,

        /**
         * An ordered list of document IDs
         * @private
         * @type {Array.<number>}
         */
        _documentIDs: null,

        /**
         * The index of the currently active document, or null if there are none
         * @private
         * @type {?number}
         */
        _selectedDocumentIndex: null,

        /**
         * The ID of the currently active document, or null if there are none
         * @private
         * @type {?number}
         */
        _selectedDocumentID: null,

        initialize: function () {
            this._documentIDs = [];

            this.bindActions(
                events.application.HOST_VERSION, this.setHostVersion,
                events.documents.DOCUMENT_UPDATED, this._updateDocument,
                events.documents.CURRENT_DOCUMENT_UPDATED, this._updateCurrentDocument,
                events.documents.RESET_DOCUMENTS, this._resetDocuments,
                events.documents.SELECT_DOCUMENT, this._documentSelected
            );
        },
        
        getState: function () {
            return {
                hostVersion: this._hostVersion,
                documentIDs: this._documentIDs,
                selectedDocumentIndex: this._selectedDocumentIndex,
                selectedDocumentID: this._documentIDs[this._selectedDocumentIndex]
            };
        },
        
        /**
         * Get the currently active document model, or null if there are none.
         * 
         * @return {?Document}
         */
        getCurrentDocument: function () {
            var documentStore = this.flux.store("document");
            return documentStore.getDocument(this._selectedDocumentID);
        },
        
        setHostVersion: function (payload) {
            var parts = [
                payload.hostVersion.versionMajor,
                payload.hostVersion.versionMinor,
                payload.hostVersion.versionFix
            ];

            this._hostVersion = parts.join(".");
            this.emit("change");
        },

        /**
         * Set the position of the given document ID in the document index.
         * 
         * @private
         * @param {number} documentID
         * @param {number} itemIndex
         */
        _updateDocumentPosition: function (documentID, itemIndex) {
            // find the document in the array of indices
            var currentIndex = -1;
            this._documentIDs.some(function (id, index) {
                if (id === documentID) {
                    currentIndex = index;
                    return true;
                }
            });

            // remove it from the array
            if (currentIndex > -1) {
                this._documentIDs.splice(currentIndex, 1);
            }

            // add it back at the correct index
            this._documentIDs.splice(itemIndex, 0, documentID);
        },

        /**
         * Set or reset the position of the given document in the document index.
         * 
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         */
        _updateDocument: function (payload) {
            this.waitFor(["document"], function () {
                var rawDocument = payload.document,
                    documentID = rawDocument.documentID,
                    itemIndex = rawDocument.itemIndex - 1; // doc indices start at 1

                this._updateDocumentPosition(documentID, itemIndex);

                this.emit("change");
            });
        },

        /**
         * Set or reset the position of the given document in the document index,
         * and mark it as the currently active document.
         * 
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         */
        _updateCurrentDocument: function (payload) {
            this.waitFor(["document"], function () {
                var rawDocument = payload.document,
                    documentID = rawDocument.documentID,
                    itemIndex = rawDocument.itemIndex - 1; // doc indices start at 1

                this._updateDocumentPosition(documentID, itemIndex);
                this._selectedDocumentID = documentID;
                this._selectedDocumentIndex = itemIndex;

                this.emit("change");
            });
        },

        /**
         * Reset the positions of all the documents in the document index, and reset
         * the currently active documents.
         * 
         * @private
         * @param {{selectedDocumentID: number, documents: Array.<{document: object, layers: Array.<object>}>}} payload
         */
        _resetDocuments: function (payload) {
            this.waitFor(["document"], function () {
                this._documentIDs = payload.documents.map(function (docObj, index) {
                    var documentID = docObj.document.documentID;
                    if (payload.selectedDocumentID === documentID) {
                        this._selectedDocumentIndex = index;
                        this._selectedDocumentID = documentID;
                    }

                    return documentID;
                }, this);
                
                this.emit("change");
            });
        },

        /**
         * Set the currently active document.
         * 
         * @private
         * @param {{selectedDocumentID: number}} payload
         */
        _documentSelected: function (payload) {
            this.waitFor(["document"], function () {
                this._selectedDocumentID = payload.selectedDocumentID;
                this._selectedDocumentIndex = this._documentIDs.indexOf(payload.selectedDocumentID);

                this.emit("change");
            });
        }
    });

    module.exports = ApplicationStore;
});
