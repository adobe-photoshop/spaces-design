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

    var Promise = require("bluebird");

    var descriptor = require("adapter/ps/descriptor"),
        photoshopEvent = require("adapter/lib/photoshopEvent");

    var locks = require("js/locks"),
        synchronization = require("js/util/synchronization"),
        events = require("js/events");

    /**
     * Updates the history state for the current document
     * @return {Promise}
     */
    var updateHistoryStateCommand = function () {
        var currentDocumentID = this.flux.store("application").getCurrentDocumentID();
        
        if (currentDocumentID === null) {
            return Promise.resolve();
        }

        return descriptor.get("historyState")
            .bind(this)
            .then(function (historyState) {
                var payload = {
                    documentID: currentDocumentID,
                    name: historyState.name,
                    totalStates: historyState.count,
                    currentState: historyState.itemIndex
                };

                this.dispatch(events.history.NEW_HISTORY_STATE, payload);
            });
    };

    /**
     * Register event listeners for step back/forward commands
     * @return {Promise}
     */
    var beforeStartupCommand = function () {
        var updateDocument = this.flux.actions.documents.updateCurrentDocument,
            updateDocumentDebounced = synchronization.debounce(function () {
                return updateDocument()
                    .bind(this)
                    .then(function () {
                        this.dispatch(events.history.HISTORY_STATE_CHANGE);
                    });
            }, this);

        // Listen for historyState select events
        descriptor.addListener("select", function (event) {
            if (photoshopEvent.targetOf(event) === "historyState") {
                updateDocumentDebounced();
            }
        }.bind(this));

        // We get these every time there is a new history state being created
        // or we undo/redo (step forwards/backwards)
        // Numbers provided here are 0 based, while getting the same numbers
        // through get("historyState") are 1 based, so we make up for it here.
        descriptor.addListener("historyState", function (event) {
            var currentDocumentID = this.flux.store("application").getCurrentDocumentID();

            if (currentDocumentID === null) {
                return;
            }

            var payload = {
                documentID: currentDocumentID,
                name: event.name,
                totalStates: event.historyStates + 1,
                currentState: event.currentHistoryState + 1
            };

            this.dispatchAsync(events.history.NEW_HISTORY_STATE, payload);
        }.bind(this));

        return Promise.resolve();
    };

    var updateHistoryState = {
        command: updateHistoryStateCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC]
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        reads: [],
        writes: []
    };

    exports.updateHistoryState = updateHistoryState;
    exports.beforeStartup = beforeStartup;
});
