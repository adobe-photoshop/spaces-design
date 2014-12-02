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

    /**
     * Model for a bounds rectangle, we extract it from the layer descriptor
     * for the bounds without effects
     * 
     * @constructor
     * @param {object} descriptor Photoshop's data on the layer
     */
    var Bounds = function (descriptor) {
        if (descriptor instanceof Bounds) {
            this._top = descriptor.top;
            this._bottom = descriptor.bottom;
            this._left = descriptor.left;
            this._right = descriptor.right;
            this._width = descriptor.width;
            this._height = descriptor.height;
            this._resolution = descriptor.resolution;
        } else if (descriptor.hasOwnProperty("documentID")) {
            var resolution = descriptor.resolution.value,
                multiplier = resolution / 72;

            this._height = descriptor.height.value * multiplier;
            this._width = descriptor.width.value * multiplier;
            this._resolution = multiplier;

            this._top = 0;
            this._left = 0;
            this._bottom = this._height;
            this._right = this._width;
        } else if (descriptor.hasOwnProperty("layerID")) {
            var boundsObject = descriptor.boundsNoEffects.value;

            this._top = boundsObject.top.value;
            this._left = boundsObject.left.value;
            this._bottom = boundsObject.bottom.value;
            this._right = boundsObject.right.value;

            this._resolution = 1; // Layers don't carry resolution, document does
            
            if (boundsObject.width) {
                this._width = boundsObject.width.value;
            } else {
                this._width = this._right - this._left;
            }

            if (boundsObject.height) {
                this._height = boundsObject.height.value;
            } else {
                this._height = this._bottom - this._top;
            }
        } else {
            throw new Error("Unknown descriptor passed to bounds constructor");
        }
    };

    Object.defineProperties(Bounds.prototype, {
        "top": {
            get: function () { return this._top; },
            enumerable: true
        },
        "left": {
            get: function () { return this._left; },
            enumerable: true
        },
        "bottom": {
            get: function () { return this._bottom; },
            enumerable: true
        },
        "right": {
            get: function () { return this._right; },
            enumerable: true
        },
        "width": {
            get: function () { return this._width; },
            enumerable: true
        },
        "height": {
            get: function () { return this._height; },
            enumerable: true
        },
        "resolution": {
            get: function () { return this._resolution; },
            enumerable: true
        }
    });

    /**
     * @type {number} Y coordinate of the top of the bounds rectangle
     */
    Bounds.prototype._top = null;

    /**
     * @type {number} X coordinate of the left of the bounds rectangle
     */
    Bounds.prototype._left = null;

    /**
     * @type {number} Y coordinate of the bottom of the bounds rectangle
     */
    Bounds.prototype._bottom = null;

    /**
     * @type {number} X coordinate of the right of the bounds rectangle
     */
    Bounds.prototype._right = null;

    /**
     * @type {number} Width of the bounds rectangle
     */
    Bounds.prototype._width = null;

    /**
     * @type {number} Height of the bounds rectangle
     */
    Bounds.prototype._height = null;

    Bounds.prototype._resolution = null;

    /**
     * Updates the bounds with new position
     * @protected
     *
     * @param {number} x New X position
     * @param {number} y New Y position
     * @return {Bounds} The updated bounds object
     */
    Bounds.prototype._setPosition = function (x, y) {
        if (typeof x === "number") {
            this._left = x;
            this._right = x + this._width;
        }

        if (typeof y === "number") {
            this._top = y;
            this._bottom = y + this._height;
        }

        return this;
    };

    /**
     * Updates the bounds with new size
     * @protected
     *
     * @param {number} w New width
     * @param {number} h New height
     * @return {Bounds} The updated bounds object
     */
    Bounds.prototype._setSize = function (w, h) {
        if (typeof w === "number") {
            this._width = w;
        }

        if (typeof h === "number") {
            this._height = h;
        }
        
        return this;
    };

    
    module.exports = Bounds;
});
