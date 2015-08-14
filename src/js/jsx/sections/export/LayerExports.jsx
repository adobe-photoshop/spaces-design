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
        _ = require("lodash"),
        Immutable = require("immutable");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        Datalist = require("jsx!js/jsx/shared/Datalist"),
        TextInput = require("jsx!js/jsx/shared/TextInput");

    var collection = require("js/util/collection"),
        mathUtil = require("js/util/math"),
        strings = require("i18n!nls/strings");

    /**
     * The options for the scale datalist
     * @private
     * @type {Immutable.OrderedMap.<string, {id: string, title: string}>}
     */
    var _scaleOptions = Immutable.OrderedMap({
        "0.5": {
            id: "0.5",
            title: "0.5x"
        },
        "1": {
            id: "1",
            title: "1x"
        },
        "1.5": {
            id: "1.5",
            title: "1.5x"
        },
        "2": {
            id: "2",
            title: "2x"
        }
    });

    /**
     * The options for the format datalist
     * @private
     * @type {Immutable.OrderedMap.<string, {id: string, title: string}>}
     */
    var _formatOptions = Immutable.OrderedMap({
        "png": {
            id: "png",
            title: "PNG"
        },
        "jpg": {
            id: "jpg",
            title: "JPG"
        },
        "svg": {
            id: "svg",
            title: "SVG"
        },
        "pdf": {
            id: "pdf",
            title: "PDF"
        }
    });

    /**
     * A simple array of scale values, used to determine "next" scale when adding a new asset
     * @private
     * @type {Array.<number>}
     */
    var _allScales = [0.5, 1, 1.5, 2];

    /**
     * Local React Component that displays a single Export Asset, including UI elements to update its properties
     */
    var LayerExportAsset = React.createClass({

        mixins: [FluxMixin],

        propTypes: {
            index: React.PropTypes.number.isRequired,
            layer: React.PropTypes.object.isRequired,
            exportAsset: React.PropTypes.object.isRequired
        },

        /**
         * Delete this asset
         *
         * @private
         */
        _handleDeleteClick: function () {
            var document = this.props.document,
                layer = this.props.layer,
                index = this.props.index;

            this.getFlux().actions.export.deleteLayerExportAsset(document, layer, index);
        },

        /**
         * Update this asset's scale
         *
         * @private
         */
        _handleUpdateScale: function (scale) {
            var scaleNum = mathUtil.parseNumber(scale);

            this.getFlux().actions.export.updateLayerAssetScale(
                this.props.document, this.props.layer, this.props.index, scaleNum);
        },

        /**
         * Update this asset's suffix
         *
         * @private
         */
        _handleUpdateSuffix: function (event, suffix) {
            this.getFlux().actions.export.updateLayerAssetSuffix(
                this.props.document, this.props.layer, this.props.index, suffix);
        },

        /**
         * Update this asset's format
         *
         * @private
         */
        _handleUpdateFormat: function (format) {
            var formatLower = format && format.toLowerCase();

            this.getFlux().actions.export.updateLayerAssetFormat(
                this.props.document, this.props.layer, this.props.index, formatLower);
        },

        render: function () {
            var layer = this.props.layer,
                exportAsset = this.props.exportAsset,
                scale = exportAsset.scale || 1,
                scaleOption = _scaleOptions.has(scale.toString()) ?
                    _scaleOptions.get(scale.toString()) : _scaleOptions.get("1"),
                scaleListID = "layerExportAsset-scale" + layer.id + "-" + this.props.index,
                formatListID = "layerExportAsset-format-" + layer.id + "-" + this.props.index;

            return (
                <div className="formline">
                    <Datalist
                        list={scaleListID}
                        className="dialog-export-scale"
                        options={_scaleOptions.toList()}
                        value={scaleOption.title}
                        onChange={this._handleUpdateScale}
                        live={false}
                        size="column-3" />
                    <Gutter />
                    <TextInput
                        value={exportAsset.suffix}
                        singleClick={true}
                        editable={true}
                        onChange={this._handleUpdateSuffix}
                        size="column-6" />
                    <Gutter />
                    <Datalist
                        list={formatListID}
                        className="dialog-export-format"
                        options={_formatOptions.toList()}
                        value={exportAsset.format.toUpperCase()}
                        onChange={this._handleUpdateFormat}
                        live={false}
                        size="column-4" />
                    <Gutter />
                    <Button
                        className="button-plus" // a bit of a hack
                        title={strings.TOOLTIPS.EXPORT_REMOVE_ASSET}
                        onClick={this._handleDeleteClick}>
                        <SVGIcon
                            viewbox="0 0 16 16"
                            CSSID="delete" />
                    </Button>
                </div>
            );
        }
    });

    var LayerExports = React.createClass({

        mixins: [FluxMixin, StoreWatchMixin("export")],

        propTypes: {
            document: React.PropTypes.object.isRequired
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                documentID = this.props.document.id,
                documentExports = flux.store("export").getDocumentExports(documentID);

            return {
                documentExports: documentExports
            };
        },

        /**
         * Add a new Asset to this list
         *
         * @private
         */
        _addAssetClickHandler: function (layer) {
            var document = this.props.document,
                documentExports = this.state.documentExports,
                layerExports = documentExports && documentExports.layerExportsMap.get(layer.id);

            // Determine the scale of the potential next asset
            var remainingScales = _.difference(_allScales, collection.pluck(layerExports, "scale").toArray()),
                nextScale = remainingScales.length > 0 ? remainingScales[0] : null,
                nextAssetIndex = (layerExports && layerExports.size) || 0;

            this.getFlux().actions.export.updateLayerAssetScale(document, layer, nextAssetIndex, nextScale);
        },

        render: function () {
            var document = this.props.document,
                documentExports = this.state.documentExports;

            if (document.layers.selected.size !== 1) {
                return (<div>{strings.EXPORT.SELECT_SINGLE_LAYER}</div>);
            }

            var selectedLayer = document.layers.selected.first();

            if (selectedLayer.isBackground) {
                return null;
            }

            var layerExports = documentExports && documentExports.layerExportsMap.get(selectedLayer.id),
                exportComponents;

            if (layerExports && layerExports.size > 0) {
                exportComponents = layerExports.map(function (i, k) {
                    return (
                        <LayerExportAsset
                            document={this.props.document}
                            index={k}
                            key={k}
                            layer={selectedLayer}
                            exportAsset={i} />
                    );
                }, this).toArray();
            }

            return (
                <div>
                    <div className="formline">
                        <Gutter />
                        <hr className="sub-header-rule"/>
                        <Button
                            className="button-plus"
                            title={strings.TOOLTIPS.EXPORT_ADD_ASSET}
                            onClick={this._addAssetClickHandler.bind(this, selectedLayer)}>
                            <SVGIcon
                                viewbox="0 0 12 12"
                                CSSID="plus" />
                        </Button>
                    </div>
                    <div className="formline">
                        <Label
                            title={strings.EXPORT.TITLE_SCALE}
                            size="column-3">
                            {strings.EXPORT.TITLE_SCALE}
                        </Label>
                        <Gutter />
                        <Label
                            title={strings.EXPORT.TITLE_SUFFIX}
                            size="column-6">
                            {strings.EXPORT.TITLE_SUFFIX}
                        </Label>
                        <Gutter />
                        <Label
                            title={strings.EXPORT.TITLE_SETTINGS}
                            size="column-4">
                            {strings.EXPORT.TITLE_SETTINGS}
                        </Label>
                    </div>
                    {exportComponents}
                </div>
            );
        }
    });

    module.exports = LayerExports;
});
