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
        _hostVersion: null,
        _documentIDs: [],
        _selectedDocumentIndex: -1,
        _selectedDocumentID: null,
        initialize: function () {
            this.bindActions(
                events.application.HOST_VERSION, this.setHostVersion,
                events.documents.DOCUMENT_LIST_UPDATED, this.documentListUpdated,
                events.documents.SELECT_DOCUMENT, this.documentSelected
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
        getCurrentDocumentID: function () {
            return this._selectedDocumentID;
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
        documentListUpdated: function (payload) {
            var documents = payload.documentsArray;
            this._documentIDs = documents.map(function (document, index) {
                // Grab the index of the selected document in the ID array
                if (payload.selectedDocumentID === document.documentID) {
                    this._selectedDocumentIndex = index;
                    this._selectedDocumentID = document.documentID;
                }
                return document.documentID;
            }.bind(this));
        },
        documentSelected: function (payload) {
            this._selectedDocumentID = payload.selectedDocumentID;
            this._selectedDocumentIndex = this._documentIDs.indexOf(payload.selectedDocumentID);

            this.emit("change");
        }
    });

    module.exports = new ApplicationStore();
});
