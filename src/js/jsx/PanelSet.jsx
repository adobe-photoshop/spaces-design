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

    var Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        RecentFiles = require("jsx!./sections/nodoc/RecentFiles"),
        ArtboardPresets = require("jsx!./sections/nodoc/ArtboardPresets"),
        PanelColumn = require("jsx!./PanelColumn"),
        TransformPanel = require("jsx!./sections/transform/TransformPanel"),
        StylePanel = require("jsx!./sections/style/StylePanel"),
        LayersPanel = require("jsx!./sections/layers/LayersPanel"),
        LibrariesPanel = require("jsx!./sections/libraries/LibrariesPanel"),
        collection = require("js/util/collection");

    var UI = {
        LAYERS_LIBRARY_COL: "layersLibrariesVisible",
        PROPERTIES_COL: "propertiesVisible",
        TRANSFORM_PANEL: "transformVisible",
        STYLES_PANEL: "stylesVisible",
        LAYERS_PANEL: "layersVisible",
        LIBRARY_PANEL: "libraryVisible"
    };

    var PanelSet = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("application", "document")],
        
        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                applicationState = applicationStore.getState(),
                documentIDs = applicationState.documentIDs,
                activeDocument = flux.store("document").getDocument(applicationState.selectedDocumentID),
                activeDocumentInitialized = applicationState.activeDocumentInitialized,
                recentFilesInitialized = applicationState.recentFilesInitialized,
                recentFiles = applicationState.recentFiles,
                currentlyMountedDocumentIDs = this.state ? this.state.mountedDocumentIDs : Immutable.Set(),
                mountedDocumentIDs = collection.intersection(documentIDs, currentlyMountedDocumentIDs)
                    .push(applicationState.selectedDocumentID)
                    .toSet();
                    
            var fluxState = {
                activeDocumentInitialized: activeDocumentInitialized,
                recentFilesInitialized: recentFilesInitialized,
                recentFiles: recentFiles,
                activeDocument: activeDocument,
                documentIDs: documentIDs,
                mountedDocumentIDs: mountedDocumentIDs
            };
             
            var preferencesStore = flux.store("preferences"),
                preferences = preferencesStore.getState();

            fluxState.librariesEnabled = !(activeDocument && activeDocument.unsupported) &&
                preferences.get("librariesEnabled", false);
            fluxState[UI.PROPERTIES_COL] = preferences.get(UI.PROPERTIES_COL, true);
            fluxState[UI.LAYERS_LIBRARY_COL] = preferences.get(UI.LAYERS_LIBRARY_COL, true);
            fluxState[UI.STYLES_PANEL] = preferences.get(UI.STYLES_PANEL, true);
            fluxState[UI.LAYERS_PANEL] = preferences.get(UI.LAYERS_PANEL, true);
            fluxState[UI.LIBRARY_PANEL] = preferences.get(UI.LIBRARY_PANEL, true);
      
            return fluxState;
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
                (!this.state.activeDocument && !nextState.recentFilesInitialized)) {
                return false;
            }

            return this.state[UI.PROPERTIES_COL] !== nextState[UI.PROPERTIES_COL] ||
                this.state[UI.LAYERS_LIBRARY_COL] !== nextState[UI.LAYERS_LIBRARY_COL] ||
                this.state[UI.STYLES_PANEL] !== nextState[UI.STYLES_PANEL] ||
                this.state[UI.LAYERS_PANEL] !== nextState[UI.LAYERS_PANEL] ||
                this.state[UI.LIBRARY_PANEL] !== nextState[UI.LIBRARY_PANEL] ||
                this.state.librariesEnabled !== nextState.librariesEnabled ||
                this.state.activeDocumentInitialized !== nextState.activeDocumentInitialized ||
                this.state.recentFilesInitialized !== nextState.recentFilesInitialized ||
                (nextState.documentIDs.size === 0 && !Immutable.is(this.state.recentFiles, nextState.recentFiles)) ||
                !Immutable.is(this.state.activeDocument, nextState.activeDocument);
        },

        _handleColumnVisibilityToggle: function (columnName) {
            var nextState = {};
            nextState[columnName] = !this.state[columnName];

            this.getFlux().actions.preferences.setPreferences(nextState);
            this.setState(nextState);
        },
        
        _handlePanelVisibilityToggle: function (panelName) {
            // NOTE: We may want remove this if we come up with a better unsupported state for panels
            if (this.state.document && this.state.document.unsupported) {
                return;
            }
            
            var nextState = {};
            nextState[panelName] = !this.state[panelName];

            this.getFlux().actions.preferences.setPreferences(nextState);
            this.setState(nextState);
        },

        componentDidUpdate: function (prevProps, prevState) {
            // FIXME: Remove this once we ship with libraries always enabled
            if (!prevState.librariesEnabled && this.state.librariesEnabled) {
                this.getFlux().actions.libraries.beforeStartup()
                    .bind(this)
                    .then(function () {
                        this.getFlux().actions.libraries.afterStartup();
                    });
            }

            if (prevState[UI.LAYERS_LIBRARY_COL] !== this.state[UI.LAYERS_LIBRARY_COL] ||
                prevState[UI.PROPERTIES_COL] !== this.state[UI.PROPERTIES_COL]) {
                var payload = {
                    panelWidth: React.findDOMNode(this.refs.panelSet).clientWidth
                };

                this.getFlux().actions.ui.updatePanelSizes(payload);
            }
        },

        render: function () {
            var documentIDs = this.state.documentIDs;

            if (this.state.activeDocument && this.state.activeDocumentInitialized && documentIDs.size > 0) {
                var activeDocument = this.state.activeDocument,
                    documentProperties = this.state.mountedDocumentIDs.map(function (documentID) {
                        var current = documentID === activeDocument.id,
                            document = this.getFlux().store("document").getDocument(documentID),
                            disabled = document && document.unsupported,
                            panelSetclassNames = classnames({
                                "panel-set": true,
                                "panel-set__active": current
                            }),
                            panelTabBarClassNames = classnames({
                                "panel__tab-bar": true,
                                "panel__tab-bar_visible": !(this.state[UI.LAYERS_LIBRARY_COL] &&
                                    this.state[UI.PROPERTIES_COL])
                            }),
                            propertiesButtonClassNames = classnames({
                                "toolbar-button": true,
                                "tool-selected": this.state[UI.PROPERTIES_COL]
                            }),
                            layersButtonClassNames = classnames({
                                "toolbar-button": true,
                                "tool-selected": this.state[UI.LAYERS_LIBRARY_COL]
                            });

                        var libraryPanel = this.state.librariesEnabled ? (
                            <LibrariesPanel
                                disabled={disabled}
                                document={document}
                                visible={this.state[UI.LIBRARY_PANEL]}
                                onVisibilityToggle=
                                    {this._handlePanelVisibilityToggle.bind(this, UI.LIBRARY_PANEL)} />
                        ) : null;
                        
                        return (
                            <div className={panelSetclassNames} key={documentID}>
                                <PanelColumn
                                    current={current}
                                    visible={this.state[UI.PROPERTIES_COL]}
                                    onVisibilityToggle=
                                        {this._handleColumnVisibilityToggle.bind(this, UI.PROPERTIES_COL)}>
                                    <TransformPanel
                                        disabled={disabled}
                                        document={document} />
                                    <StylePanel
                                        disabled={disabled}
                                        visible={!disabled && this.state[UI.STYLES_PANEL]}
                                        document={document}
                                        onVisibilityToggle=
                                            {this._handlePanelVisibilityToggle.bind(this, UI.STYLES_PANEL)} />
                                </PanelColumn>
                                <PanelColumn
                                    current={current}
                                    visible={this.state[UI.LAYERS_LIBRARY_COL]}
                                    onVisibilityToggle=
                                    {this._handleColumnVisibilityToggle.bind(this, UI.LAYERS_LIBRARY_COL)}>
                                    <LayersPanel
                                        visible={this.state[UI.LAYERS_PANEL]}
                                        document={document}
                                        onVisibilityToggle=
                                            {this._handlePanelVisibilityToggle.bind(this, UI.LAYERS_PANEL)} />
                                    {libraryPanel}
                                </PanelColumn>
                                <div className={panelTabBarClassNames}>
                                    <Button className={propertiesButtonClassNames}
                                        disabled={false}
                                        onClick=
                                        {this._handleColumnVisibilityToggle.bind(this, UI.PROPERTIES_COL)}>
                                        <SVGIcon
                                            viewBox="0 0 17 17"
                                            CSSID="properties" />
                                    </Button>
                                        <Button className={layersButtonClassNames}
                                        disabled={false}
                                        onClick=
                                        {this._handleColumnVisibilityToggle.bind(this, UI.LAYERS_LIBRARY_COL)}>
                                        <SVGIcon
                                            viewBox="0 0 17 17"
                                            CSSID="layers" />
                                    </Button>
                                </div>
                            </div>
                        );
                    }, this);

                return (
                    <div ref="panelSet" className="panel-set__container">
                        {documentProperties}
                    </div>
                );
            } else if (this.state.recentFilesInitialized) {
                return (
                    <div ref="panelSet" className="panel-set__container">
                        <div className="panel panel__visible">
                            <RecentFiles recentFiles={this.state.recentFiles} />
                            <ArtboardPresets />
                        </div>
                    </div>
                );
            } else {
                return (
                    <div ref="panelSet"></div>
                );
            }
        }
    });

    module.exports = PanelSet;
});
