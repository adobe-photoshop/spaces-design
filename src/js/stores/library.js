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

    var events = require("../events");

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
         * @type {Immutable.Map<number, Immutable.Iterable<AdobeLibraryElement>>}
         */
        _libraryItems: null,

        /**
         * @type {string}
         */
        _currentLibraryID: null,

        _serviceConnected: null,

        initialize: function () {
            this.bindActions(
                events.libraries.LIBRARIES_UPDATED, this._handleLibraryData,
                events.libraries.LIBRARY_CREATED, this._handleLibraryCreated,
                events.libraries.LIBRARY_REMOVED, this._handleLibraryRemoved,
                events.libraries.LIBRARY_PREPARED, this._handleLibraryPrepared,
                events.libraries.CONNECTION_FAILED, this._handleConnectionFailed
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._libraries = Immutable.Map();
            this._libraryItems = Immutable.Map();
            this._currentLibraryID = "";
            this._serviceConnected = false;
        },

        _handleConnectionFailed: function () {
            this._handleReset();

            this.emit("change");
        },

        /**
         * Handles a library collection load
         *
         * @private
         * @param {{libraries: Array.<AdobeLibraryComposite>, collection: AdobeLibraryCollection}} payload
         */
        _handleLibraryData: function (payload) {
            var libraries = payload.libraries,
                libraryIDs = _.pluck(libraries, "id"),
                zippedList = _.zip(libraryIDs, libraries);

            this._libraries = Immutable.Map(zippedList);
            this._libraryCollection = payload.collection;
            this._serviceConnected = true;
            
            this.emit("change");
        },

        /**
         * Handles a library elements renditions prepared
         *
         * @private
         * @param {Object} payload
         * @param {AdobeLibraryComposite} payload.library Owner library
         * @param {Array.<AdobeLibraryElement>} payload.elements
         */
        _handleLibraryPrepared: function (payload) {
            var libraryElements = Immutable.List(payload.elements);

            this._currentLibraryID = payload.library.id;
            this._libraryItems = this._libraryItems.set(payload.library.id, Immutable.List(libraryElements));

            this.emit("change");
        },

        _handleLibraryRemoved: function (payload) {
            var id = payload.id;

            this._libraries = this._libraries.delete(id);
            this._libraryItems = this._libraryItems.delete(id);

            this.emit("change");
        },

        _handleLibraryCreated: function (payload) {
            var newLibrary = payload.library;

            this._libraries = this._libraries.set(newLibrary.id, newLibrary);

            this.emit("change");
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
         * Returns the elements in the library
         *
         * @param {string} id Library GUID
         *
         * @return {Immutable.Iterable<AdobeLibraryElement>}
         */
        getLibraryItems: function (id) {
            return this._libraryItems.get(id);
        },

        /**
         * Returns the currently shown library
         *
         * @return {AdobeLibraryComposite}
         */
        getCurrentLibrary: function () {
            return this._libraries.get(this._currentLibraryID);
        },

        getConnectionStatus: function () {
            return this._serviceConnected;
        }
    });

    module.exports = LibraryStore;
});
