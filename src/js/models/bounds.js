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
        var boundsObject = descriptor.boundsNoEffects.value;

        this._top = boundsObject.top.value;
        this._top = boundsObject.top.value;
        this._top = boundsObject.top.value;
        this._top = boundsObject.top.value;
        this._top = boundsObject.top.value;
        this._top = boundsObject.top.value;
    };

    Object.defineProperties(Bounds.prototype, {
        "top": {
            get: function () { return this._top; }
        },
        "left": {
            get: function () { return this._left; }
        },
        "bottom": {
            get: function () { return this._bottom; }
        },
        "right": {
            get: function () { return this._right; }
        },
        "width": {
            get: function () { return this._width; }
        },
        "height": {
            get: function () { return this._height; }
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

    

    
    module.exports = Bounds;
});
