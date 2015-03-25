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

    var synchronization = require("js/util/synchronization"),
        events = require("js/events");

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

        return Promise.resolve();
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        reads: [],
        writes: []
    };

    
    exports.beforeStartup = beforeStartup;
});
