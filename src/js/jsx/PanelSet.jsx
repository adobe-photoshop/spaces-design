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
        ReactDOM = require("react-dom"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var os = require("adapter").os;

    var Button = require("js/jsx/shared/Button"),
        SVGIcon = require("js/jsx/shared/SVGIcon"),
        IconBar = require("js/jsx/IconBar"),
        RecentFiles = require("./sections/nodoc/RecentFiles"),
        ArtboardPresets = require("./sections/nodoc/ArtboardPresets"),
        PanelColumn = require("./PanelColumn"),
        TransformPanel = require("./sections/transform/TransformPanel"),
        EffectsPanel = require("./sections/style/EffectsPanel"),
        AppearancePanel = require("./sections/style/AppearancePanel"),
        ExportPanel = require("./sections/export/ExportPanel"),
        LayersPanel = require("./sections/layers/LayersPanel"),
        LibrariesPanel = require("./sections/libraries/LibrariesPanel"),
        nls = require("js/util/nls"),
        system = require("js/util/system"),
        headlights = require("js/util/headlights");

    var PanelSet = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("application", "document", "preferences")],
        
        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                applicationState = applicationStore.getState(),
                documentIDs = applicationState.documentIDs,
                activeDocument = applicationStore.getCurrentDocument(),
                activeDocumentInitialized = applicationState.activeDocumentInitialized,
                recentFilesInitialized = applicationState.recentFilesInitialized,
                recentFiles = applicationState.recentFiles,
                mountedDocuments = applicationStore.getInitializedDocuments();

            var fluxState = {
                activeDocumentInitialized: activeDocumentInitialized,
                recentFilesInitialized: recentFilesInitialized,
                recentFiles: recentFiles,
                activeDocument: activeDocument,
                documentIDs: documentIDs,
                mountedDocuments: mountedDocuments
            };
             
            var preferencesStore = flux.store("preferences"),
                preferences = preferencesStore.getState();
                
            // Grab preferences for each UI panel
            var panelStore = flux.store("panel");
            _.forOwn(panelStore.components, function (panelComponent) {
                fluxState[panelComponent] = preferences.get(panelComponent, true);
            });
      
            return fluxState;
        },

        /**
         * Update the sizes of the panels.
         *
         * @private
         * @return {Promise}
         */
        _updatePanelSizes: function () {
            var node = ReactDOM.findDOMNode(this.refs.panelSet),
                panelWidth;

            if (node) {
                panelWidth = node.getBoundingClientRect().width;
            } else {
                panelWidth = 0;
            }

            var columnCount = 0;
            if (this.state.activeDocument && this.state.activeDocumentInitialized &&
                this.state.documentIDs.size > 0 && !this.props.singleColumnModeEnabled) {
                var panelStore = this.getFlux().store("panel");
                if (this.state[panelStore.components.LAYERS_LIBRARY_COL]) {
                    columnCount++;
                }

                if (this.state[panelStore.components.PROPERTIES_COL]) {
                    columnCount++;
                }
            } else {
                columnCount = 1;
            }

            return this.getFlux().actions.panel.updatePanelSizes({
                panelWidth: panelWidth,
                columnCount: columnCount
            });
        },

        /**
         * Debounced version of _updatePanelSizes
         *
         * @private
         */
        _updatePanelSizesDebounced: null,

        componentDidMount: function () {
            this._updatePanelSizesDebounced = _.debounce(this._updatePanelSizes, 500);
            os.addListener("displayConfigurationChanged", this._updatePanelSizesDebounced);
        },

        componentWillUnmount: function () {
            os.removeListener("displayConfigurationChanged", this._updatePanelSizesDebounced);
        },

        componentDidUpdate: function (prevProps, prevState) {
            var hasDoc = function (state) {
                return !!state.activeDocument;
            };

            var panelStore = this.getFlux().store("panel"),
                components = panelStore.components;

            // NOTE: Special case of going from No Doc state requires update to panel sizes
            if (prevState.activeDocumentInitialized !== this.state.activeDocumentInitialized ||
                prevState.recentFilesInitialized !== this.state.recentFilesInitialized ||
                hasDoc(prevState) !== hasDoc(this.state) ||
                prevState[components.PROPERTIES_COL] !== this.state[components.PROPERTIES_COL] ||
                prevState[components.LAYERS_LIBRARY_COL] !== this.state[components.LAYERS_LIBRARY_COL] ||
                prevProps.singleColumnModeEnabled !== this.props.singleColumnModeEnabled) {
                this._updatePanelSizes();
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            // Don't re-render if we're just going temporarily inactive so that
            // the UI doesn't blink unnecessarily.
            if (this.props.active && !nextProps.active) {
                return false;
            }
            
            if (this.props.singleColumnModeEnabled !== nextProps.singleColumnModeEnabled) {
                return true;
            }

            // Don't re-render until either the active document or recent files
            // are initialized.
            if (!nextState.activeDocumentInitialized ||
                (!this.state.activeDocument && !nextState.recentFilesInitialized)) {
                return false;
            }

            var panelStore = this.getFlux().store("panel"),
                panelVisibilityChanged = _.some(panelStore.components, function (panelComponent) {
                    if (this.state[panelComponent] !== nextState[panelComponent]) {
                        return true;
                    }
                }, this);

            return panelVisibilityChanged ||
                this.state.activeDocumentInitialized !== nextState.activeDocumentInitialized ||
                this.state.recentFilesInitialized !== nextState.recentFilesInitialized ||
                (nextState.documentIDs.size === 0 && !Immutable.is(this.state.recentFiles, nextState.recentFiles)) ||
                !Immutable.is(this.state.activeDocument, nextState.activeDocument);
        },

        /**
         * Handle icon clicks, toggling visibility of one or both columns.
         *
         * @private
         * @param {string} columnName
         * @param {SyntheticEvent} event
         */
        _handleColumnVisibilityToggle: function (columnName, event) {
            var flux = this.getFlux(),
                panelStore = flux.store("panel"),
                components = panelStore.components,
                swapModifier = system.isMac ? event.metaKey : event.ctrlKey,
                currentlyVisible,
                nextState = {};
                
            if (swapModifier) {
                nextState[components.LAYERS_LIBRARY_COL] = !this.state[components.LAYERS_LIBRARY_COL];
                nextState[components.PROPERTIES_COL] = !this.state[components.PROPERTIES_COL];
            } else {
                nextState[columnName] = !this.state[columnName];
            }

            // For headlights
            var layersLibPanel = this.state[components.LAYERS_LIBRARY_COL],
                propertiesPanel = this.state[components.PROPERTIES_COL];

            if (columnName === "layersLibrariesVisible") {
                layersLibPanel = nextState[components.LAYERS_LIBRARY_COL];
            } else {
                propertiesPanel = nextState[components.PROPERTIES_COL];
            }

            if (swapModifier) {
                layersLibPanel = !layersLibPanel;
                propertiesPanel = !propertiesPanel;
            }

            if (layersLibPanel && propertiesPanel) {
                currentlyVisible = "layersLibrary-properties-visible";
            } else if (layersLibPanel) {
                currentlyVisible = "layersLibrary-visible";
            } else if (propertiesPanel) {
                currentlyVisible = "properties-visible";
            } else {
                currentlyVisible = "none-visible";
            }

            headlights.logEvent("user-interface", "panels-visible", currentlyVisible);

            this.getFlux().actions.preferences.setPreferences(nextState);
        },

        /** @ignore */
        _handlePanelVisibilityToggle: function (panelName) {
            // NOTE: We may want remove this if we come up with a better unsupported state for panels
            if (this.state.document && this.state.document.unsupported) {
                return;
            }
            
            var nextState = {};
            nextState[panelName] = !this.state[panelName];

            this.getFlux().actions.preferences.setPreferences(nextState);
            headlights.logEvent("user-interface", "panel-toggle", panelName);
        },

        render: function () {
            var documentIDs = this.state.documentIDs,
                activeDocument = this.state.activeDocument,
                hasActiveDocument = activeDocument && this.state.activeDocumentInitialized && documentIDs.size > 0;

            var panelStore = this.getFlux().store("panel"),
                components = panelStore.components,
                documentPanels = {
                    transformPanels: [],
                    appearancePanels: [],
                    effectPanels: [],
                    exportPanels: [],
                    layerPanels: [],
                    librariesPanel: null
                };
                
            this.state.mountedDocuments.forEach(function (document) {
                var documentID = document.id,
                    current = documentID === activeDocument.id,
                    disabled = document && document.unsupported,
                    sectionClassnames = classnames({
                        "panel-section": true,
                        "panel-section__no-selected-layer": document.layers.selected.isEmpty(),
                        "panel-section__not-visible": !current
                    }),
                    panelProps = {
                        disabled: disabled,
                        document: document,
                        shouldPanelGrow: !this.state[components.LAYERS_PANEL] &&
                            !this.state[components.LIBRARIES_PANEL]
                    };
                
                var appearancePanelVisible = !disabled && this.state[components.APPEARANCE_PANEL],
                    effectsPanelVisible = !disabled && this.state[components.EFFECTS_PANEL],
                    exportPanelVisible = !disabled && this.state[components.EXPORT_PANEL],
                    layersPanelVisible = this.state[components.LAYERS_PANEL],
                    transformClassnames = classnames(sectionClassnames, {
                        "panel-transform-section": true
                    }),
                    appearanceClassnames = classnames(sectionClassnames, {
                        "panel-appearance-section": true,
                        "panel-section__collapsed": !appearancePanelVisible
                    }),
                    effectsClassnames = classnames(sectionClassnames, {
                        "panel-effects-section": true,
                        "panel-section__collapsed": !effectsPanelVisible
                    }),
                    exportClassnames = classnames(sectionClassnames, {
                        "panel-export-section": true,
                        "panel-section__collapsed": !exportPanelVisible
                    }),
                    layersClassnames = classnames(sectionClassnames, {
                        "panel-layers-section": true,
                        "panel-section__collapsed": !layersPanelVisible
                    });

                documentPanels.transformPanels.push(
                    <div className={transformClassnames} key={documentID}>
                        <TransformPanel
                            {...panelProps}
                            key="transform" />
                    </div>
                );

                documentPanels.appearancePanels.push(
                    <div className={appearanceClassnames} key={documentID}>
                        <AppearancePanel
                            {...panelProps}
                            key="appearance"
                            ref={current && components.APPEARANCE_PANEL}
                            visible={appearancePanelVisible}
                            onVisibilityToggle=
                                {this._handlePanelVisibilityToggle
                                    .bind(this, components.APPEARANCE_PANEL)} />
                    </div>
                );
                
                documentPanels.effectPanels.push(
                    <div className={effectsClassnames} key={documentID}>
                        <EffectsPanel
                            {...panelProps}
                            key="effect"
                            ref={current && components.EFFECTS_PANEL}
                            visible={effectsPanelVisible}
                            onVisibilityToggle=
                                {this._handlePanelVisibilityToggle.bind(this, components.EFFECTS_PANEL)} />
                    </div>
                );
                
                documentPanels.exportPanels.push(
                    <div className={exportClassnames} key={documentID}>
                        <ExportPanel
                            {...panelProps}
                            key="export"
                            ref={current && components.EXPORT_PANEL}
                            visible={exportPanelVisible}
                            onVisibilityToggle=
                                {this._handlePanelVisibilityToggle.bind(this, components.EXPORT_PANEL)} />
                    </div>
                );
                
                documentPanels.layerPanels.push(
                    <div className={layersClassnames} key={documentID}>
                        <LayersPanel
                            {...panelProps}
                            key="layers"
                            visible={layersPanelVisible}
                            ref={current && components.LAYERS_PANEL}
                            onVisibilityToggle=
                                {this._handlePanelVisibilityToggle.bind(this, components.LAYERS_PANEL)} />
                    </div>
                );
            }, this);
            
            var librariesPanelVisible = this.state[components.LIBRARIES_PANEL],
                librariesClassnames = classnames({
                    "panel-section": true,
                    "panel-section__collapsed": !librariesPanelVisible,
                    "panel-libraries-section": true
                });
            
            documentPanels.librariesPanel = (
                <div className={librariesClassnames}>
                    <LibrariesPanel
                        key="libraries-panel"
                        ref={components.LIBRARIES_PANEL}
                        disabled={activeDocument && activeDocument.unsupported}
                        document={activeDocument}
                        visible={librariesPanelVisible}
                        onVisibilityToggle={this._handlePanelVisibilityToggle.bind(this,
                            components.LIBRARIES_PANEL)} />
                </div>
            );

            var propertiesButtonClassNames = classnames({
                    "toolbar-button": true,
                    "tool-selected": this.state[components.PROPERTIES_COL]
                }),
                layersButtonClassNames = classnames({
                    "toolbar-button": true,
                    "tool-selected": this.state[components.LAYERS_LIBRARY_COL]
                }),
                panelCollapse = nls.localize("strings.TOOLTIPS.PANEL_COLUMN_COLLAPSE"),
                panelExpand = nls.localize("strings.TOOLTIPS.PANEL_COLUMN_EXPAND"),
                layerColumnTitle = nls.localize("strings.TOOLTIPS.LAYERS_LIBRARIES") +
                    (this.state[components.LAYERS_LIBRARY_COL] ? panelCollapse : panelExpand),
                propertiesColumnTitle = nls.localize("strings.TOOLTIPS.PROPERTIES") +
                    (this.state[components.PROPERTIES_COL] ? panelCollapse : panelExpand),
                handlePropertiesColumnVisibilityToggle =
                    this._handleColumnVisibilityToggle.bind(this, components.PROPERTIES_COL),
                handleLayersLibraryColumnVisibilityToggle =
                    this._handleColumnVisibilityToggle.bind(this, components.LAYERS_LIBRARY_COL);
            
            var documentPanelSet,
                documentPanelSetClassName = classnames({
                    "panel-set": true,
                    "panel-set__small-screen": this.props.singleColumnModeEnabled,
                    "panel-set__not-visible": !hasActiveDocument
                });

            if (this.props.singleColumnModeEnabled) {
                documentPanelSet = (
                    <div className={documentPanelSetClassName}>
                        <PanelColumn visible={hasActiveDocument}>
                            {documentPanels.transformPanels}
                            {documentPanels.appearancePanels}
                            {documentPanels.effectPanels}
                            {documentPanels.exportPanels}
                            {documentPanels.layerPanels}
                            {documentPanels.librariesPanel}
                        </PanelColumn>
                    </div>
                );
            } else {
                documentPanelSet = (
                    <div className={documentPanelSetClassName}>
                        <PanelColumn visible={hasActiveDocument && this.state[components.PROPERTIES_COL]}
                                     onVisibilityToggle={handlePropertiesColumnVisibilityToggle}>
                            {documentPanels.transformPanels}
                            {documentPanels.appearancePanels}
                            {documentPanels.effectPanels}
                            {documentPanels.exportPanels}
                        </PanelColumn>
                        <PanelColumn visible={hasActiveDocument && this.state[components.LAYERS_LIBRARY_COL]}
                                     onVisibilityToggle= {handleLayersLibraryColumnVisibilityToggle}>
                            {documentPanels.layerPanels}
                            {documentPanels.librariesPanel}
                        </PanelColumn>
                        <IconBar>
                            <Button className={propertiesButtonClassNames}
                                title={propertiesColumnTitle}
                                disabled={false}
                                onClick=
                                {this._handleColumnVisibilityToggle.bind(this, components.PROPERTIES_COL)}>
                                <SVGIcon
                                    CSSID="properties" />
                            </Button>
                            <Button className={layersButtonClassNames}
                                title={layerColumnTitle}
                                disabled={false}
                                onClick=
                                {this._handleColumnVisibilityToggle.bind(this, components.LAYERS_LIBRARY_COL)}>
                                <SVGIcon
                                    CSSID="layers" />
                            </Button>
                        </IconBar>
                    </div>
                );
            }

            var noDocPanelSet,
                noDocPanelSetClassName = classnames({
                    "panel-set": true,
                    "panel-set__not-visible": hasActiveDocument
                });
            
            if (this.state.recentFilesInitialized) {
                noDocPanelSet = (
                    <div className={noDocPanelSetClassName}>
                        <PanelColumn visible="true">
                            <RecentFiles recentFiles={this.state.recentFiles} />
                            <ArtboardPresets />
                        </PanelColumn>
                        <IconBar />
                    </div>
                );
            } else {
                noDocPanelSet = (
                    <div className={noDocPanelSetClassName}>
                        <PanelColumn visible="true" />
                        <IconBar />
                    </div>
                );
            }
            
            return (
                <div className="panel-set__container" ref="panelSet">
                    {documentPanelSet}
                    {noDocPanelSet}
                </div>
            );
        }
    });

    module.exports = PanelSet;
});
