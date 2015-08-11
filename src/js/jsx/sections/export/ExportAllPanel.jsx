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
        classnames = require("classnames"),
        _ = require("lodash");

    var Button = require("jsx!js/jsx/shared/Button"),
        CheckBox = require("jsx!js/jsx/shared/CheckBox"),
        TitleHeader = require("jsx!js/jsx/shared/TitleHeader");

    var strings = require("i18n!nls/strings"),
        ExportAsset = require("js/models/exportasset");

    /**
     * Private React component that represents one Layer and its configured export assets
     */
    var LayerExportsItem = React.createClass({
        mixins: [FluxMixin],

        /**
         * Handle the change of this layer's checkbox, update the exportEnabled flag accordingly
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} checked 
         */
        _handleLayerSelectedChanged: function (event, checked) {
            this.getFlux().actions.export.setLayerExportEnabled(this.props.document, this.props.layer, checked);
        },

        render: function () {
            var layer = this.props.layer,
                layerExports = this.props.layerExports,
                freshState = this.props.freshState;

            // The list of assets within a layer
            var assetsComponent = layerExports.map(function (asset, key) {
                var stable = asset.status === ExportAsset.STATUS.STABLE,
                    assetTitle = asset.scale + "x";

                var assetClasses = classnames({
                    "exports-panel__layer-asset": true,
                    "exports-panel__layer-asset__stale": freshState && stable,
                    "exports-panel__layer-asset__stable": !freshState && stable
                });

                return (
                    <div key={key} className={assetClasses}>
                        {assetTitle}
                    </div>
                );
            });

            return (
                <div className="exports-panel__layer-wrapper" >
                    <CheckBox
                        checked={layer.exportEnabled}
                        onChange={this._handleLayerSelectedChanged}
                        size="column-2" />
                    <div className="exports-panel__layer-info">
                        <div
                            className="exports-panel__layer__name"
                            title={layer.name} >
                            {layer.name}
                        </div>
                        <div className="exports-panel__layer-assets">
                            {assetsComponent}
                        </div>
                    </div>
                </div>
            );
        }
    });

    /**
     * The main "EXPORT" panel that provides a list of all configured assets.
     * Allows layers to be enabled/disabled for export,
     * and initiates the process to export all enabled-AND-configured assets
     */
    var ExportAllPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("export", "application", "document")],

        propTypes: {
            dismissDialog: React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                dismissDialog: _.identity
            };
        },

        getInitialState: function () {
            // the fresh state property allows assets to be determined as "stale"
            // meaning that they have been exported previously, but not during this modal session
            return {
                fresh: true
            };
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                document = flux.store("application").getCurrentDocument(),
                documentExports = document && flux.store("export").getDocumentExports(document.id);

            return {
                document: document,
                documentExports: documentExports
            };
        },

        /**
         * Export all assets for layers that have been enabled for export (via the checkboxes)
         * @private
         */
        _exportAllAssets: function () {
            this.setState({ fresh: false }, function () {
                var exportActions = this.getFlux().actions.export,
                    document = this.state.document;
                return exportActions.setAllAssetsRequested(document).then(function () {
                    return exportActions.exportAllAssets(document);
                });
            }.bind(this));
        },

        render: function () {
            var document = this.state.document,
                layerExportsMap = this.state.documentExports && this.state.documentExports.layerExportsMap,
                freshState = this.state.fresh;

            if (!document || !layerExportsMap) {
                return null;
            }

            // Iterate over all configured assets, build the individual components,
            // and separate into separate lists (artboards vs. non-artboards)
            var layerExportComponents = [],
                artboardExportComponents = [];
            if (layerExportsMap && layerExportsMap.size > 0) {
                layerExportsMap.forEach(function (layerExports, key) {
                    var layer = document.layers.byID(key);

                    if (layer && layerExports && layerExports.size > 0) {
                        var layerComponent = (
                            <LayerExportsItem
                                document={document}
                                layer={layer}
                                layerExports={layerExports}
                                freshState={freshState}
                                key={"layer-" + layer.id} />
                        );

                        if (layer.isArtboard) {
                            artboardExportComponents.push(layerComponent);
                        } else {
                            layerExportComponents.push(layerComponent);
                        }
                    }
                });
            }

            return (
                <div className="exports-panel__container">
                    <TitleHeader
                        title={strings.TITLE_EXPORT} />
                    <div className="exports-panel__two-column">
                        <div className="exports-panel__asset-list__container">
                            <TitleHeader
                                title={strings.EXPORT.EXPORT_LIST_ARTBOARDS} />
                            <div className="exports-panel__asset-list__list">
                                {artboardExportComponents}
                            </div>
                        </div>
                        <div className="exports-panel__asset-list__container">
                            <TitleHeader
                                title={strings.EXPORT.EXPORT_LIST_LAYERS} />
                            <div className="exports-panel__asset-list__list">
                                {layerExportComponents}
                            </div>
                        </div>
                    </div>
                    <hr />
                    <div className="exports-panel__button-group">
                        <Button
                            onClick={this.props.dismissDialog}>
                            {strings.EXPORT.BUTTON_CANCEL}
                        </Button>
                        <Button
                            onClick={this._exportAllAssets}>
                            {strings.EXPORT.BUTTON_EXPORT}
                        </Button>
                    </div>
                </div>

            );
        }
    });

    module.exports = ExportAllPanel;
});
