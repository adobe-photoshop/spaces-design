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

define(function (require, exports) {
    "use strict";

    var descriptor = require("adapter/ps/descriptor"),
        hitTestLib = require("adapter/lib/hitTest"),
        locks = require("js/locks"),
        layerActions = require("./layers");

    /**
     * Asynchronously map (x,y) coordinates in window space to canvas space.
     * 
     * @private
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise.<Array.<number>>} A two-dimensional vector that describes
     *  the offset from the top-left corner of the canvas.
     */
    var _windowToCanvas = function (x, y) {
        // TODO: Ideally we would cache the window transform in a store and
        // only update it when the window is resized or the canvas is panned
        // or zoomed.
        return descriptor.get("transform")
            .get("toWindow")
            .then(function (mat2d) {
                // Despite the misleading property name, this array appears to
                // encode an affine transformation from the window coordinate
                // space to the document canvas cooridinate space. The format
                // of this array is described here:
                // http://cairographics.org/manual/cairo-cairo-matrix-t.html
                var xx = mat2d[0],
                    yx = mat2d[1],
                    xy = mat2d[2],
                    yy = mat2d[3],
                    x0 = mat2d[4],
                    y0 = mat2d[5];

                var xt = xx * x + xy * y + x0,
                    yt = yx * x + yy * y + y0;

                return [xt, yt];
            });
    };
    
    /**
     * Process a single click from the SuperSelect tool. First determines a set of
     * layers to select, then transfers control to actions.layers.select or
     * actions.layers.deselect.
     * 
     * @private
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise}
     */
    var clickCommand = function (x, y) {
        return _windowToCanvas(x, y)
            .bind(this)
            .then(function (coords) {
                var obj = hitTestLib.layerIDsAtPoint(coords[0], coords[1]);
                return descriptor.playObject(obj);
            })
            .get("layersHit")
            .catch(function () {
                return [];
            })
            .then(function (layerIDs) {
                var applicationStore = this.flux.store("application"),
                    doc = applicationStore.getCurrentDocument();

                if (layerIDs.length > 0) {
                    return this.transfer(layerActions.select, doc.id, layerIDs);
                } else {
                    return this.transfer(layerActions.deselectAll, doc.id);
                }
            });
    };

    /**
     * SuperSelect click action.
     * @type {Action}
     */
    var clickAction = {
        command: clickCommand,
        writes: locks.ALL_LOCKS
    };

    exports.click = clickAction;
});
