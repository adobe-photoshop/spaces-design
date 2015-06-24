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

    module.exports = {
        /**
         * Whether history state coalescing is in effect.
         * @private
         * @type {boolean} 
         */
        _coalescing: false,

        /**
         * If coalescing is in effect, whether the next command should be coalesced.
         * @private
         * @type {boolean} 
         */
        _coalesce: false,

        /**
         * Start coalescing history states
         *
         * @private
         */
        startCoalescing: function () {
            this._coalescing = true;
            this._coalesce = false;
        },

        /**
         * Stop coalescing history states
         *
         * @private
         */
        stopCoalescing: function () {
            this._coalescing = false;
        },

        /**
         * Determine whether a particular change should be coalesced.
         *
         * @
         */
        shouldCoalesce: function () {
            // If we're coalescing, coalesce all but the first action
            var coalesce = this._coalescing ? this._coalesce : false;
            if (this._coalescing && !coalesce) {
                this._coalesce = true;
            }

            return coalesce;
        }
    };
});
