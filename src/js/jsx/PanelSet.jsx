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
        classnames = require("classnames"),
        _ = require("lodash");

    var os = require("adapter/os");

    var Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        IconBar = require("jsx!js/jsx/IconBar"),
        RecentFiles = require("jsx!./sections/nodoc/RecentFiles"),
        ArtboardPresets = require("jsx!./sections/nodoc/ArtboardPresets"),
        PanelColumn = require("jsx!./PanelColumn"),
        TransformPanel = require("jsx!./sections/transform/TransformPanel"),
        EffectsPanel = require("jsx!./sections/style/EffectsPanel"),
        AppearancePanel = require("jsx!./sections/style/AppearancePanel"),
        ExportPanel = require("jsx!./sections/export/ExportPanel"),
        LayersPanel = require("jsx!./sections/layers/LayersPanel"),
        LibrariesPanel = require("jsx!./sections/libraries/LibrariesPanel"),
        collection = require("js/util/collection"),
        strings = require("i18n!nls/strings"),
        synchronization = require("js/util/synchronization");

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
                currentlyMountedDocumentIDs = this.state ? this.state.mountedDocumentIDs : Immutable.Set(),
                mountedDocumentIDs = collection.intersection(documentIDs, currentlyMountedDocumentIDs);
                
            if (applicationState.selectedDocumentID) {
                mountedDocumentIDs = mountedDocumentIDs.push(applicationState.selectedDocumentID);
            }

            var fluxState = {
                activeDocumentInitialized: activeDocumentInitialized,
                recentFilesInitialized: recentFilesInitialized,
                recentFiles: recentFiles,
                activeDocument: activeDocument,
                documentIDs: documentIDs,
                mountedDocumentIDs: mountedDocumentIDs.toSet()
            };
             
            var preferencesStore = flux.store("preferences"),
                preferences = preferencesStore.getState();
                
            // Grab preferences for each UI panel
            var uiStore = flux.store("ui");
            _.forOwn(uiStore.components, function (uiComponent) {
                fluxState[uiComponent] = preferences.get(uiComponent, true);
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
            var node = React.findDOMNode(this.refs.panelSet),
                panelWidth;

            if (node) {
                panelWidth = node.getBoundingClientRect().width;
            } else {
                panelWidth = 0;
            }

            var columnCount = 0;
            if (this.state.activeDocument && this.state.activeDocumentInitialized &&
                this.state.documentIDs.size > 0 && !this.props.singleColumnModeEnabled) {
                var uiStore = this.getFlux().store("ui");
                if (this.state[uiStore.components.LAYERS_LIBRARY_COL]) {
                    columnCount++;
                }

                if (this.state[uiStore.components.PROPERTIES_COL]) {
                    columnCount++;
                }
            } else {
                columnCount = 1;
            }

            return this.getFlux().actions.ui.updatePanelSizes({
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
            this._updatePanelSizesDebounced = synchronization.debounce(this._updatePanelSizes, this, 500);
            os.addListener("displayConfigurationChanged", this._updatePanelSizesDebounced);
        },

        componentWillUnmount: function () {
            os.removeListener("displayConfigurationChanged", this._updatePanelSizesDebounced);
        },

        componentDidUpdate: function (prevProps, prevState) {
            var hasDoc = function (state) {
                return !!state.activeDocument;
            };

            var uiStore = this.getFlux().store("ui"),
                components = uiStore.components;

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

            var uiStore = this.getFlux().store("ui"),
                uiVisibilityChanged = _.some(uiStore.components, function (uiComponent) {
                    if (this.state[uiComponent] !== nextState[uiComponent]) {
                        return true;
                    }
                }, this);

            return uiVisibilityChanged ||
                this.state.activeDocumentInitialized !== nextState.activeDocumentInitialized ||
                this.state.recentFilesInitialized !== nextState.recentFilesInitialized ||
                (nextState.documentIDs.size === 0 && !Immutable.is(this.state.recentFiles, nextState.recentFiles)) ||
                !Immutable.is(this.state.activeDocument, nextState.activeDocument);
        },

        /** @ignore */
        _handleColumnVisibilityToggle: function (columnName) {
            var flux = this.getFlux(),
                uiStore = flux.store("ui"),
                modifierStore = flux.store("modifier"),
                components = uiStore.components,
                modifierState = modifierStore.getState(),
                nextState = {};
                
            if (modifierState.command) {
                nextState[components.LAYERS_LIBRARY_COL] = !this.state[components.LAYERS_LIBRARY_COL];
                nextState[components.PROPERTIES_COL] = !this.state[components.PROPERTIES_COL];
            } else {
                nextState[columnName] = !this.state[columnName];
            }

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
        },

        render: function () {
            var documentIDs = this.state.documentIDs,
                activeDocument = this.state.activeDocument;

            if (activeDocument && this.state.activeDocumentInitialized && documentIDs.size > 0) {
                var uiStore = this.getFlux().store("ui"),
                    components = uiStore.components,
                    documentProperties = {
                        transformPanels: [],
                        appearancePanels: [],
                        effectPanels: [],
                        exportPanels: [],
                        layerPanels: []
                    };
                    
                this.state.mountedDocumentIDs.forEach(function (documentID) {
                    var current = documentID === activeDocument.id,
                        document = this.getFlux().store("document").getDocument(documentID),
                        disabled = document && document.unsupported,
                        panelProps = {
                            key: documentID,
                            disabled: disabled,
                            document: document,
                            active: current,
                            shouldPanelGrow: !this.state[components.LAYERS_PANEL] &&
                                !this.state[components.LIBRARIES_PANEL]
                        };
                        
                    documentProperties.transformPanels.push(
                        <TransformPanel {...panelProps} />
                    );
                    
                    documentProperties.appearancePanels.push(
                        <AppearancePanel
                            {...panelProps}
                            ref={current && components.APPEARANCE_PANEL}
                            visible={!disabled && this.state[components.APPEARANCE_PANEL]}
                            onVisibilityToggle=
                                {this._handlePanelVisibilityToggle
                                    .bind(this, components.APPEARANCE_PANEL)} />
                    );
                    
                    documentProperties.effectPanels.push(
                        <EffectsPanel
                            {...panelProps}
                            ref={current && components.EFFECTS_PANEL}
                            visible={!disabled && this.state[components.EFFECTS_PANEL]}
                            onVisibilityToggle=
                                {this._handlePanelVisibilityToggle.bind(this, components.EFFECTS_PANEL)} />
                    );
                    
                    documentProperties.exportPanels.push(
                        <ExportPanel
                            {...panelProps}
                            ref={current && components.EXPORT_PANEL}
                            visible={!disabled && this.state[components.EXPORT_PANEL]}
                            onVisibilityToggle=
                                {this._handlePanelVisibilityToggle.bind(this, components.EXPORT_PANEL)} />
                    );
                    
                    documentProperties.layerPanels.push(
                        <LayersPanel
                            {...panelProps}
                            visible={this.state[components.LAYERS_PANEL]}
                            ref={current && components.LAYERS_PANEL}
                            onVisibilityToggle=
                                {this._handlePanelVisibilityToggle.bind(this, components.LAYERS_PANEL)} />
                    );
                }, this);

                var propertiesButtonClassNames = classnames({
                        "toolbar-button": true,
                        "tool-selected": this.state[components.PROPERTIES_COL]
                    }),
                    layersButtonClassNames = classnames({
                        "toolbar-button": true,
                        "tool-selected": this.state[components.LAYERS_LIBRARY_COL]
                    }),
                    panelCollapse = strings.TOOLTIPS.PANEL_COLUMN_COLLAPSE,
                    panelExpand = strings.TOOLTIPS.PANEL_COLUMN_EXPAND,
                    layerColumnTitle = strings.TOOLTIPS.LAYERS_LIBRARIES +
                        (this.state[components.LAYERS_LIBRARY_COL] ? panelCollapse : panelExpand),
                    propertiesColumnTitle = strings.TOOLTIPS.PROPERTIES +
                        (this.state[components.PROPERTIES_COL] ? panelCollapse : panelExpand),
                    handlePropertiesColumnVisibilityToggle =
                        this._handleColumnVisibilityToggle.bind(this, components.PROPERTIES_COL),
                    handleLayersLibraryColumnVisibilityToggle =
                        this._handleColumnVisibilityToggle.bind(this, components.LAYERS_LIBRARY_COL);

                var librariesPanel = (
                    <LibrariesPanel
                        key="libraries-panel"
                        className="section__active"
                        ref={components.LIBRARIES_PANEL}
                        disabled={activeDocument && activeDocument.unsupported}
                        document={activeDocument}
                        visible={this.state[components.LIBRARIES_PANEL]}
                        onVisibilityToggle={this._handlePanelVisibilityToggle.bind(this,
                        components.LIBRARIES_PANEL)} />
                );

                if (this.props.singleColumnModeEnabled) {
                    return (
                        <div className="panel-set__container panel-set__container__small-screen">
                            <div ref="panelSet"
                                 className="panel-set">
                                <PanelColumn visible={true}>
                                    {documentProperties.transformPanels}
                                    {documentProperties.appearancePanels}
                                    {documentProperties.effectPanels}
                                    {documentProperties.exportPanels}
                                    {documentProperties.layerPanels}
                                    {librariesPanel}
                                </PanelColumn>
                            </div>
                        </div>
                    );
                } else {
                    return (
                        <div className="panel-set__container">
                            <div ref="panelSet"
                                 className="panel-set">
                                <PanelColumn visible={this.state[components.PROPERTIES_COL]}
                                             onVisibilityToggle={handlePropertiesColumnVisibilityToggle}>
                                    {documentProperties.transformPanels}
                                    {documentProperties.appearancePanels}
                                    {documentProperties.effectPanels}
                                    {documentProperties.exportPanels}
                                </PanelColumn>
                                <PanelColumn visible={this.state[components.LAYERS_LIBRARY_COL]}
                                             onVisibilityToggle= {handleLayersLibraryColumnVisibilityToggle}>
                                    {documentProperties.layerPanels}
                                    {librariesPanel}
                                </PanelColumn>
                            </div>
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
            } else if (this.state.recentFilesInitialized) {
                return (
                    <div className="panel-set panel-set__active null-state">
                        <PanelColumn ref="panelSet" visible="true">
                            <RecentFiles recentFiles={this.state.recentFiles} />
                            <ArtboardPresets />
                        </PanelColumn>
                        <IconBar />
                    </div>
                );
            } else {
                return (
                    <div className="panel-set__container">
                        <div ref="panelSet"
                             className="panel-set">
                            <PanelColumn visible={true} />
                        </div>
                        <IconBar />
                    </div>
                );
            }
        }
    });

    module.exports = PanelSet;
});
