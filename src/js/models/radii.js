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

    var unit = require("js/util/unit"),
        object = require("js/util/object"),
        contentLib = require("adapter/lib/contentLayer");

    /**
     * Model for a bounds rectangle, we extract it from the layer descriptor
     * for the bounds without effects
     * 
     * @constructor
     * @param {object} descriptor Photoshop's data on the layer
     */
    var Radii = function (descriptor) {
        if (descriptor.hasOwnProperty("topLeft")) {
            this._topLeft = descriptor.topLeft;
            this._topRight = descriptor.topRight;
            this._bottomRight = descriptor.bottomRight;
            this._bottomLeft = descriptor.bottomLeft;
        } else if (descriptor.keyOriginType && descriptor.keyOriginType.length > 0) {
            var value = descriptor.keyOriginType[0].value,
                type = value.keyOriginType;

            if (type === contentLib.originTypes.ORIGIN_RECT) { // rect
                this._topLeft = 0;
                this._topRight = 0;
                this._bottomRight = 0;
                this._bottomLeft = 0;
            } else if (type === contentLib.originTypes.ORIGIN_ROUNDED_RECT) { // rounded rect
                var radii = value.keyOriginRRectRadii.value,
                    resolution = object.getPath(descriptor, "AGMStrokeStyleInfo.value.strokeStyleResolution");

                if (resolution === undefined) {
                    resolution = 300;
                }

                this._topLeft = unit.toPixels(radii.topLeft, resolution);
                this._topRight = unit.toPixels(radii.topRight, resolution);
                this._bottomRight = unit.toPixels(radii.bottomRight, resolution);
                this._bottomLeft = unit.toPixels(radii.bottomLeft, resolution);
            } else {
                throw new Error("Invalid origin type: " + type);
            }
        } else {
            throw new Error("No origin type");
        }
    };

    Object.defineProperties(Radii.prototype, {
        "topLeft": {
            get: function () { return this._topLeft; },
            enumerable: true
        },
        "topRight": {
            get: function () { return this._topRight; },
            enumerable: true
        },
        "bottomRight": {
            get: function () { return this._bottomRight; },
            enumerable: true
        },
        "bottomLeft": {
            get: function () { return this._bottomLeft; },
            enumerable: true
        }
    });

    /**
     * @type {number} Radius of the top-left border
     */
    Radii.prototype._topLeft = null;

    /**
     * @type {number} Radius of the top-right border
     */
    Radii.prototype._topRight = null;

    /**
     * @type {number} Radius of the bottom-right border
     */
    Radii.prototype._bottomRight = null;

    /**
     * @type {number} Radius of the bottom-left border
     */
    Radii.prototype._bottomLeft = null;

    /**
     * Convert the set of border radii to a single scalar, or null of the radii
     * are disequal.
     *
     * @return {?number}
     */
    Radii.prototype.scalar = function () {
        if (this._topLeft === this._topRight &&
            this._topRight === this._bottomRight &&
            this._bottomRight === this._bottomLeft) {
            return this._topLeft;
        } else {
            return null;
        }
    };

    /**
     * Determines whether the given layer descriptor describes border radii.
     * 
     * @param {object} descriptor
     */
    Radii.hasRadii = function (descriptor) {
        if (descriptor.keyOriginType && descriptor.keyOriginType.length > 0) {
            var type = descriptor.keyOriginType[0].value.keyOriginType;

            switch (type) {
            case contentLib.originTypes.ORIGIN_RECT:
            case contentLib.originTypes.ORIGIN_ROUNDED_RECT:
                return true;
            }
        }

        return false;
    };
    
    module.exports = Radii;
});
