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
         * @type {object}
         */
        _storedStyle: null,

        /**
         * Currently active sample types based on selection / clicked point
         *
         * @type {Array.<object>}
         */
        _sampleTypes: null,

        /** 
         * Binds flux actions.
         */
        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.style.COPY_STYLE, this._copyStyle,
                events.style.SHOW_HUD, this._showHUD,
                events.style.HIDE_HUD, this._hideHUD
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
         * Returns the style types to be shown at the HUD, if any
         *
         * @return {object?}
         */
        getHUDStyles: function () {
            return this._sampleTypes;
        },

        /**
         * Returns canvas coordinates where sampler was started
         *
         * @return {{x: number, y: number}}
         */
        getSamplePoint: function () {
            return this._samplePoint;
        },

        /**
         * Reset or initialize the store state
         *
         * @private
         */
        _handleReset: function () {
            this._storedStyle = null;
            this._sampleTypes = null;
        },

        /**
         * Saves the passed in style internally for pasting
         *
         * @private
         * @param {object} payload
         */
        _copyStyle: function (payload) {
            this._storedStyle = payload.style;

            this.emit("change");
        },

        /**
         * Sets the showable sample types, and emits a change event for 
         * Sampler overlay to pick up
         *
         * @private
         * @param {object} payload
         */
        _showHUD: function (payload) {
            this._sampleTypes = payload.sampleTypes;
            this._samplePoint = { x: payload.x, y: payload.y };
            
            this.emit("change");
        },

        /**
         * Clears the showable sample types, and emits a change event so
         * Sampler overlay can clear up the HUD
         * @private
         */
        _hideHUD: function () {
            this._sampleTypes = null;
            this._samplePoint = null;

            this.emit("change");
        }
    });

    module.exports = StyleStore;
});
