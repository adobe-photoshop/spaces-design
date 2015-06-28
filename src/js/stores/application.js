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
        
    var events = require("../events");

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
         * An ordered list of document IDs
         * @private
         * @type {Immutable.List.<number>}
         */
        _documentIDs: Immutable.List(),

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

        /**
         * List of paths for recent files opened in Photoshop
         * @private
         * @type {Immutable.List.<string>}
         */
        _recentFiles: Immutable.List(),

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
            this._hostVersion = null;
            this._selectedDocumentIndex = null;
            this._selectedDocumentID = null;
            this._documentIDs = Immutable.List();
            this._recentFiles = Immutable.List();
            this._initialized = Immutable.Set();
        },
        
        getState: function () {
            return {
                hostVersion: this._hostVersion,
                activeDocumentInitialized: this._initialized.get("activeDocument"),
                recentFilesInitialized: this._initialized.get("recentFiles"),
                documentIDs: this._documentIDs,
                selectedDocumentIndex: this._selectedDocumentIndex,
                selectedDocumentID: this._selectedDocumentID,
                recentFiles: this._recentFiles
            };
        },

        /**
         * Returns the id of currently active document, null if there is none
         *
         * @return {number}
         */
        getCurrentDocumentID: function () {
            return this._selectedDocumentID;
        },

        /**
         * Get the list of open document IDs
         *
         * @return {Immutable.List.<number>}
         */
        getOpenDocumentIDs: function () {
            return this._documentIDs;
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
            return documentStore.getDocument(this._selectedDocumentID);
        },

        /**
         * The number of currently open documents;
         *
         * @return {number}
         */
        getDocumentCount: function () {
            return this._documentIDs.size;
        },

        /**
         * Find either the next or previous document in the document index.
         * 
         * @private
         * @param {boolean} next Whether to find the next or previous document
         * @return {?Document}
         */
        _getNextPrevDocument: function (next) {
            if (this._selectedDocumentID === null) {
                return null;
            }

            var increment = next ? 1 : -1,
                nextDocumentIndex = this._selectedDocumentIndex + increment;

            if (nextDocumentIndex === this._documentIDs.size) {
                nextDocumentIndex = 0;
            } else if (nextDocumentIndex === -1) {
                nextDocumentIndex = this._documentIDs.size - 1;
            }

            var documentStore = this.flux.store("document"),
                nextDocmentID = this._documentIDs.get(nextDocumentIndex);

            return documentStore.getDocument(nextDocmentID);
        },

        /**
         * Find the next document in the document index.
         * 
         * @return {?Document}
         */
        getNextDocument: function () {
            return this._getNextPrevDocument(true);
        },

        /**
         * Find the previous document in the document index.
         * 
         * @return {?Document}
         */
        getPreviousDocument: function () {
            return this._getNextPrevDocument(false);
        },
        
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
                this._documentIDs = this._documentIDs.splice(currentIndex, 1);
            }

            // add it back at the correct index
            this._documentIDs = this._documentIDs.splice(itemIndex, 0, documentID);
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
                    itemIndex = rawDocument.itemIndex - 1; // doc indices start at 1

                this._updateDocumentPosition(documentID, itemIndex);

                if (payload.current) {
                    this._selectedDocumentID = documentID;
                    this._selectedDocumentIndex = itemIndex;
                }

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

                var documentIndex = this._documentIDs.indexOf(documentID);
                if (documentIndex === -1) {
                    throw new Error("Closed document ID not found in index: " + documentID);
                }

                this._documentIDs = this._documentIDs.splice(documentIndex, 1);

                var openDocumentCount = this._documentIDs.size;
                if ((openDocumentCount === 0) !== (selectedDocumentID === null)) {
                    throw new Error("Next selected document ID should be null iff there are no open documents");
                }

                if (openDocumentCount === 0) {
                    this._selectedDocumentID = null;
                    this._selectedDocumentIndex = null;
                    return;
                }

                var selectedDocumentIndex = this._documentIDs.indexOf(selectedDocumentID);
                if (selectedDocumentIndex === -1) {
                    throw new Error("Selected document ID not found in index: " + documentID);
                }

                this._selectedDocumentID = selectedDocumentID;
                this._selectedDocumentIndex = selectedDocumentIndex;

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
            this._selectedDocumentID = payload.selectedDocumentID;
            this._selectedDocumentIndex = this._documentIDs.indexOf(payload.selectedDocumentID);

            this.emit("change");
        }
    });

    module.exports = ApplicationStore;
});
