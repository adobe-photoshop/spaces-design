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
        FluxMixin = Fluxxor.FluxMixin(React);

    var SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings"),
        Document = require("js/models/document"),
        ui = require("js/util/ui");

    var LibraryBar = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            document: React.PropTypes.instanceOf(Document).isRequired,
            disabled: React.PropTypes.bool
        },

        /**
         * Uploads the selected layer(s) as a graphic asset to CC Libraries
         * @private
         */
        addGraphic: function () {
            this.getFlux().actions.libraries.createGraphicFromSelectedLayer();
        },

        /**
         * Uploads the selected layer's text style to the libraries
         * @private
         */
        addCharacterStyle: function () {
            this.getFlux().actions.libraries.createCharacterStyleFromSelectedLayer();
        },

        /**
         * Uploads the selected layer's effects as a layer style to the libraries
         * @private
         */
        addLayerStyle: function () {
            this.getFlux().actions.libraries.createLayerStyleFromSelectedLayer();
        },

        /**
         * Uploads a color asset to the library
         * @private
         *
         * @param {Color} color
         */
        addColorAsset: function (color) {
            // FIXME: We may also need to extend to other color spaces/representations here, check other uses of colors
            this.getFlux().actions.libraries.createColorAsset(color);
        },

        /**
         * Helper function to create color button
         * @private
         *
         * @param {function(layer): {{color: Color, title: string} | null}} optionsFn
         * @return {?SplitButtonItem}
         */
        _createColorButton: function (optionsFn) {
            var selectedLayers = this.props.document.layers.selected,
                layer = selectedLayers.first();

            if (selectedLayers.size !== 1) {
                return null;
            }

            var options = optionsFn(layer) || {},
                color = options.color,
                title = options.title;

            if (!color || !title) {
                return null;
            }

            return (
                <SplitButtonItem title={title} disabled={this.props.disabled}>
                    <div className="split-button__item__color-icon"
                         style={{ backgroundColor: color.toTinyColor().toRgbString() }}
                         onClick={!this.props.disabled && this.addColorAsset.bind(this, color)}/>
                </SplitButtonItem>
            );
        },

        /**
         * True if user can add the selected layer(s) as graphic into the libraries.
         * @private
         *
         * @return {boolean}
         */
        _canAddGraphic: function () {
            var selectedLayers = this.props.document.layers.selected;

            if (this.props.disabled || selectedLayers.isEmpty()) {
                return false;
            }

            // Single linked layer is not accepted, but multiple linked (or mixed) layers are accepted.
            if (selectedLayers.size === 1 && selectedLayers.first().isLinked) {
                return false;
            }

            var layersAreAllEmpty = selectedLayers.every(function (layer) {
                return layer.kind === layer.layerKinds.GROUP && this.props.document.layers.isEmptyGroup(layer);
            }.bind(this));

            return !layersAreAllEmpty;
        },

        /**
         * True if user can add the selected text layer into the libraries.
         * @private
         *
         * @return {boolean}
         */
        _canAddCharacterStyle: function () {
            if (this.props.disabled ||
                this.props.document.layers.selected.size !== 1 ||
                !this.props.document.layers.selected.first().isTextLayer()) {
                return false;
            }

            var fontStore = this.getFlux().store("font"),
                text = this.props.document.layers.selected.first().text,
                characterStyle = text.characterStyle,
                textHasMissingFont = !fontStore.getFontFamilyFromPostScriptName(characterStyle.postScriptName);

            return !textHasMissingFont;
        },

        /**
         * True if user can add the style of the selected layer into the libraries.
         * @private
         *
         * @return {boolean}
         */
        _canAddLayerStyle: function () {
            return !this.props.disabled &&
                   this.props.document.layers.selected.size === 1 &&
                   this.props.document.layers.selected.first().hasLayerEffect();
        },
        
        /**
         * Sync all libraries.
         */
        _handleSyncLibraries: function () {
            this.getFlux().actions.libraries.syncLibraries();
        },

        render: function () {
            var adobeStockURL = "https://stock.adobe.com";

            var addFillButton = this._createColorButton(function (layer) {
                return !layer.fill ? null :
                    { color: layer.fill.color, title: strings.TOOLTIPS.ADD_FILL_COLOR };
            });

            var addStrokeButton = this._createColorButton(function (layer) {
                return !layer.stroke ? null :
                    { color: layer.stroke.color, title: strings.TOOLTIPS.ADD_STROKE_COLOR };
            });

            var addTextColorButton = this._createColorButton(function (layer) {
                return !layer.isTextLayer() ? null :
                    { color: layer.text.characterStyle.color, title: strings.TOOLTIPS.ADD_TEXT_COLOR };
            });

            return (
                <div className={"libraries-bar " + this.props.className}>
                    <ul className="button-radio libraries-bar__section__left">
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ADD_GRAPHIC}
                            iconId="libraries-addGraphic"
                            onClick={this.addGraphic}
                            disabled={!this._canAddGraphic()}
                             />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ADD_CHARACTER_STYLE}
                            onClick={this.addCharacterStyle}
                            iconId="libraries-addCharStyle"
                            disabled={!this._canAddCharacterStyle()}
                            />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ADD_LAYER_STYLE}
                            iconId="libraries-addLayerStyle"
                            onClick={this.addLayerStyle}
                            disabled={!this._canAddLayerStyle()}
                            />
                        {addFillButton}
                        {addStrokeButton}
                        {addTextColorButton}
                    </ul>

                    <ul className="button-radio libraries-bar__section__right">
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SEARCH_ADOBE_STOCK}
                            iconId="libraries-stock"
                            onClick={ui.openURL.bind(null, adobeStockURL)}/>
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SYNC_LIBRARIES}
                            iconId={this.props.isSyncing ? "loader" : "libraries-cc"}
                            iconPath={this.props.isSyncing ? "" : null}
                            onClick={this._handleSyncLibraries}
                            disabled={this.props.disabled}/>
                    </ul>
                </div>
            );
        }
    });

    module.exports = LibraryBar;
});
