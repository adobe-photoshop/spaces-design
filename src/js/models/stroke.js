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

    var _ = require("lodash"),
        unit = require("../util/unit");

    /**
     * Model for a Photoshop layer stroke
     *
     * TEMP Note: much of this logic traces back to the prototype: styleFunctions.js and mixedState.js
     * 
     * @constructor
     * @param {Layer} descriptor Photoshop's AGMStrokeStyleInfo portion of the layer desccriptor
     */
    var Stroke = function (descriptor) {
        if (descriptor && _.has(descriptor, "AGMStrokeStyleInfo") && _.has(descriptor.AGMStrokeStyleInfo, "value")) {
            // pull out the root of the style info
            var styleInfoValue = descriptor.AGMStrokeStyleInfo.value;

            // TODO this "exists" property may be a relic of designshop
            this._exists = true;

            this._enabled = styleInfoValue.strokeEnabled;

            if (_.has(styleInfoValue, "strokeStyleContent") &&
                _.has(styleInfoValue.strokeStyleContent, "value") &&
                _.has(styleInfoValue.strokeStyleContent.value, "color")) {
                this._color = styleInfoValue.strokeStyleContent.value.color.value;
            }
            
            if (_.has(styleInfoValue, "strokeStyleLineWidth") &&
                _.has(styleInfoValue, "strokeStyleResolution")) {
                this._width = unit.toPixels(
                    styleInfoValue.strokeStyleLineWidth,
                    styleInfoValue.strokeStyleResolution
                );
            }
        }
    };

    Object.defineProperties(Stroke.prototype, {
        "id": {
            get: function () { return this._id; }
        },
        "name": {
            get: function () { return this._name; }
        },
        "exists": {
            get: function () { return this._exists; }
        },
        "enabled": {
            get: function () { return this._enabled; }
        },
        "color": {
            get: function () { return this._color; }
        },
        "width": {
            get: function () { return this._width; }
        }
    });

    /**
     * @type {number} Id of layer
     */
    Stroke.prototype._id = null;

    /**
     * @type {string} Layer name
     */
    Stroke.prototype._name = null;

    /**
     * @type {boolean} True if stroke exists
     */
    Stroke.prototype._exists = null;

    /**
     * @type {boolean} True if stroke is enabled
     */
    Stroke.prototype._enabled = null;

    /**
     * @type {boolean} color value of the stroke FIXME what kind?
     */
    Stroke.prototype._color = null;

    /**
     * @type {boolean} width value of the stroke
     */
    Stroke.prototype._width = null;

    /**
     * Get the list of (strict) ancestors of this layer.
     *
     * @return {Array.<Layer>} The ancestors of this layer.
     */
    Stroke.prototype.getAncestors = function () {
        var ancestors;

        if (this._parent) {
            ancestors = this._parent.getAncestors();
            ancestors.push(this._parent);
        } else {
            ancestors = [];
        }

        return ancestors;
    };

    module.exports = Stroke;
});
