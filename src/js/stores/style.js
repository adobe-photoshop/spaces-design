/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

    var Fluxxor = require("fluxxor");

    var events = require("../events");

    /**
     * Manages a style clipboard and style link maps of active documents
     */
    var StyleStore = Fluxxor.createStore({
        /**
         * Currently stored style object for copy/pasting
         * 
         * @private
         * @type {Object}
         */
        _storedStyle: null,

        /** 
         * Binds flux actions.
         */
        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.style.COPY_STYLE, this._copyStyle
            );

            this._handleReset();
        },

        /**
         * Returns the currently copied style object
         *
         * @return {object}
         */
        getClipboardStyle: function () {
            return this._storedStyle;
        },

        /**
         * Reset or initialize the store state
         *
         * @private
         */
        _handleReset: function () {
            this._storedStyle = null;
        },

        /**
         * Copies the passed in layer's style to the clipboard
         *
         * @private
         * @param {{layer: Layer}} payload
         */
        _copyStyle: function (payload) {
            var layer = payload.layer,
                fontStore = this.flux.store("font"),
                fillColor = null,
                stroke = null,
                typeStyle = null,
                textAlignment = null;

            switch (layer.kind) {
            case layer.layerKinds.VECTOR:
                fillColor = layer.fills.first() ? layer.fills.first().color : null;
                stroke = layer.strokes.first();

                break;
            case layer.layerKinds.TEXT:
                fillColor = layer.text.characterStyle.color;
                fillColor = fillColor ? fillColor.setOpacity(layer.opacity) : null;
                typeStyle = fontStore.getTypeObjectFromLayer(layer);
                textAlignment = layer.text.paragraphStyle.alignment;

                break;
            }

            this._storedStyle = {
                effects: {
                    innerShadows: layer.innerShadows,
                    dropShadows: layer.dropShadows
                },
                fillColor: fillColor,
                stroke: stroke,
                typeStyle: typeStyle,
                textAlignment: textAlignment
            };

            this.emit("change");
        }
    });

    module.exports = StyleStore;
});
