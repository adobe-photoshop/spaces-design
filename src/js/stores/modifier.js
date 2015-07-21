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

    var Fluxxor = require("fluxxor");

    var events = require("js/events");

    /**
     * 
     * @constructor
     */
    var ModifierStore = Fluxxor.createStore({
        /**
         * @private
         * @type {{alt: boolean, command: boolean, control: boolean, shift: boolean}}
         */
        _modifiers: null,

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.modifiers.MODIFIERS_CHANGED, this._handleModifiersChanged
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._modifiers = {
                alt: false,
                command: false,
                control: false,
                shift: false
            };
        },

        /**
         * Handler for the MODIFIERS_CHANGED event.
         * 
         * @private
         * @param {{alt: boolean, command: boolean, control: boolean, shift: boolean}} payload
         */
        _handleModifiersChanged: function (payload) {
            this._modifiers.alt = !!payload.alt;
            this._modifiers.command = !!payload.command;
            this._modifiers.control = !!payload.control;
            this._modifiers.shift = !!payload.shift;

            this.emit("change");
        },

        getState: function () {
            return this._modifiers;
        }
    });

    module.exports = ModifierStore;
});
