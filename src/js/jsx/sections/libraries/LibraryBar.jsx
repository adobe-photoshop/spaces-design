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

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings"),
        Document = require("js/models/document");

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
         * 
         * @param {Color} color
         */
        addColorAsset: function (color) {
            // FIXME: We may also need to extend to other color spaces/representations here, check other uses of colors
            this.getFlux().actions.libraries.createColorAsset(color);
        },
        
        /**
         * Helper function to create color button based on the layer attribute (fills or strokes)
         * @private
         * 
         * @param {string} attr name of the color attribute ("fills" or "strokes")
         * @param {string} buttonTitle title of the button
         * 
         * @return {SplitButtonItem}
         */
        _createColorButton: function (attr, buttonTitle) {
            var layer = this.props.document.layers.selected.first();
            
            if (this.props.document.layers.selected.size !== 1 || layer[attr].isEmpty()) {
                return null;
            }
            
            var color = layer[attr].first().color;
            
            return (
                <SplitButtonItem title={buttonTitle} disabled={this.props.disabled}>
                    <div className="split-button__item__color-icon"
                         style={{ backgroundColor: color.toTinyColor().toRgbString() }}
                         onClick={this.addColorAsset.bind(this, color)} />
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
            if (this.props.disabled || this.props.document.layers.selected.isEmpty()) {
                return false;
            }

            var layersAreAllEmpty = this.props.document.layers.selected.every(function (layer) {
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
                characterStyle = text.characterStyles.first(),
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
        }
    });

    module.exports = LibraryBar;
});
