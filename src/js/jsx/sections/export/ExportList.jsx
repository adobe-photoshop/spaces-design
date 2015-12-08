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

    var Label = require("js/jsx/shared/Label"),
        Button = require("js/jsx/shared/Button"),
        SVGIcon = require("js/jsx/shared/SVGIcon"),
        Datalist = require("js/jsx/shared/Datalist"),
        TextInput = require("js/jsx/shared/TextInput"),
        ExportAsset = require("js/models/exportasset");

    var mathUtil = require("js/util/math"),
        collection = require("js/util/collection"),
        headlights = require("js/util/headlights"),
        nls = require("js/util/nls");

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
    var _formatOptions = Immutable.OrderedMap(ExportAsset.FORMATS_OPTIONS
        .map(function (formatOption, key) {
            var obj = {
                id: key.toString(),
                title: formatOption.label
            };
            return [key.toString(), obj];
        }));

    /**
     * Local React Component that displays a single Export Asset, including UI elements to update its properties
     */
    var ExportAssetFace = React.createClass({

        mixins: [FluxMixin],

        propTypes: {
            document: React.PropTypes.object.isRequired,
            layers: React.PropTypes.instanceOf(Immutable.Iterable), // undefined => doc-level export
            index: React.PropTypes.number.isRequired,
            exportAssets: React.PropTypes.instanceOf(Immutable.Iterable).isRequired
        },

        shouldComponentUpdate: function (nextProps) {
            return this.props.exportAssets !== nextProps.exportAssets;
        },

        /**
         * Delete this asset
         *
         * @private
         */
        _handleDeleteClick: function () {
            var document = this.props.document,
                layers = this.props.layers,
                index = this.props.index;

            this.getFlux().actions.export.deleteExportAsset(document, layers, index);

            headlights.logEvent("export", "delete", "single-asset");
        },

        /**
         * Update this asset's scale
         *
         * @private
         * @type {Datalist~onChange}
         */
        _handleUpdateScale: function (scale) {
            var scaleNum = mathUtil.parseNumber(scale);

            this.getFlux().actions.export.updateLayerAssetScale(
                this.props.document, this.props.layers, this.props.index, scaleNum);
        },

        /**
         * Update this asset's suffix
         *
         * @private
         */
        _handleUpdateSuffix: function (event, suffix) {
            this.getFlux().actions.export.updateLayerAssetSuffix(
                this.props.document, this.props.layers, this.props.index, suffix);
        },

        /**
         * Update this asset's format and quality
         *
         * @private
         * @type {Datalist~onChange}
         */
        _handleUpdateFormat: function (id) {
            var formatIndex = mathUtil.parseNumber(id),
                formatOption = ExportAsset.FORMATS_OPTIONS.get(formatIndex);

            if (!formatOption || !formatOption.format) {
                throw new Error("Could not find export format option with id " + id);
            }

            var props = {
                format: formatOption.format,
                quality: formatOption.quality
            };

            this.getFlux().actions.export.updateExportAsset(
                this.props.document, this.props.layers, this.props.index, props);
        },

        render: function () {
            var exportAssets = this.props.exportAssets,
                exportAsset = collection.uniformValue(exportAssets, ExportAsset.similar);

            if (!exportAsset) {
                // We only display an asset if it is functionally uniform across all layers
                return null;
            }

            var scale = exportAsset.scale,
                scaleOption = _scaleOptions.has(scale.toString()) ?
                    _scaleOptions.get(scale.toString()) : _scaleOptions.get("1"),
                formatOptionId = exportAsset.formatOptionIndex.toString(),
                formatOption = _formatOptions.get(formatOptionId) || { title: "-" },
                keySuffix = this.props.faceKey,
                scaleListID = "exportAsset-scale-" + keySuffix,
                formatListID = "exportAsset-format-" + keySuffix;

            return (
                <div className="formline formline__space-between">
                    <div className="control-group__vertical">
                        <Datalist
                            list={scaleListID}
                            className="dialog-export-scale"
                            options={_scaleOptions.toList()}
                            value={scaleOption.title}
                            selected={scaleOption.id}
                            onChange={this._handleUpdateScale}
                            changeOnBlur={false}
                            size="column-4" />
                    </div>
                    <div className="control-group__vertical">
                        <TextInput
                            value={exportAsset.suffix}
                            onChange={this._handleUpdateSuffix}
                            size="column-8" />
                    </div>
                    <div className="control-group__vertical">
                        <Datalist
                            list={formatListID}
                            className="dialog-export-format"
                            options={_formatOptions.toList()}
                            value={formatOption.title}
                            selected={formatOptionId}
                            onChange={this._handleUpdateFormat}
                            changeOnBlur={false}
                            size="column-8" />
                    </div>
                    <Button
                        className="control-group__vertical button-toggle"
                        title={nls.localize("strings.TOOLTIPS.EXPORT_REMOVE_ASSET")}
                        onClick={this._handleDeleteClick}>
                        <SVGIcon CSSID="delete" />
                    </Button>
                </div>
            );
        }
    });

    var ExportList = React.createClass({

        propTypes: {
            document: React.PropTypes.object.isRequired,
            documentExports: React.PropTypes.object.isRequired,
            layers: React.PropTypes.instanceOf(Immutable.Iterable) // undefined => doc-level export
        },

        render: function () {
            var document = this.props.document,
                layers = this.props.layers,
                documentExports = this.props.documentExports,
                keyprefix = layers && collection.pluck(layers, "key").join("-") || document.id,
                assetGroups,
                exportComponents;

            if (layers) {
                assetGroups = documentExports.getAssetGroups(layers).toList();
            } else {
                assetGroups = collection.zip(Immutable.List.of(documentExports.rootExports)).toList();
            }

            exportComponents = assetGroups.map(function (i, k) {
                var key = keyprefix + "-" + k;
                return (
                    <ExportAssetFace
                        document={document}
                        layers={layers}
                        index={k}
                        key={key}
                        faceKey={key}
                        exportAssets={i} />
                );
            }, this);

            return (
                <div className="layer-exports__header" >
                    <div className="formline formline__space-between">
                        <Label
                            title={nls.localize("strings.EXPORT.TITLE_SCALE")}
                            size="column-4"
                            className="label__medium__left-aligned scale-title">
                            {nls.localize("strings.EXPORT.TITLE_SCALE")}
                        </Label>
                        <Label
                            title={nls.localize("strings.EXPORT.TITLE_SUFFIX")}
                            size="column-8"
                            className="label__medium__left-aligned">
                            {nls.localize("strings.EXPORT.TITLE_SUFFIX")}
                        </Label>
                        <Label
                            title={nls.localize("strings.EXPORT.TITLE_SETTINGS")}
                            size="column-8"
                            className="label__medium__left-aligned">
                            {nls.localize("strings.EXPORT.TITLE_SETTINGS")}
                        </Label>
                        <div className="column-2"></div>
                    </div>
                    {exportComponents}
                </div>
            );
        }
    });

    module.exports = ExportList;
});
