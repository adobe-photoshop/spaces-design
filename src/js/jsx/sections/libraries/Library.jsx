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

    var React = require("react");

    var os = require("adapter/os");

    var Graphic = require("jsx!./assets/Graphic"),
        Color = require("jsx!./assets/Color"),
        CharacterStyle = require("jsx!./assets/CharacterStyle"),
        LayerStyle = require("jsx!./assets/LayerStyle");

    var synchronization = require("js/util/synchronization");

    var typeNames = {
        "color": "application/vnd.adobe.element.color+dcx",
        "image": "application/vnd.adobe.element.image+dcx",
        "characterstyle": "application/vnd.adobe.element.characterstyle+dcx",
        "layerstyle": "application/vnd.adobe.element.layerstyle+dcx"
    };

    var Library = React.createClass({

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
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

        _getColorAssets: function (library) {
            var assets = library.getFilteredElements(typeNames.color),
                components = assets.map(function (asset) {
                    return (
                        <Color
                            key={asset.id}
                            element={asset}
                        />
                    );
                });
            // FIXME: Strings for asset types
            return (
                <div>
                    Colors
                    {components}
                </div>
            );
        },

        _getGraphicAssets: function (library) {
            var assets = library.getFilteredElements(typeNames.image),
                components = assets.map(function (asset) {
                    return (
                        <Graphic
                            key={asset.id}
                            element={asset}
                        />
                    );
                });
            // FIXME: Strings for asset types
            return (
                <div>
                    Graphics
                    {components}
                </div>
            );
        },

        _getCharacterStyleAssets: function (library) {
            var assets = library.getFilteredElements(typeNames.characterstyle),
                components = assets.map(function (asset) {
                    return (
                        <CharacterStyle
                            key={asset.id}
                            element={asset}
                        />
                    );
                });
            // FIXME: Strings for asset types
            return (
                <div>
                    Character Styles
                    {components}
                </div>
            );
        },

        _getLayerStyleAssets: function (library) {
            var assets = library.getFilteredElements(typeNames.layerstyle),
                components = assets.map(function (asset) {
                    return (
                        <LayerStyle
                            key={asset.id}
                            element={asset}
                        />
                    );
                });
            // FIXME: Strings for asset types
            return (
                <div>
                    Layer Styles
                    {components}
                </div>
            );
        },

        _getLibraryItems: function () {
            if (!this.props.library) {
                return null;
            }

            var elements = this._getColorAssets(this.props.library);

            return elements;
        },

        render: function () {
            if (!this.props.library) {
                return null;
            }
            var library = this.props.library;

            return (
                <div>
                    {this._getColorAssets(library)}
                    {this._getGraphicAssets(library)}
                    {this._getCharacterStyleAssets(library)}
                    {this._getLayerStyleAssets(library)}
                </div>
            );
        }
    });

    module.exports = Library;
});
