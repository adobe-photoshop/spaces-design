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
        Immutable = require("immutable");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        Datalist = require("jsx!js/jsx/shared/Datalist"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        ExportAsset = require("js/models/exportasset");

    var mathUtil = require("js/util/math"),
        strings = require("i18n!nls/strings");

    /**
     * The options for the scale datalist
     * @private
     * @type {Immutable.OrderedMap.<string, {id: string, title: string}>}
     */
    var _scaleOptions = Immutable.OrderedMap(ExportAsset.SCALES
        .map(function (scale) {
            var obj = {
                id: scale.toString(),
                title: scale.toString()
            };
            return [scale.toString(), obj];
        }));

    /**
     * The options for the format datalist
     * @private
     * @type {Immutable.OrderedMap.<string, {id: string, title: string}>}
     */
    var _formatOptions = Immutable.OrderedMap(ExportAsset.FORMATS
        .map(function (format) {
            var obj = {
                id: format,
                title: format.toUpperCase()
            };
            return [format, obj];
        }));

    /**
     * Local React Component that displays a single Export Asset, including UI elements to update its properties
     */
    var LayerExportAsset = React.createClass({

        mixins: [FluxMixin],

        propTypes: {
            document: React.PropTypes.object.isRequired,
            layer: React.PropTypes.object.isRequired,
            index: React.PropTypes.number.isRequired,
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
                        className="layer-exports__delete-button"
                        title={strings.TOOLTIPS.EXPORT_REMOVE_ASSET}
                        onClick={this._handleDeleteClick}>
                        <SVGIcon CSSID="delete" />
                    </Button>
                </div>
            );
        }
    });

    var LayerExports = React.createClass({

        propTypes: {
            document: React.PropTypes.object.isRequired,
            documentExports: React.PropTypes.object.isRequired,
            layer: React.PropTypes.object.isRequired
        },

        render: function () {
            var document = this.props.document,
                layer = this.props.layer,
                documentExports = this.props.documentExports,
                layerExports = documentExports && documentExports.layerExportsMap.get(layer.id),
                exportComponents;

            if (!layerExports || layerExports.size < 1) {
                return null;
            } else {
                exportComponents = layerExports.map(function (i, k) {
                    return (
                        <LayerExportAsset
                            document={document}
                            layer={layer}
                            index={k}
                            key={k}
                            exportAsset={i} />
                    );
                }, this).toArray();

                return (
                    <div className="layer-exports__header" >
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
                            <Gutter />
                        </div>
                        {exportComponents}
                    </div>
                );
            }
        }
    });

    module.exports = LayerExports;
});
