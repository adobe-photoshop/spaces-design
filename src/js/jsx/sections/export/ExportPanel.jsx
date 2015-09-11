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
        classnames = require("classnames");

    var os = require("adapter/os");

    var ExportList = require("jsx!js/jsx/sections/export/ExportList"),
        TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        Button = require("jsx!js/jsx/shared/Button"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        strings = require("i18n!nls/strings"),
        ExportAsset = require("js/models/exportasset"),
        synchronization = require("js/util/synchronization");

    var ExportPanel = React.createClass({

        mixins: [FluxMixin, StoreWatchMixin("export")],

        /**
         * A throttled version of os.setTooltip
         *
         * @type {?function}
         */
        _setTooltipThrottled: null,

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                documentID = this.props.document.id,
                exportStore = flux.store("export"),
                documentExports = exportStore.getDocumentExports(documentID);

            return {
                documentExports: documentExports,
                exportState: exportStore.getState()
            };
        },

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
        },

        shouldComponentUpdate: function (nextProps) {
            if (this.props.disabled !== nextProps.disabled) {
                return true;
            }

            if (!nextProps.visible && !this.props.visible) {
                return false;
            }

            return true;
        },

        /**
         * Selects the content of the input on focus.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleFocus: function (event) {
            event.target.scrollIntoViewIfNeeded();
            if (this.props.onFocus) {
                this.props.onFocus(event);
            }
        },

        /**
         * Workaround a CEF bug by clearing any active tooltips when scrolling.
         * More details here: https://github.com/adobe-photoshop/spaces-design/issues/444
         *
         * @private
         */
        _handleScroll: function () {
            this._setTooltipThrottled("");
        },

        /**
         * Add a new Asset to this list
         *
         * @private
         */
        _addAssetClickHandler: function (preset) {
            var document = this.props.document,
                selectedLayers = document && document.layers.selected,
                documentExports = this.state.documentExports,
                props = preset ? ExportAsset.PRESET_ASSETS[preset] : null;

            this.getFlux().actions.export.addAsset(document, documentExports, selectedLayers, props);
        },

        /**
         * Export all the assets associated with this panel
         *
         * @private
         */
        _exportAssetsClickHandler: function () {
            var document = this.props.document,
                selectedLayers = document.layers.selected;

            if (selectedLayers.size > 0) {
                this.getFlux().actions.export.exportLayerAssetsDebounced(document, selectedLayers);
            } else {
                this.getFlux().actions.export.exportDocumentAssetsDebounced(document);
            }
        },

        /**
         * Stop event propagation to prevent double-clicks from collapsing the panel.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _addAssetDoubleClickHandler: function (event) {
            event.stopPropagation();
        },

        render: function () {
            var document = this.props.document,
                documentExports = this.state.documentExports,
                exportState = this.state.exportState,
                disabled = this.props.disabled,
                exportDisabled = exportState.serviceBusy || !exportState.serviceAvailable,
                selectedLayers,
                supportedLayers,
                containerContents;

            if (!document || !documentExports || !this.props.visible || disabled) {
                containerContents = null;
            } else {
                selectedLayers = this.props.document.layers.selected;
                supportedLayers = document.layers.filterExportable(selectedLayers);
                
                if (!selectedLayers.isEmpty()) {
                    if (supportedLayers.isEmpty()) {
                        // Special case: there are selected layers, but none is supported
                        disabled = true;
                        containerContents = (
                            <div className="libraries__content panel__info">
                                <div className="panel__info__body">
                                    {strings.EXPORT.ONLY_UNSUPPORTED_LAYERS_SELECTED}
                                </div>
                            </div>
                        );
                    } else if (documentExports.getUniformAssetsOnly(supportedLayers).isEmpty()) {
                        // Special case: there are selected layers, but no common assets (or none at all)
                        containerContents = (
                            <div className="libraries__content panel__info">
                                <div className="panel__info__body">
                                    {strings.EXPORT.NO_ASSETS}
                                </div>
                            </div>
                        );
                    }
                } else {
                    exportDisabled = exportDisabled || documentExports.rootExports.isEmpty();
                    supportedLayers = undefined;
                }

                containerContents = containerContents || (
                    <div>
                        <ExportList {...this.props}
                            documentExports={this.state.documentExports}
                            layers={supportedLayers}
                            onFocus={this._handleFocus}/>
                    </div>
                );
            }

            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "export": true,
                "section": true,
                "section__collapsed": !this.props.visible
            });

            return (
                <section
                    className={sectionClasses}
                    onScroll={this._handleScroll}>
                    <TitleHeader
                        title={strings.TITLE_EXPORT}
                        visible={this.props.visible}
                        disabled={disabled}
                        onDoubleClick={this.props.onVisibilityToggle}>
                        <div className="layer-exports__workflow-buttons">
                            <Button
                                className="button-plus"
                                disabled={exportDisabled || disabled}
                                title={strings.TOOLTIPS.EXPORT_EXPORT_ASSETS}
                                onClick={this._exportAssetsClickHandler}
                                onDoubleClick={this._addAssetDoubleClickHandler}>
                                <SVGIcon
                                    CSSID={exportState.serviceBusy ? "loader" : "export"} />
                            </Button>
                            <Gutter />
                            <Button
                                className="button-plus"
                                disabled={disabled}
                                title={strings.TOOLTIPS.EXPORT_ADD_ASSET}
                                onClick={this._addAssetClickHandler}
                                onDoubleClick={this._addAssetDoubleClickHandler}>
                                <SVGIcon
                                    viewbox="0 0 16 16"
                                    CSSID="add-new" />
                            </Button>
                            <Gutter />
                            <Button
                                className="button-iOS"
                                disabled={disabled}
                                title={strings.TOOLTIPS.EXPORT_IOS_PRESETS}
                                onClick={this._addAssetClickHandler.bind(this, "IOS")}>
                                <SVGIcon
                                    viewbox="0 0 24 16"
                                    CSSID="iOS" />
                            </Button>
                            <Gutter />
                            <Button
                                className="button-xdpi"
                                disabled={disabled}
                                title={strings.TOOLTIPS.EXPORT_HDPI_PRESETS}
                                onClick={this._addAssetClickHandler.bind(this, "HDPI")}>
                                <SVGIcon
                                    viewbox="0 0 24 16"
                                    CSSID="hdpi" />
                            </Button>
                        </div>
                    </TitleHeader>
                    <div className={containerClasses}>
                        {containerContents}
                    </div>
                </section>
            );
        }
    });

    module.exports = ExportPanel;
});
