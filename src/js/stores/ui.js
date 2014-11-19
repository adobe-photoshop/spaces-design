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
        events = require("../events"),
        log = require("js/util/log");

    var UIStore = Fluxxor.createStore({

        /**
         * The current window-to-canvas transform represented as a 2d matrix
         *
         * @private
         * @type {?Array.<number>}
         */
        _transformMatrix: null,

        _inverseTransformMatrix: null,
        
        _zoom: null,
        
        initialize: function () {
            this.bindActions(
                events.ui.TRANSFORM_UPDATED, this._transformUpdated
            );
        },
        
        getState: function () {
            return {
                transformMatrix: this._transformMatrix,
                inverseTransformMatrix: this._inverseTransformMatrix,
                zoomFactor: this._zoom
            };
        },

        zoomWindowToCanvas: function (x) {
            return x * this._zoom;
        },

        zoomCanvasToWindow: function (x) {
            return x / this._zoom;
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
            if (!this._transformMatrix) {
                return {
                    x: 0,
                    y: 0
                };
            }
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
         * Map (x,y) coordinates in canvas space to window space.
         * 
         * @private
         * @param {number} x Offset from the left canvas edge
         * @param {number} y Offset from the top canvas edge
         * @return {{x: number, y: number}} A point that describes the offset
         *  from the top-left corner of the window.
         */
        transformCanvasToWindow: function (x, y) {
            if (!this._inverseTransformMatrix) {
                return {
                    x: 0,
                    y: 0
                };
            }
            var transform = this._inverseTransformMatrix,
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
         * Inverts the given affine transformation matrix
         *
         * @private
         * @param  {Array.<number>} matrix
         * @return {Array.<number>} Inverted matrix
         */
        _inverseOf: function (matrix) {
            var xx = matrix[0],
                yx = matrix[1],
                xy = matrix[2],
                yy = matrix[3],
                x0 = matrix[4],
                y0 = matrix[5],

                det = xx * yy - xy * yx;

            if (!det) {
                log.warn("Window to canvas matrix not invertable.");
                return null;
            }

            det = 1.0 / det;

            return [
                yy * det,
                -yx * det,
                -xy * det,
                xx * det,
                (xy * y0 - yy * x0) * det,
                (yx * x0 - xx * y0) * det
            ];
        },

        /**
         * Set the current transform from a transformation object.
         * 
         * @private
         * @param {{xx: number, yx: number, xy: number, yy: number, tx: number, ty: number}} transformObj
         */
        _setTransformObject: function (transformObj) {
            if (transformObj) {
                this._transformMatrix = [
                    transformObj.xx,
                    transformObj.yx,
                    transformObj.xy,
                    transformObj.yy,
                    transformObj.tx,
                    transformObj.ty
                ];
                this._inverseTransformMatrix = this._inverseOf(this._transformMatrix);
            } else {
                this._transformMatrix = null;
                this._inverseTransformMatrix = null;
            }
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
            this._inverseTransformMatrix = this._inverseOf(transformMatrix);
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

            this._zoom = payload.zoom;
        }
    });

    module.exports = UIStore;
});
