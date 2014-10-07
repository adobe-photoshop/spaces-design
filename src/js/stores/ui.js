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

    var Fluxxor = require("fluxxor"),
        events = require("../events");

    var UIStore = Fluxxor.createStore({

        /**
         * The current window-to-canvas transform represented as a 2d matrix
         *
         * @private
         * @type {?Array.<number>}
         */
        _transformMatrix: null,
        
        initialize: function () {
            this.bindActions(
                events.ui.TRANSFORM_UPDATED, this._transformUpdated
            );
        },
        
        getState: function () {
            return {
                transformMatrix: this._transformMatrix
            };
        },

        /**
         * Map (x,y) coordinates in window space to canvas space.
         * 
         * @private
         * @param {number} x Offset from the left window edge
         * @param {number} y Offset from the top window edge
         * @return {{x: number, y: number}} A point that describes the offset
         *  from the top-left corner of the canvas.
         */
        transformWindowToCanvas: function (x, y) {
            var transform = this._transformMatrix,
                xx = transform[0],
                yx = transform[1],
                xy = transform[2],
                yy = transform[3],
                x0 = transform[4],
                y0 = transform[5];

            var xt = xx * x + xy * y + x0,
                yt = yx * x + yy * y + y0;

            return {
                x: xt,
                y: yt
            };
        },

        /**
         * Set the current transform from a transformation object.
         * 
         * @private
         * @param {{xx: number, yx: number, xy: number, yy: number, tx: number, ty: number}} transformObj
         */
        _setTransformObject: function (transformObj) {
            this._transformMatrix = [
                transformObj.xx,
                transformObj.yx,
                transformObj.xy,
                transformObj.yy,
                transformObj.tx,
                transformObj.ty
            ];
        },

        /**
         * Set the current transform from a 2d matrix. The format of this array
         * is described here:
         * http://cairographics.org/manual/cairo-cairo-matrix-t.html
         *
         * @private
         * @param {Array.<number>} transformMatrix
         */
        _setTransformMatrix: function (transformMatrix) {
            this._transformMatrix = transformMatrix;
        },

        /**
         * Reset the current window-to-canvas transform
         *
         * @private
         * @param {{transformMatrx: Array.<number>=, transformObject: object=}} payload
         */
        _transformUpdated: function (payload) {
            if (payload.transformMatrix) {
                this._setTransformMatrix(payload.transformMatrix);
            } else {
                this._setTransformObject(payload.transformObject);
            }
        }
    });

    module.exports = UIStore;
});
