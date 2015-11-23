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
        math = require("js/util/math");
    
    /**
     * Regular expression for removing invalid characters in graphic asset's temp filename.
     *
     * @private
     * @type {RegExp}
     */
    var _TRIM_FILE_NAME_REGEXP = /(<|>|:|"|\/|\\|\||\?|\*|\@|[\x00-\x1F])|\(|\)|\{|\}|\,| /g;

    /**
     * Empty store that simply emits change events when the history state changes.
     * Components can use this to cleanly reload or refresh their state on undo/redo.
     */
    var LibraryStore = Fluxxor.createStore({

        /**
         * @type {Object}
         */
        _librariesAPI: null,

        /**
         * @type {AdobeLibraryCollection}
         */
        _libraryCollection: null,

        /**
         * @type {Immutable.Map.<string, AdobeLibraryComposite>}
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
        
        /**
         * @typedef {object} EditStatus
         * @property {string} documentPath
         * @property {string} previewPath
         * @property {AdobeLibraryElement} elements
         * @property {boolean} isUpdatingContent
         * @property {boolean} isDocumentClosed
         */
        
        /**
         * Store the edit status of all opened graphic asset 
         * @type {Immutable.Map.<number, EditStatus>}
         */
        _editStatusByDocumentID: null,
        
        /**
         * Store the last locally created element.
         * @type {AdobeLibraryElement}
         */
        _lastLocallyCreatedElement: null,
        
        /**
         * Store the last locally updated graphic element.
         * @type {AdobeLibraryElement}
         */
        _lastLocallyUpdatedGraphic: null,
        
        /**
         * @type {boolean}
         */
        _isPlacingGraphic: null,

        initialize: function () {
            this.bindActions(
                events.libraries.LIBRARIES_API_LOADED, this._handleLibraryAPIsLoaded,
                events.libraries.LIBRARIES_LOADED, this._handleLibrariesLoaded,
                events.libraries.LIBRARIES_UNLOADED, this._handleLibrariesUnloaded,
                
                events.libraries.LIBRARY_CREATED, this._handleLibraryCreated,
                events.libraries.LIBRARY_RENAMED, this._handleLibraryRenamed,
                events.libraries.LIBRARY_REMOVED, this._handleLibraryRemoved,
                events.libraries.LIBRARY_SELECTED, this._handleLibrarySelected,
                events.libraries.SYNC_LIBRARIES, this._handleSyncLibraries,
                events.libraries.SYNCING_LIBRARIES, this._handleSyncingLibraries,
                
                events.libraries.ASSET_CREATED, this._handleElementCreated,
                events.libraries.ASSET_RENAMED, this._handleElementRenamed,
                events.libraries.ASSET_REMOVED, this._handleElementRemoved,

                events.libraries.OPEN_GRAPHIC_FOR_EDIT, this._handleOpenGraphicForEdit,
                events.libraries.PLACE_GRAPHIC_UPDATED, this._handlePlaceGraphicUpdate,
                events.libraries.UPDATING_GRAPHIC_CONTENT, this._handleUpdatingGraphicContent,
                events.libraries.UPDATED_GRAPHIC_CONTENT, this._handleUpdatedGraphicContent,
                events.document.CLOSE_DOCUMENT, this._handleClosedGraphicDocument,
                events.libraries.DELETED_GRAPHIC_TEMP_FILES, this._handleDeletedGraphicTempFiles
            );

            this._handleReset();
        },

        /**
         * @typedef {object} LibraryState
         * @property {Immutable.Map.<string, AdobeLibraryComposite>} libraries - libraries map by IDs
         * @property {?AdobeLibraryCollection} libraryCollection
         * @property {?string} currentLibraryID
         * @property {?AdobeLibraryComposite} currentLibrary
         * @property {Immutable.Map.<number, EditStatus>} editStatus
         * @property {boolean} isConnected
         * @property {boolean} isSyncing
         * @property {boolean} isPlacingGraphic - ture if DS is in placing graphic mode.
         * @property {?AdobeLibraryElement} lastLocallyCreatedElement
         * @property {?AdobeLibraryElement} lastLocallyUpdatedGraphic
         * 
         * @return {LibraryState} 
         */
        getState: function () {
            return {
                libraries: this._libraries,
                libraryCollection: this._libraryCollection,
                currentLibraryID: this._selectedLibraryID,
                currentLibrary: this.getLibraryByID(this._selectedLibraryID),
                editStatus: this._editStatusByDocumentID,
                isConnected: this._serviceConnected,
                isSyncing: this._isSyncing,
                isPlacingGraphic: this._isPlacingGraphic,
                lastLocallyCreatedElement: this._lastLocallyCreatedElement,
                lastLocallyUpdatedGraphic: this._lastLocallyUpdatedGraphic
            };
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
            this._isPlacingGraphic = false;
            this._editStatusByDocumentID = new Immutable.Map();
            this._lastLocallyCreatedElement = null;
            this._lastLocallyUpdatedGraphic = null;
        },

        /** @ignore */
        _handleLibrariesUnloaded: function () {
            this._handleReset();

            this.emit("change");
        },

        /**
         * Once we load CCLibraries API from file://shared
         * We make them available here
         *
         * @private
         * @param {Object} ccLibraries 
         */
        _handleLibraryAPIsLoaded: function (ccLibraries) {
            this._librariesAPI = ccLibraries;
        },

        /**
         * Handles a library collection load
         *
         * @private
         * @param {object} payload
         * @param {AdobeLibraryCollection} payload.collection
         * @param {object} payload.editStatus
         * @param {string} payload.lastSelectedLibraryID
         */
        _handleLibrariesLoaded: function (payload) {
            this._serviceConnected = true;
            this._libraryCollection = payload.collection;
            this._updateLibraries(payload.lastSelectedLibraryID);
            
            var editStatusArray = _.reduce(payload.editStatus, function (result, status, documentIDStr) {
                // Remove orphan edit status that are not associate with any open documents.

                var documentID = math.parseNumber(documentIDStr);
                
                if (!documentID) {
                    return result;
                }
                
                var document = this.flux.stores.document.getDocument(documentID),
                    documentName = document ? document.name : "";
                
                if (documentName.indexOf(status.elementID) !== -1) {
                    result.push([documentID, status]);
                }
                
                return result;
            }.bind(this), []);
            
            this._editStatusByDocumentID = new Immutable.Map(editStatusArray);
            
            this.emit("change");
        },

        /**
         * Handle library sync event.
         *
         * @private
         *
         * @param {object} payload
         * @param {boolean} payload.isSyncing - if true, one or more libraries are uploading or downloading.
         * @param {boolean} payload.libraryNumberChanged - true if the number of the libraries 
         * has increased or decresaed.
         */
        _handleSyncingLibraries: function (payload) {
            var isSyncing = payload.isSyncing,
                libraryNumberChanged = payload.libraryNumberChanged;
            
            log.debug("[CC Lib] handle sync, isSyncing: %s, libraryNumberChanged: %s", isSyncing, libraryNumberChanged);
            
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
         * @param {object} payload
         * @param {string} payload.id - selected library ID
         */
        _handleLibrarySelected: function (payload) {
            this._updateLibraries(payload.id);
            this.emit("change");
        },

        /**
         * Handle library creation.
         *
         * @private
         * @param {object} payload
         * @param {AdobeLibraryComposite} payload.library
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
        _handleElementCreated: function (payload) {
            this._lastLocallyCreatedElement = payload.element;
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
         * Handle open-graphic-for-edit event by creating an edit status for the opened document.
         *
         * @private
         * @param {object} payload
         * @param {number} payload.documentID
         * @param {AdobeLibraryElement} payload.element
         * @param {string} payload.documentPath
         * @param {string} payload.previewPath
         */
        _handleOpenGraphicForEdit: function (payload) {
            var documentID = payload.documentID,
                element = payload.element,
                documentPath = payload.documentPath,
                previewPath = payload.previewPath;
            
            this._setEditStatus(documentID, {
                documentPath: documentPath,
                previewPath: previewPath,
                elementID: element.id,
                elementReference: element.getReference(),
                isUpdatingContent: false,
                isDocumentClosed: false
            });
        },
        
        /**
         * Handle update of place graphic event. 
         *
         * @param {object} payload
         * @param {boolean} payload.isPlacing
         */
        _handlePlaceGraphicUpdate: function (payload) {
            this._isPlacingGraphic = payload.isPlacing;
        },
        
        /**
         * Set the element's edit status by its document's ID
         *
         * @private
         * @param {number} documentID
         * @param {editStatus} editStatus
         */
        _setEditStatus: function (documentID, editStatus) {
            if (editStatus) {
                this._editStatusByDocumentID = this._editStatusByDocumentID.set(documentID, editStatus);
            } else {
                this._editStatusByDocumentID = this._editStatusByDocumentID.delete(documentID);
            }
        },
        
        /**
         * Handle save document. If an element is associated with the document, we update the element's 
         * content and preview image.
         *
         * @private
         * @param {object} payload
         * @param {number} payload.documentID 
         * @param {AdobeLibraryElement} payload.element
         */
        _handleUpdatingGraphicContent: function (payload) {
            var documentID = payload.documentID,
                editStatus = this._editStatusByDocumentID.get(documentID);
                
            if (!editStatus) {
                return;
            }
            
            editStatus.isUpdatingContent = true;
            this._lastLocallyUpdatedGraphic = payload.element;
            this.emit("change");
        },

        /**
         * Handle updated graphic content.
         *
         * @private
         * @param {object} payload
         * @param {number} payload.documentID
         */
        _handleUpdatedGraphicContent: function (payload) {
            var documentID = payload.documentID,
                editStatus = this._editStatusByDocumentID.get(documentID);
                
            if (!editStatus) {
                return;
            }
            
            editStatus.isUpdatingContent = false;
        },
        
        /**
         * Delete the document and its preview file if the graphic asset's document is closed. 
         *
         * @private
         * @param {object} payload
         * @param {number} payload.documentID
         */
        _handleClosedGraphicDocument: function (payload) {
            var documentID = payload.documentID,
                editStatus = this._editStatusByDocumentID.get(documentID);
                
            if (!editStatus) {
                return;
            }
            
            editStatus.isDocumentClosed = true;
        },
        
        /**
         * Handle deleted graphic asset's temp document and preview image.
         *
         * @private
         * @param {object} payload
         * @param {number} payload.documentID
         */
        _handleDeletedGraphicTempFiles: function (payload) {
            this._setEditStatus(payload.documentID, null);
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
            var lastSelectedLibrary = this.getLibraryByID(this._selectedLibraryID),
                libraries = _.filter(this._libraryCollection.libraries,
                    { deletedLocally: false, deletedFromServer: false });

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
            } else if (lastSelectedLibrary && !this.getLibraryByID(this._selectedLibraryID)) {
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
         * Find element in all libraries by its reference.
         *
         * @param {string} elementReference
         * @return {?AdobeLibraryElement}
         */
        getElementByReference: function (elementReference) {
            if (!this._librariesAPI) {
                throw new Error("Libraries API is not loaded yet!");
            }

            return this._librariesAPI.resolveElementReference(elementReference);
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
         * Get edit status by element 
         *
         * @param {AdobeLibraryElement} element
         * @return {?EditStatus}
         */
        getEditStatusByElement: function (element) {
            return this._editStatusByDocumentID.find(function (status) {
                return status.elementReference === element.getReference();
            });
        },
        
        /**
         * Generate temp filename for specific element. The filename will contain the element's name and id.
         * 
         * Example: if an element's name is "Rectangle 1", and its id is "a251670a-ab65-4800", then the temp filename
         * will be "Rectangle1@a251670a-ab65-4800"
         * 
         * @param {AdobeLibraryElement} element
         * @return {string}
         */
        generateTempFilename: function (element) {
            return element.name.replace(_TRIM_FILE_NAME_REGEXP, "") + "@" + element.id + ".psd";
        },

        /**
         * Returns the loaded libraries API
         *
         * @return {Object} CCLibraries API global object
         */
        getLibrariesAPI: function () {
            return this._librariesAPI;
        }
    });

    module.exports = LibraryStore;
});
