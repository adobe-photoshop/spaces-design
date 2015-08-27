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

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable"),
        _ = require("lodash");

    var events = require("../events"),
        log = require("js/util/log"),
        LibrarySyncStatus = require("js/models/library_sync_status");

    /**
     * Empty store that simply emits change events when the history state changes.
     * Components can use this to cleanly reload or refresh their state on undo/redo.
     */
    var LibraryStore = Fluxxor.createStore({

        /**
         * @type {AdobeLibraryCollection}
         */
        _libraryCollection: null,

        /**
         * @type {Immutable.Map<number, AdobeLibraryComposite>}
         */
        _libraries: null,

        /**
         * @type {string}
         */
        _selectedLibraryID: null,

        /**
         * @type {boolean}
         */
        _serviceConnected: null,
        
        /**
         * @type {boolean}
         */
        _isSyncing: null,

        initialize: function () {
            this.bindActions(
                events.libraries.LIBRARIES_LOADED, this._handleLibrariesLoaded,
                events.libraries.LIBRARIES_UNLOADED, this._handleLibrariesUnloaded,
                
                events.libraries.LIBRARY_CREATED, this._handleLibraryCreated,
                events.libraries.LIBRARY_RENAMED, this._handleLibraryRenamed,
                events.libraries.LIBRARY_REMOVED, this._handleLibraryRemoved,
                events.libraries.LIBRARY_SELECTED, this._handleLibrarySelected,
                events.libraries.SYNC_LIBRARIES, this._handleSyncLibraries,
                
                events.libraries.ASSET_CREATED, this._handleElementCreated,
                events.libraries.ASSET_RENAMED, this._handleElementRenamed,
                events.libraries.ASSET_REMOVED, this._handleElementRemoved
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._libraryCollection = null;
            this._libraries = Immutable.Map();
            this._selectedLibraryID = null;
            this._serviceConnected = false;
            this._isSyncing = false;
        },

        _handleLibrariesUnloaded: function () {
            this._handleReset();

            this.emit("change");
        },

        /**
         * Handles a library collection load
         *
         * @private
         * @param {Object} payload - required attributes {
         *        	collection: AdobeLibraryCollection,
         *        	lastSelectedLibraryID: ?string
         *        }
         */
        _handleLibrariesLoaded: function (payload) {
            this._serviceConnected = true;
            this._libraryCollection = payload.collection;
            this._libraryStatus = new LibrarySyncStatus(this._libraryCollection);
            
            this._updateLibraries(payload.lastSelectedLibraryID);
            this._libraryStatus.addSyncListener(this._handleLibrarySync.bind(this));
            
            this.emit("change");
        },

        /**
         * Handle library sync event.
         *
         * @private
         * @param {boolean} isSyncing - if true, one or more libraries are uploading or downloading.
         * @param {boolean} libraryNumberChanged - if true, the number of the libraries has increased or decresaed. 
         */
        _handleLibrarySync: function (isSyncing, libraryNumberChanged) {
            log.debug("[CC Lib] handle sync, isSyncing:", isSyncing, ", libraryNumberChanged:", libraryNumberChanged);
            
            this._isSyncing = isSyncing;
            
            if (libraryNumberChanged) {
                this._updateLibraries();
            }
            
            this.emit("change");
        },

        /**
         * Handle library deletion.
         *
         * @private
         */
        _handleLibraryRemoved: function () {
            this._updateLibraries();
            this.emit("change");
        },

        /**
         * Handle select library event.
         *
         * @private
         * @param  {{id: string}} payload
         */
        _handleLibrarySelected: function (payload) {
            this._selectedLibraryID = payload.id;
            this.emit("change");
        },

        /**
         * Handle library creation.
         *
         * @private
         * @param  {{library: AdobeLibraryComposite}} payload
         */
        _handleLibraryCreated: function (payload) {
            this._updateLibraries(payload.library.id);
            this.emit("change");
        },

        /**
         * Handle change of library's display name.
         *
         * @private
         */
        _handleLibraryRenamed: function () {
            // Update is already reflected in _libraries. No further action required.
            this.emit("change");
        },

        /**
         * Handle asset creation.
         *
         * @private
         */
        _handleElementCreated: function () {
            // Update is already reflected in _libraries. No further action required.
            this.emit("change");
        },

        /**
         * Handle asset deletion.
         *
         * @private
         */
        _handleElementRemoved: function () {
            // Update is already reflected in _libraries. No further action required.
            this.emit("change");
        },

        /**
         * Handle change of asset's display name.
         *
         * @private
         */
        _handleElementRenamed: function () {
            // Update is already reflected in _libraries. No further action required.
            this.emit("change");
        },
        
        /**
         * Sync all libraries.
         *
         * @private
         */
        _handleSyncLibraries: function () {
            this._libraryCollection.sync();
        },
        
        /**
         * Fetch new libraries list from AdobeLibraryCollection and update the current library.
         *
         * @private
         * @param  {string} nextSelectedLibraryID - change the current library to nextSelectedLibraryID
         */
        _updateLibraries: function (nextSelectedLibraryID) {
            var lastSelectedLibrary = this.getCurrentLibrary(),
                libraries = this._libraryStatus.getFilteredLibraries();

            // Update the libraries list to the latest.
            this._libraries = Immutable.Map(_.indexBy(libraries, "id"));
            
            if (!lastSelectedLibrary || nextSelectedLibraryID) {
                // Restore the lsat selected library,
                // or select the first library if the last selected library is deleted.
                
                if (nextSelectedLibraryID && this._libraries.has(nextSelectedLibraryID)) {
                    this._selectedLibraryID = nextSelectedLibraryID;
                } else {
                    this._selectedLibraryID = this._libraries.keySeq().first();
                }
            } else if (lastSelectedLibrary && !this.getCurrentLibrary()) {
                // We just deleted the currently active library. We need to choose a different library to be the current
                // one. We want the one that appears in the menu just below the one we deleted, in other words, the next
                // newest library.
                
                if (this._libraries.isEmpty()) {
                    this._selectedLibraryID = null;
                } else {
                    var modified = lastSelectedLibrary.modified,
                        nextNewest,
                        oldest; // the oldest library of all. we'll use this if there is no next newest,
                    
                    this._libraries.forEach(function (library) {
                        if (!oldest || (library.modified < oldest.modified)) {
                            oldest = library;
                        }
                        if (library.modified < modified && (!nextNewest || library.modified > nextNewest.modified)) {
                            // lib is older than the one we deleted, but newer than nextNewest
                            nextNewest = library;
                        }
                    });

                    this._selectedLibraryID = (nextNewest || oldest).id;
                }
            }
        },

        /**
         * Returns all loaded libraries
         *
         * @return {Immutable.Iterable<AdobeLibraryComposite>}
         */
        getLibraries: function () {
            return this._libraries;
        },

        /**
         * Returns the loaded library collection
         *
         * @return {AdobeLibraryCollection}
         */
        getLibraryCollection: function () {
            return this._libraryCollection;
        },

        /**
         * Returns the Library with given ID, the library needs to be loaded first
         *
         * @param {string} id Library GUID
         *
         * @return {AdobeLibraryComposite}
         */
        getLibraryByID: function (id) {
            return this._libraries.get(id);
        },

        /**
         * Returns the currently shown library
         *
         * @return {?AdobeLibraryComposite}
         */
        getCurrentLibrary: function () {
            return this._libraries.get(this._selectedLibraryID);
        },

        getConnectionStatus: function () {
            return this._serviceConnected;
        },
        
        isSyncing: function () {
            return this._isSyncing;
        }
    });

    module.exports = LibraryStore;
});
