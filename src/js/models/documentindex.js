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

define(function (require, exports, module) {
    "use strict";

    var Immutable = require("immutable");

    var object = require("js/util/object");

    /**
     * Model of the Photoshop document index.
     * 
     * @constructor
     */
    var DocumentIndex = Immutable.Record({
        /**
         * An ordered list of document IDs
         * @type {Immutable.List.<number>}
         */
        openDocumentIDs: Immutable.List(),

        /**
         * The index of the currently active document; negative if there are none
         * @type {number}
         */
        activeDocumentIndex: -1,

        /**
         * The ID of the currently active document, or null if there are none
         * @type {?number}
         */
        activeDocumentID: null
    });

    /**
     * Set the position of the given document ID in the document index.
     *
     * @private
     * @param {number} documentID
     * @param {number} position
     * @return {DocumentIndex}
     */
    DocumentIndex.prototype._updateDocumentPosition = function (documentID, position) {
        // find the document in the array of indices
        var openDocumentIDs = this.openDocumentIDs,
            currentIndex = openDocumentIDs.indexOf(documentID),
            nextDocumentIDs = openDocumentIDs;
        
        if (currentIndex > -1) {
            // remove it from the index
            nextDocumentIDs = nextDocumentIDs.delete(currentIndex);
        }

        // re-add it at the correct position
        nextDocumentIDs = nextDocumentIDs.splice(position, 0, documentID);

        return this.set("openDocumentIDs", nextDocumentIDs);
    };

    /**
     * Set the active document in the index.
     *
     * @param {number} documentID
     * @param {number=} position
     * @return {DocumentIndex}
     */
    DocumentIndex.prototype.setActive = function (documentID, position) {
        if (position === undefined) {
            position = this.openDocumentIDs.indexOf(documentID);
            if (position < 0) {
                throw new Error("Document ID not found in index: " + documentID);
            }
        }

        return this.merge({
            activeDocumentID: documentID,
            activeDocumentIndex: position
        });
    };

    /**
     * Set (or reset) the position of a document in the index.
     * 
     * @param {number} documentID
     * @param {number} position
     * @param {boolean=} active
     * @return {DocumentIndex}
     */
    DocumentIndex.prototype.setPosition = function (documentID, position, active) {
        var nextIndex = this._updateDocumentPosition(documentID, position);

        if (active) {
            nextIndex = nextIndex.setActive(documentID, position);
        }

        return nextIndex;
    };

    /**
     * Remove a document from the index and set the next active document.
     *
     * @param {number} documentID
     * @param {?number} nextActiveDocumentID
     * @return {DocumentIndex}
     */
    DocumentIndex.prototype.remove = function (documentID, nextActiveDocumentID) {
        var openDocumentIDs = this.openDocumentIDs,
            documentIndex = openDocumentIDs.indexOf(documentID);

        if (documentIndex < 0) {
            throw new Error("Closed document ID not found in index: " + documentID);
        }

        var nextDocumentIDs = openDocumentIDs.delete(documentIndex),
            hasOpenDocuments = !nextDocumentIDs.isEmpty(),
            hasNextActiveDocumentID = typeof nextActiveDocumentID === "number";

        if (hasOpenDocuments !== hasNextActiveDocumentID) {
            throw new Error("There must be a next active document ID iff there are open documents");
        }

        var nextActiveDocumentIndex;
        if (hasOpenDocuments) {
            nextActiveDocumentIndex = nextDocumentIDs.indexOf(nextActiveDocumentID);
            if (nextActiveDocumentIndex < 0) {
                throw new Error("Next active document ID not found in index: " + documentID);
            }
        } else {
            nextActiveDocumentID = null;
            nextActiveDocumentIndex = -1;
        }

        return this.merge({
            openDocumentIDs: nextDocumentIDs,
            activeDocumentID: nextActiveDocumentID,
            activeDocumentIndex: nextActiveDocumentIndex
        });
    };

    Object.defineProperties(DocumentIndex.prototype, object.cachedGetSpecs({
        /**
         * Find the next document in the document index.
         * 
         * @type {?number}
         */
        "nextID": function () {
            if (this.activeDocumentID === null) {
                return null;
            }

            var nextDocumentIndex = this.activeDocumentIndex + 1;
            if (nextDocumentIndex === this.openDocumentIDs.size) {
                nextDocumentIndex = 0;
            }

            return this._documentIDs.get(nextDocumentIndex);
        },

        /**
         * Find the previous document in the document index.
         * 
         * @type {?number}
         */
        "previousID": function () {
            if (this.activeDocumentID === null) {
                return null;
            }

            var nextDocumentIndex = this.activeDocumentIndex - 1;
            if (nextDocumentIndex < 0) {
                nextDocumentIndex = this.openDocumentIDs.size - 1;
            }

            return this._documentIDs.get(nextDocumentIndex);
        }
    }));

    module.exports = DocumentIndex;
});
