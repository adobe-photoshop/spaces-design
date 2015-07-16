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
        collection = require("js/util/collection"),
        Immutable = require("immutable"),
        strings = require("i18n!nls/strings");
        

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonItem = SplitButton.SplitButtonItem;
        
    // strings = require("i18n!nls/strings");

    var LibraryBar = React.createClass({
        mixins: [FluxMixin],
        
        propTypes: {
            selectedLayers: React.PropTypes.instanceOf(Immutable.List).isRequired,
            disabled: React.PropTypes.bool
        },

        /**
         * Uploads the selected layer(s) as a graphic asset to CC Libraries
         * @private
         */
        addGraphic: function () {
            this.getFlux().actions.libraries.createElementFromSelectedLayer();
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
         */
        addColorAsset: function (color) {
            // FIXME: We may also need to extend to other color spaces/representations here, check other uses of colors
            this.getFlux().actions.libraries.createColorAsset(color);
        },

        render: function () {
            return (
                <div className="formline libraries-bar">
                    <ul className="button-radio">
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
                        {this._createColorButton("fills", strings.TOOLTIPS.ADD_FILL_COLOR)}
                        {this._createColorButton("strokes", strings.TOOLTIPS.ADD_STROKE_COLOR)}
                        <SplitButtonItem
                            className="hide"
                            title={strings.TOOLTIPS.SEARCH_ADOBE_STOCK}
                            iconId="swap"
                            FIXME="Adobe Stock Image link"
                            />
                        <SplitButtonItem
                            className="hide"
                            title={strings.TOOLTIPS.SYNC_LIBRARIES}
                            iconId="libraries-CC"
                            FIXME="syncIcon, also make sure these last two are right aligned"
                            />
                    </ul>
                    <Gutter />
                </div>
            );
        },
        
        _createColorButton: function (colorName, buttonText) {
            var colors = this.props.selectedLayers.map(function (layer) {
                var colors = layer[colorName];
                return colors.isEmpty() ? null : colors.first().color;
            });
            var uniqueColors = collection.unique(colors);
            
            if (uniqueColors.size !== 1 || uniqueColors.first() === null) {
                return null;
            }
            
            return (
                <SplitButtonItem title={buttonText} disabled={this.props.disabled}>
                    <div className="split-button__item__color-icon"
                         style={{ backgroundColor: uniqueColors.first().toCssRGB() }}
                         onClick={this.addColorAsset.bind(this, uniqueColors.first())} />
                </SplitButtonItem>
            );
        },
        
        _canAddGraphic: function () {
            return !this.props.disabled && !this.props.selectedLayers.isEmpty();
        },
        
        _canAddCharacterStyle: function () {
            var nonTextLayer = function (layer) {
                return layer.kind !== layer.layerKinds.TEXT;
            };
            
            return !this.props.disabled &&
                   !this.props.selectedLayers.isEmpty() &&
                   this.props.selectedLayers.filter(nonTextLayer).isEmpty();
        },
        
        _canAddLayerStyle: function () {
            return !this.props.disabled &&
                   this.props.selectedLayers.size === 1 &&
                   this.props.selectedLayers.first().hasLayerEffect();
        }
    });

    module.exports = LibraryBar;
});
