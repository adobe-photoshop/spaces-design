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
        photoshopEvent = require("adapter/lib/photoshopEvent"),
        document = require("adapter/lib/document");

    var events = require("../events"),
        synchronization = require("js/util/synchronization"),
        Promise = require("bluebird");
        
    var selectDocumentCommand = function (index) {
        return descriptor.playObject(document.select(document.referenceBy.index(index)))
            .then(function () {
                var payload = {
                    selectedDocumentIndex: index
                };
                
                this.dispatch(events.documents.SELECT_DOCUMENT, payload);
            });
    };
    
    var scrollDocumentsCommand = function (offset) {
        return descriptor.playObject(
            document.select(document.referenceBy.offset(offset))
        ).then(function () {
            var payload = {
                offset: offset
            };
            
            this.dispatch(events.documents.SCROLL_DOCUMENTS, payload);
        }.bind(this));
    };
    
    var updateDocumentList = function () {
        var self = this;
        
        return descriptor.getProperty("application", "numberOfDocuments")
            .then(function (docCount) {
                var documentGets = [];
                for (var i = 1; i <= docCount; i++) {
                    documentGets.push(descriptor.get(document.referenceBy.index(i)));
                }
                
                return Promise.all(documentGets).then(function (documents) {
                    return descriptor.getProperty(document.referenceBy.current, "itemIndex")
                        .then(function (currentIndex) {
                            var payload = {
                                selectedDocumentIndex: currentIndex,
                                documents: documents
                            };
                            self.dispatch(events.documents.DOCUMENTS_UPDATED, payload);
                        });
                });
            });
    };
    
    var listenToDocuments = function () {
        var self = this;
        descriptor.addListener("make", function (event) {
            if (photoshopEvent.targetOf(event) === "document") {
                updateDocumentList.call(self);
            }
        });
        
        descriptor.addListener("select", function (event) {
            if (photoshopEvent.targetOf(event) === "document") {
                updateDocumentList.call(self);
            }
        });
        
        return updateDocumentList.call(self);
        
    };

    var selectDocument = {
        command: selectDocumentCommand,
        reads: [synchronization.LOCKS.APP],
        writes: []
    };
    
    var startListening = {
        command: listenToDocuments,
        reads: [synchronization.LOCKS.APP],
        writes: []
    };
    
    var scrollDocuments = {
        command: scrollDocumentsCommand,
        reads: [synchronization.LOCKS.APP],
        writes: []
    };
    
    exports.selectDocument = selectDocument;
    exports.scrollDocuments = scrollDocuments;
    exports.startListening = startListening;
});
