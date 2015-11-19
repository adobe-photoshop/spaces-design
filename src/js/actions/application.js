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

    var descriptor = require("adapter").ps.descriptor;

    var events = require("../events"),
        locks = require("js/locks"),
        ruler = require("adapter").lib.ruler;

    /**
     * Gets the application version
     * @return {Promise}
     */
    var hostVersion = function () {
        return descriptor.getProperty("application", "hostVersion")
            .bind(this)
            .then(this.dispatch.bind(this, events.application.HOST_VERSION));
    };
    hostVersion.action = {
        reads: [locks.PS_APP],
        writes: [locks.JS_APP]
    };

    /** 
     * Gets list of recently opened files from Photoshop
     *
     * @return {Promise}
     */
    var updateRecentFiles = function () {
        return descriptor.getProperty("application", "recentFilesAsStrings")
            .bind(this)
            .catch(function () {
                // If there are no recent files, this property is not available
                return [];
            })
            .then(function (recentFiles) {
                var payload = {
                    recentFiles: recentFiles
                };

                this.dispatch(events.application.UPDATE_RECENT_FILES, payload);
                this.dispatch(events.application.INITIALIZED, { item: "recentFiles" });
            });
    };
    updateRecentFiles.action = {
        reads: [locks.PS_APP],
        writes: [locks.JS_APP]
    };

    /**
     * During init, grabs the recent file list for the menu
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        var appStore = this.flux.store("application"),
            recentFilesInitialized = appStore.getState().recentFilesInitialized,
            updateRecentFilesPromise = recentFilesInitialized ?
                Promise.resolve() :
                this.transfer(updateRecentFiles),
            setRulerUnitsPromise = descriptor.playObject(ruler.setRulerUnits("rulerPixels"));

        return Promise.join(setRulerUnitsPromise, updateRecentFilesPromise);
    };
    afterStartup.action = {
        reads: [],
        writes: [locks.PS_APP],
        transfers: [updateRecentFiles]
    };

    exports.hostVersion = hostVersion;
    exports.updateRecentFiles = updateRecentFiles;
    exports.afterStartup = afterStartup;
});
