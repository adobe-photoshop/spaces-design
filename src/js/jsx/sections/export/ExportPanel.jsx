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

    var Immutable = require("immutable"),
        React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        classnames = require("classnames"),
        _ = require("lodash");

    var os = require("adapter/os");

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        ExportList = require("jsx!js/jsx/sections/export/ExportList"),
        Button = require("jsx!js/jsx/shared/Button"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        strings = require("i18n!nls/strings"),
        ExportAsset = require("js/models/exportasset"),
        synchronization = require("js/util/synchronization"),
        collection = require("js/util/collection");

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
                documentExports = flux.store("export").getDocumentExports(documentID);

            return {
                documentExports: documentExports
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
        _addAssetClickHandler: function () {
            var document = this.props.document,
                selectedLayers = document && document.layers.selected,
                documentExports = this.state.documentExports,
                exportsList,
                layer;

            if (selectedLayers && selectedLayers.size > 0) {
                // temp until we find a better way to handle more layers...
                layer = selectedLayers.first();
                exportsList = layer && documentExports && documentExports.layerExportsMap.get(layer.id);
            } else {
                exportsList = documentExports && documentExports.rootExports;
            }
                
            var existingScales = (exportsList && collection.pluck(exportsList, "scale")) || Immutable.List(),
                remainingScales = collection.difference(ExportAsset.SCALES, existingScales),
                nextScale = remainingScales.size > 0 ? remainingScales.first() : null,
                nextAssetIndex = (exportsList && exportsList.size) || 0;

            var layers = layer ? Immutable.List.of(layer) : null;
            this.getFlux().actions.export.addAsset(document, layers, nextAssetIndex, nextScale);
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
                var layerIDs = collection.pluck(selectedLayers, "id");
                this.getFlux().actions.export.exportLayerAssets(document, layerIDs);
            } else {
                this.getFlux().actions.export.exportDocumentAssets(document);
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
                disabled = this.props.disabled,
                containerContents,
                addAssetClickHandler,
                exportAssetsClickHandler;

            if (!document || !this.props.visible || disabled) {
                containerContents = null;
            } else if (document.layers.selected.size > 1) {
                // FOR NOW - we don't allow multiple selected layers
                containerContents = (<div>{strings.EXPORT.SELECT_SINGLE_LAYER}</div>);
                disabled = true;
            } else if (document.layers.backgroundSelected) {
                // don't support exports of the background
                containerContents = null;
                disabled = true;
            } else {
                var selectedLayers = this.props.document.layers.selected;

                addAssetClickHandler = this._addAssetClickHandler;
                exportAssetsClickHandler = this._exportAssetsClickHandler;

                containerContents = (
                    <div>
                        <ExportList {...this.props}
                            documentExports={this.state.documentExports}
                            layers={selectedLayers}
                            onFocus={this._handleFocus}/>
                    </div>
                );
            }

            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "style": true,
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
                                title={strings.TOOLTIPS.EXPORT_EXPORT_ASSETS}
                                onClick={exportAssetsClickHandler || _.noop}
                                onDoubleClick={this._addAssetDoubleClickHandler}>
                                <SVGIcon
                                    CSSID="export" />
                            </Button>
                            <Gutter />
                            <Button
                                className="button-plus"
                                title={strings.TOOLTIPS.EXPORT_ADD_ASSET}
                                onClick={addAssetClickHandler || _.noop}
                                onDoubleClick={this._addAssetDoubleClickHandler}>
                                <SVGIcon
                                    viewbox="0 0 12 12"
                                    CSSID="plus" />
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
