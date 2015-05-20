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
        Immutable = require("immutable");

    var TransformPanel = require("jsx!./sections/transform/TransformPanel"),
        LibrariesPanel = require("jsx!./sections/libraries/LibrariesPanel"),
        StylePanel = require("jsx!./sections/style/StylePanel"),
        PagesPanel = require("jsx!./sections/pages/PagesPanel"),
        RecentFiles = require("jsx!./sections/nodoc/RecentFiles"),
        ArtboardPresets = require("jsx!./sections/nodoc/ArtboardPresets");
        
    var Properties = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("document", "application", "preferences", "draganddrop")],

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var applicationStore = this.getFlux().store("application"),
                document = applicationStore.getCurrentDocument(),
                disabled = document && document.unsupported,
                preferencesStore = this.getFlux().store("preferences"),
                preferences = preferencesStore.getState(),
                styleVisible = !disabled && preferences.get("styleVisible", true),
                pagesVisible = disabled || preferences.get("pagesVisible", true),
                dragAndDropStore = this.getFlux().store("draganddrop"),
                dragAndDropState = dragAndDropStore.getState();

            return {
                activeDocumentInitialized: applicationStore.getState().activeDocumentInitialized,
                recentFilesInitialized: applicationStore.getState().recentFilesInitialized,
                recentFiles: applicationStore.getRecentFiles(),
                document: document,
                disabled: disabled,
                styleVisible: styleVisible,
                pagesVisible: pagesVisible,
                dragTarget: dragAndDropState.dragTarget,
                dropTarget: dragAndDropState.dropTarget,
                dragPosition: dragAndDropState.dragPosition,
                pastDragTarget: dragAndDropState.pastDragTarget
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

            return this.state.styleVisible !== nextState.styleVisible ||
                this.state.pagesVisible !== nextState.pagesVisible ||
                this.state.activeDocumentInitialized !== nextState.activeDocumentInitialized ||
                this.state.recentFilesInitialized !== nextState.recentFilesInitialized ||
                this.state.dragTarget !== nextState.dragTarget ||
                this.state.dropTarget !== nextState.dropTarget ||
                this.state.dragPosition !== nextState.dragPosition ||
                !Immutable.is(this.state.document, nextState.document) ||
                (!nextState.document && !Immutable.is(this.state.recentFiles, nextState.recentFiles));
        },

        /**
         * Toggle visibility of either the pages or the style section.
         *
         * @private
         * @param {boolean} pages Whether the pages or style section is being toggled
         */
        _handleVisibilityToggle: function (pages) {
            if (this.state.disabled) {
                return;
            }

            var primary = pages ? "pagesVisible" : "styleVisible",
                secondary = pages ? "styleVisible" : "pagesVisible",
                nextState = {};

            if (this.state[primary]) {
                nextState[primary] = false;
                nextState[secondary] = true;
            } else {
                nextState[primary] = true;
            }

            this.getFlux().actions.preferences.setPreferences(nextState);
            this.setState(nextState);
        },
        
        render: function () {
            var document = this.state.document,
                disabled = this.state.disabled;

            if (this.state.activeDocumentInitialized && document) {
                return (
                    <div className="properties">
                        <TransformPanel
                            disabled={disabled}
                            document={document} />
                        <LibrariesPanel
                            disabled={disabled}
                            visible={true}
                            visibleSibling={this.state.styleVisible} />
                        <StylePanel
                            disabled={disabled}
                            document={document}
                            visible={this.state.styleVisible}
                            visibleSibling={this.state.pagesVisible}
                            onVisibilityToggle={this._handleVisibilityToggle.bind(this, false)} />
                        <PagesPanel
                            disabled={disabled}
                            document={document}
                            visible={this.state.pagesVisible}
                            visibleSibling={this.state.styleVisible}
                            onVisibilityToggle={this._handleVisibilityToggle.bind(this, true)}
                            dragTarget={this.state.dragTarget}
                            dropTarget={this.state.dropTarget}
                            dragPosition={this.state.dragPosition}
                            pastDragTarget={this.state.pastDragTarget} />
                    </div>
                );
            } else if (this.state.recentFilesInitialized) {
                return (
                    <div className="properties">
                        <RecentFiles recentFiles={this.state.recentFiles || []} />
                        <ArtboardPresets />
                    </div>
                );
            } else {
                return (
                    <div className="properties"></div>
                );
            }
        }

    });

    module.exports = Properties;
});
