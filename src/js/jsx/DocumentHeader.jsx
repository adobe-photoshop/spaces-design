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

    var Promise = require("bluebird"),
        React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Immutable = require("immutable");

    var os = require("adapter").os;

    var DocumentHeaderTab = require("jsx!js/jsx/DocumentHeaderTab"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        strings = require("i18n!nls/strings"),
        synchronization = require("js/util/synchronization"),
        searchStore = require("js/stores/search"),
        headlights = require("js/util/headlights"),
        exportStore = require("js/stores/export");

    var DocumentHeader = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("application", "document", "tool", "dialog", "preferences")],

        getInitialState: function () {
            return {};
        },

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                dialogStore = flux.store("dialog"),
                dialogState = dialogStore.getState(),
                exportActive = dialogState.openDialogs.has(exportStore.EXPORT_DIALOG_ID),
                searchActive = dialogState.openDialogs.has(searchStore.SEARCH_BAR_DIALOG_ID),
                toolStore = flux.store("tool"),
                toolState = toolStore.getState(),
                applicationStore = flux.store("application"),
                applicationState = applicationStore.getState(),
                preferencesState = flux.store("preferences").getState(),
                components = flux.store("ui").components,
                documentIDs = applicationState.documentIDs,
                document = applicationStore.getCurrentDocument(),
                count = applicationStore.getDocumentCount(),
                inactiveDocumentsInitialized = applicationState.inactiveDocumentsInitialized,
                panelColumnCount = (preferencesState.get(components.LAYERS_LIBRARY_COL) ? 1 : 0) +
                    (preferencesState.get(components.PROPERTIES_COL) ? 1 : 0);

            return {
                document: document,
                documentIDs: documentIDs,
                count: count,
                maskModeActive: toolState.vectorMaskMode,
                currentTool: toolState.current,
                searchActive: searchActive,
                exportActive: exportActive,
                inactiveDocumentsInitialized: inactiveDocumentsInitialized,
                panelColumnCount: panelColumnCount
            };
        },

        /**
         * Update the sizes of the panels.
         *
         * @private
         * @return {Promise}
         */
        _updatePanelSizes: function () {
            var node = React.findDOMNode(this.refs.tabContainer),
                headerHeight;

            if (node) {
                headerHeight = node.getBoundingClientRect().height;
            } else {
                headerHeight = 0;
            }

            return this.getFlux().actions.ui.updatePanelSizes({
                headerHeight: headerHeight
            });
        },

        /**
         * Debounced version of _updatePanelSizes
         *
         * @private
         */
        _updatePanelSizesDebounced: null,

        /** @ignore */
        _updateTabContainerScroll: function () {
            var currentTab = window.document.querySelector(".document-title__current");
            if (currentTab) {
                var container = React.findDOMNode(this.refs.tabs),
                    containerBounds = container.getBoundingClientRect(),
                    bounds = currentTab.getBoundingClientRect();

                if (bounds.left < 0) {
                    container.scrollLeft = 0;
                } else if (bounds.right > containerBounds.right + 1) {
                    container.scrollLeft = bounds.right;
                }
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            // Don't re-render if we're just going temporarily inactive so that
            // the UI doesn't blink unnecessarily.
            if (this.props.active && !nextProps.active) {
                return false;
            }

            if (!nextState.inactiveDocumentsInitialized) {
                return false;
            }

            return this.state.inactiveDocumentsInitialized !== nextState.inactiveDocumentsInitialized ||
                this.state.count !== nextState.count ||
                this.state.headerWidth !== nextState.headerWidth ||
                this.state.searchActive !== nextState.searchActive ||
                this.state.exportActive !== nextState.exportActive ||
                this.state.maskModeActive !== nextState.maskModeActive ||
                this.state.currentTool !== nextState.currentTool ||
                this.state.panelColumnCount !== nextState.panelColumnCount ||
                this.state.useSmallTab !== nextState.useSmallTab ||
                !Immutable.is(this.state.documentIDs, nextState.documentIDs) ||
                !Immutable.is(this.state.document, nextState.document);
        },

        componentDidMount: function () {
            this._updateTabContainerScroll();
            this._updateTabSize();

            this._updatePanelSizesDebounced = synchronization.debounce(this._updatePanelSizes, this, 500);
            os.addListener("displayConfigurationChanged", this._updatePanelSizesDebounced);
            this._updatePanelSizes();
            
            this._handleWindowResizeDebounced = synchronization.debounce(this._handleWindowResize, this, 500);
            window.addEventListener("resize", this._handleWindowResizeDebounced);
        },

        componentWillUnmount: function () {
            os.removeListener("displayConfigurationChanged", this._updatePanelSizesDebounced);
            window.removeEventListener("resize", this._handleWindowResizeDebounced);
        },

        componentDidUpdate: function () {
            this._updateTabContainerScroll();
            this._updateTabSize();
        },
        
        /**
         * In the document header, we render the document title container twice, and the second container is always
         * rendered with regular tab size and is invisible to the user. Then, we detect whether the second container 
         * is packed. If so, we re-render the first container with small tab size.
         * 
         * @private
         * @param  {function=} callback
         */
        _updateTabSize: function (callback) {
            var hasEnoughRoomForRegularTab = this.refs.spaceStub.getDOMNode().clientWidth > 0;
            this.setState({ useSmallTab: !hasEnoughRoomForRegularTab }, callback);
        },

        /**
         * Update the state with the size of the header element on resize
         *
         * @private
         */
        _handleWindowResize: function () {
            return new Promise(function (resolve) {
                this._updateTabSize(resolve);
            }.bind(this));
        },

        /**
         * Debounced version of _handleWindowResize
         *
         * @private
         * @type {function}
         */
        _handleWindowResizeDebounced: null,

        /** @ignore */
        _handleTabClick: function (documentID) {
            var selectedDoc = this.getFlux().store("document").getDocument(documentID);
            if (selectedDoc) {
                this.getFlux().actions.documents.selectDocument(selectedDoc);
            }
        },

        /**
         * Opens the export dialog 
         */
        _openExportPanel: function () {
            this.getFlux().actions.export.openExportPanel();
            headlights.logEvent("user-interface", "document-header-button", "export-panel");
        },

        /**
         * Toggles search feature
         */
        _toggleSearch: function () {
            this.getFlux().actions.search.toggleSearchBar();
            headlights.logEvent("user-interface", "document-header-button", "search");
        },

        /**
         * Changes mask mode 
         */
        _changeMaskMode: function () {
            this.getFlux().actions.tools.changeVectorMaskMode(!this.state.maskModeActive);
            headlights.logEvent("user-interface", "document-header-button", "mask-mode-" + !this.state.maskModeActive);
        },

        render: function () {
            var documentStore = this.getFlux().store("document"),
                document = this.state.document,
                toolStore = this.getFlux().store("tool");

            var exportDisabled = !document || document.unsupported,
                maskDisabled = !document || document.unsupported ||
                    document.layers.selected.isEmpty();

            if (!maskDisabled) {
                maskDisabled = !document.layers.selectedLayersCanHaveVectorMask;
            }

            if (!maskDisabled) {
                var currentTool = toolStore.getCurrentTool();

                if (currentTool && !currentTool.handleVectorMaskMode) {
                    maskDisabled = true;
                }
            }
 
            var documentTabs = [],
                documentRegularTabs = [];
                
            this.state.documentIDs.forEach(function (docID) {
                var doc = documentStore.getDocument(docID);

                if (doc) {
                    var tabAttrs = {
                        key: "docheader" + docID,
                        name: doc.name,
                        dirty: doc.dirty,
                        unsupported: doc.unsupported,
                        current: document && docID === document.id
                    };
                    
                    documentTabs.push(
                        <DocumentHeaderTab
                            {...tabAttrs}
                            smallTab={this.state.useSmallTab}
                            onClick={this._handleTabClick.bind(this, docID)}/>
                    );
                    
                    documentRegularTabs.push(
                        <DocumentHeaderTab {...tabAttrs}/>
                    );
                }
            }, this);

            return (
                <div className="document-container">
                    <div className="document-header-container" ref="tabContainer">
                        <div className="document-header" ref="tabs">
                            {documentTabs}
                        </div>
                        <div className="document-header__hidden">
                            {documentRegularTabs}
                            <div className="document-title__stub" ref="spaceStub"/>
                        </div>
                    </div>
                    <div className="icon-header">
                        <div className="icon-header-buttons">
                            <Button
                                className="button-plus search-button"
                                title={strings.TOOLTIPS.SEARCH}
                                onClick={this._toggleSearch}
                                active={this.state.searchActive}>
                                <SVGIcon
                                    CSSID="layer-search-app" />
                            </Button>
                            <Button
                                className="button-plus"
                                title={strings.TOOLTIPS.VECTOR_MASK_MODE}
                                onClick={this._changeMaskMode}
                                disabled={maskDisabled}
                                active={this.state.maskModeActive}>
                                <SVGIcon
                                    CSSID="tool-maskmode" />
                            </Button>
                            <Button
                                className="button-plus export-button"
                                title={strings.TOOLTIPS.EXPORT_DIALOG}
                                disabled={exportDisabled}
                                active={this.state.exportActive}
                                onClick={this._openExportPanel}>
                                <SVGIcon
                                    CSSID="extract-all" />
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }
    });

    module.exports = DocumentHeader;
});
