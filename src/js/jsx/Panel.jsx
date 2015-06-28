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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Immutable = require("immutable"),
        classnames = require("classnames");

    var Properties = require("jsx!./Properties"),
        RecentFiles = require("jsx!./sections/nodoc/RecentFiles"),
        ArtboardPresets = require("jsx!./sections/nodoc/ArtboardPresets"),
        collection = require("js/util/collection");
        
    var Panel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("application")],

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                applicationState = applicationStore.getState(),
                documentIDs = applicationState.documentIDs,
                activeDocumentID = applicationState.selectedDocumentID,
                activeDocumentInitialized = applicationState.activeDocumentInitialized,
                recentFilesInitialized = applicationState.recentFilesInitialized,
                recentFiles = applicationState.recentFiles,
                currentlyMountedDocumentIDs = this.state ? this.state.mountedDocumentIDs : Immutable.Set(),
                mountedDocumentIDs = collection.intersection(documentIDs, currentlyMountedDocumentIDs)
                    .push(activeDocumentID)
                    .toSet();

            return {
                activeDocumentInitialized: activeDocumentInitialized,
                recentFilesInitialized: recentFilesInitialized,
                recentFiles: recentFiles,
                activeDocumentID: activeDocumentID,
                documentIDs: documentIDs,
                mountedDocumentIDs: mountedDocumentIDs
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            // Don't re-render if we're just going temporarily inactive so that
            // the UI doesn't blink unnecessarily.
            if (this.props.active && !nextProps.active) {
                return false;
            }

            // Don't re-render until either the active document or recent files
            // are initialized.
            if (!nextState.activeDocumentInitialized ||
                (!this.state.document && !nextState.recentFilesInitialized)) {
                return false;
            }

            return this.state.activeDocumentID !== nextState.activeDocumentID ||
                this.state.activeDocumentInitialized !== nextState.activeDocumentInitialized ||
                this.state.recentFilesInitialized !== nextState.recentFilesInitialized ||
                (nextState.documentIDs.size === 0 && !Immutable.is(this.state.recentFiles, nextState.recentFiles));
        },

        render: function () {
            var documentIDs = this.state.documentIDs;

            if (this.state.activeDocumentInitialized && documentIDs.size > 0) {
                var activeDocumentID = this.state.activeDocumentID,
                    documentProperties = this.state.mountedDocumentIDs.map(function (documentID) {
                        var current = documentID === activeDocumentID,
                            className = classnames({
                                "panel__element": true,
                                "panel__element__active": current
                            });

                        return (
                            <div className={className} key={documentID}>
                                <Properties
                                    documentID={documentID}
                                    current={current} />
                            </div>
                        );
                    }, this);
                return (
                    <div className="panel">
                        {documentProperties}
                    </div>
                );
            } else if (this.state.recentFilesInitialized) {
                return (
                    <div className="panel">
                        <RecentFiles recentFiles={this.state.recentFiles} />
                        <ArtboardPresets />
                    </div>
                );
            } else {
                return (
                    <div className="panel"></div>
                );
            }
        }

    });

    module.exports = Panel;
});
