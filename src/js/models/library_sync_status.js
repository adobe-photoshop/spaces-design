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
    
    var _ = require("lodash"),
        EventEmitter = require("eventEmitter");
    
    var log = require("js/util/log");

    /**
     * LibrarySyncStatus is a wrapper class of the AdobeLibraryCollection instance to provide an easy way
     * for listening to its sync status. Read LibrarySyncStatus#addSyncListener for more details of the 
     * sync status.
     */
    var LibrarySyncStatus = function (libraryCollection) {
        this._libraryCollection = libraryCollection;
        this._emitter = new EventEmitter(this);
        
        // Contains the ID of the libraries that are currently syncing with remote server.
        this._syncingLibraryIDs = new Set();
        
        this._status = {
            isSyncing: false,
            libraryNumber: this.getFilteredLibraries().length
        };
         
        this._libraryCollection.addSyncListener(this._onLibraryCollectionSync.bind(this));
    };
    
    /**
     * Listen to libraries' sync status. 
     *
     * @param {function(isSyncing, libraryNumberChanged)} listener
     *        isSyncing - if true, one or more libraries are uploading or downloading.
     *        libraryNumberChanged - if true, the number of the libraries has increased or decresaed. 
     * 
     */
    LibrarySyncStatus.prototype.addSyncListener = function (listener) {
        this._emitter.addListener("sync", listener);
    };
    
    /**
     * Handle AdobeLibraryCollection sync event.
     *
     * @private
     */
    LibrarySyncStatus.prototype._onLibraryCollectionSync = function () {
        log.debug("[CC Lib] on collection change");
        
        var newLibraries = this._libraryCollection.getNewLibrarySyncProgress();
       
        // Check for new libraries created from other source and their sync progress. 
        newLibraries.forEach(function (data) {
            log.debug("[CC Lib] new library", data.progress);
            
            if (data.progress !== 100) {
                this._syncingLibraryIDs.add(data.id);
            } else {
                this._syncingLibraryIDs.delete(data.id);
            }
        }, this);
        
        // Check the sync status of the existing libraries.
        this._libraryCollection.libraries.forEach(function (library) {
            var isLibrarySyncing = this._syncingLibraryIDs.has(library.id);
            
            // Whenever a library is syncing, its "syncState" will have a string value (e.g. downloading or uploading).
            if (!library.syncState && isLibrarySyncing) {
                log.debug("[CC Lib] done library sync [", library.name, "]");
                
                this._syncingLibraryIDs.delete(library.id);
            } else if (library.syncState && !isLibrarySyncing) {
                log.debug("[CC Lib] on library sync [", library.name, "]", library.syncState, library.syncProgress);
                
                this._syncingLibraryIDs.add(library.id);
            }
        }, this);
        
        this._emit();
    };
    
    /**
     * Return libraries that are not deleted in local machine and remote server.
     *
     * @return {Array.<AdobeLibraryComposite>}
     */
    LibrarySyncStatus.prototype.getFilteredLibraries = function () {
        return _.filter(this._libraryCollection.libraries, { deletedLocally: false, deletedFromServer: false });
    };
    
    /**
     * Notify sync event listeners when the sync status changed.
     *
     * @private
     */
    LibrarySyncStatus.prototype._emit = function () {
        var libraries = this.getFilteredLibraries();
        
        var newStatus = {
            isSyncing: this._syncingLibraryIDs.size !== 0,
            libraryNumber: libraries.length
        };
        
        if (newStatus.isSyncing || !_.isEqual(this._status, newStatus)) {
            var libNumberChanged = this._status.libraryNumber !== newStatus.libraryNumber;
            
            this._emitter.emit("sync", newStatus.isSyncing, libNumberChanged);
            this._status = newStatus;
        }
    };
    
    module.exports = LibrarySyncStatus;
});
