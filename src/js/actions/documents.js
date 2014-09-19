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

define(function (require, exports) {
    "use strict";

    var descriptor = require("adapter/ps/descriptor"),
        document = require("adapter/lib/document");

    var events = require("../events"),
        locks = require("js/locks"),
        Promise = require("bluebird");
        
    /**
     * Activate the already-open document at the given index.
     * 
     * @param {number} index The index of the document to select
     * @return {Promise}
     */
    var selectDocumentCommand = function (index) {
        return descriptor.playObject(document.select(document.referenceBy.index(index)))
            .then(function () {
                var payload = {
                    selectedDocumentIndex: index
                };
                
                this.dispatch(events.documents.SELECT_DOCUMENT, payload);
            });
    };
    
    /**
     * Activate the already-open document at the given offset from the index of
     * the currently active document.
     * 
     * @param {number} offset The index-offset of the document to activate
     *  relative to the currently active document
     * @return {Promise}
     */
    var scrollDocumentsCommand = function (offset) {
        return descriptor.playObject(document.select(document.referenceBy.offset(offset)))
            .then(function () {
                var payload = {
                    offset: offset
                };
                
                this.dispatch(events.documents.SCROLL_DOCUMENTS, payload);
            }.bind(this));
    };
    
    /**
     * Fetch the set of currently open documents from Photoshop
     * 
     * @return {Promise}
     */
    var updateDocumentListCommand = function () {
        return descriptor.getProperty("application", "numberOfDocuments")
            .then(function (docCount) {
                var documentGets = [];
                for (var i = 1; i <= docCount; i++) {
                    documentGets.push(descriptor.get(document.referenceBy.index(i)));
                }

                var allDocumentsPromise = Promise.all(documentGets),
                    currentDocumentPromise = descriptor.getProperty(document.referenceBy.current, "itemIndex");
                
                return Promise.join(allDocumentsPromise, currentDocumentPromise,
                    function (documents, currentIndex) {
                        var payload = {
                            selectedDocumentIndex: currentIndex,
                            documents: documents
                        };
                        this.dispatch(events.documents.DOCUMENTS_UPDATED, payload);
                    }.bind(this));
            });
    };

    var selectDocument = {
        command: selectDocumentCommand,
        writes: locks.ALL_LOCKS
    };

    var scrollDocuments = {
        command: scrollDocumentsCommand,
        writes: locks.ALL_LOCKS
    };
  
    var updateDocumentList = {
        command: updateDocumentListCommand,
        writes: locks.ALL_LOCKS
    };

    exports.selectDocument = selectDocument;
    exports.scrollDocuments = scrollDocuments;
    exports.updateDocumentList = updateDocumentList;
});
