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
        Immutable = require("immutable"),
        _ = require("lodash");
        
    var events = require("../events"),
        DocumentIndex = require("js/models/documentindex");

    var ApplicationStore = Fluxxor.createStore({
        // Photoshop Version
        _hostVersion: null,

        /**
         * Set of boolean values designating when portions of the application have been initialized
         *
         * @type {Immutable.Set.<string>}
         */
        _initialized: Immutable.Set(),

        /**
         * List of paths for recent files opened in Photoshop
         * @private
         * @type {Immutable.List.<string>}
         */
        _recentFiles: Immutable.List(),

        /**
         * Index of currently open documents in Photoshop.
         *
         * @private
         * @type {DocumentIndex}
         */
        _documentIndex: new DocumentIndex(),

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.application.HOST_VERSION, this.setHostVersion,
                events.application.INITIALIZED, this._setInitialized,
                events.application.UPDATE_RECENT_FILES, this._updateRecentFileList,
                events.document.DOCUMENT_UPDATED, this._updateDocument,
                events.document.CLOSE_DOCUMENT, this._closeDocument,
                events.document.SELECT_DOCUMENT, this._documentSelected
            );
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._documentIndex = new DocumentIndex();
            this._hostVersion = null;
            this._recentFiles = Immutable.List();
            this._initialized = Immutable.Set();
        },
        
        getState: function () {
            var documentIndex = this._documentIndex;

            return {
                hostVersion: this._hostVersion,
                activeDocumentInitialized: this._initialized.get("activeDocument"),
                inactiveDocumentsInitialized: this._initialized.get("inactiveDocuments"),
                recentFilesInitialized: this._initialized.get("recentFiles"),
                recentFiles: this._recentFiles,
                documentIDs: documentIndex.openDocumentIDs,
                selectedDocumentIndex: documentIndex.activeDocumentIndex,
                selectedDocumentID: documentIndex.activeDocumentID
            };
        },

        /**
         * Returns the id of currently active document, null if there is none
         *
         * @return {number}
         */
        getCurrentDocumentID: function () {
            return this._documentIndex.activeDocumentID;
        },

        /**
         * Get the list of open document IDs
         *
         * @return {Immutable.List.<number>}
         */
        getOpenDocumentIDs: function () {
            return this._documentIndex.openDocumentIDs;
        },

        /**
         * Returns the list of recent document paths
         *
         * @return {Immutable.List.<string>}
         */
        getRecentFiles: function () {
            return this._recentFiles;
        },
        
        /**
         * Get the currently active document model, or null if there are none.
         * 
         * @return {?Document}
         */
        getCurrentDocument: function () {
            var documentStore = this.flux.store("document");
            return documentStore.getDocument(this._documentIndex.activeDocumentID);
        },

        /**
         * Get the currently active document models
         * 
         * @return {Immutable.List.<Document>}
         */
        getOpenDocuments: function () {
            var documentStore = this.flux.store("document"),
                documents = this._documentIndex.openDocumentIDs
                    .map(function (id) {
                        return documentStore.getDocument(id);
                    })
                    .filter(function (document) {
                        return document;
                    });

            return documents;
        },

        /**
         * Get the list of open but uninitialized document models.
         *
         * @return {Immutable.List.<Document>}
         */
        getInitializedDocuments: function () {
            return this.getOpenDocuments()
                .filter(function (document) {
                    return document.layers;
                });
        },

        /**
         * Get the list of open but uninitialized document models.
         *
         * @return {Immutable.List.<Document>}
         */
        getUninitializedDocuments: function () {
            return this.getOpenDocuments()
                .filterNot(function (document) {
                    return document.layers;
                });
        },

        /**
         * The number of currently open documents;
         *
         * @return {number}
         */
        getDocumentCount: function () {
            return this._documentIndex.openDocumentIDs.size;
        },

        /**
         * Find the next document in the document index.
         * 
         * @return {?Document}
         */
        getNextDocument: function () {
            var documentStore = this.flux.store("document"),
                nextDocumentID = this._documentIndex.nextID;

            return documentStore.getDocument(nextDocumentID);
        },

        /**
         * Find the previous document in the document index.
         * 
         * @return {?Document}
         */
        getPreviousDocument: function () {
            var documentStore = this.flux.store("document"),
                previousDocumentID = this._documentIndex.previousID;

            return documentStore.getDocument(previousDocumentID);
        },
        
        /** @ignore */
        setHostVersion: function (payload) {
            var parts = [
                payload.versionMajor,
                payload.versionMinor,
                payload.versionFix
            ];

            this._hostVersion = parts.join(".");
            this.emit("change");
        },

        /**
         * Sets the initialized flag to true and emits a change
         * @private
         * @param {{item: string}} payload includes name of the item/module that has been initialized
         */
        _setInitialized: function (payload) {
            var item = payload.item;
            if (item && !this._initialized.get(item)) {
                this._initialized = this._initialized.add(item);
                this.emit("change");
            }
        },

        /**
         * Updates the recent file list
         *
         * @private
         * @param {{recentFiles: Array.<string>}} payload
         */
        _updateRecentFileList: function (payload) {
            // If a file has been deleted, PS sends us an empty string for that file
            // So we have to filter it out
            this._recentFiles = Immutable.List(_.compact(payload.recentFiles));
            this.emit("change");
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
                    itemIndex = rawDocument.itemIndex - 1, // doc indices start at 1
                    current = payload.current;

                this._documentIndex = this._documentIndex.setPosition(documentID, itemIndex, current);

                this.emit("change");
            });
        },

        /**
         * Remove the given document ID from the document index, and set a new
         * selected document ID and index.
         * 
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         */
        _closeDocument: function (payload) {
            this.waitFor(["document"], function () {
                var documentID = payload.documentID,
                    selectedDocumentID = payload.selectedDocumentID;

                this._documentIndex = this._documentIndex.remove(documentID, selectedDocumentID);

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
            var selectedDocumentID = payload.selectedDocumentID;

            this._documentIndex = this._documentIndex.setActive(selectedDocumentID);

            this.emit("change");
        }
    });

    module.exports = ApplicationStore;
});
