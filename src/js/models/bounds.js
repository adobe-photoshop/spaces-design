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

    var Immutable = require("immutable");

    var layerLib = require("adapter/lib/layer"),
        objUtil = require("js/util/object");

    /**
     * Model document bounds or layer bounds without effects.
     * 
     * @constructor
     * @param {object} model
     */
    var Bounds = Immutable.Record({
        /**
         * @type {number}
         */
        top: null,

        /**
         * @type {number}
         */
        bottom: null,

        /**
         * @type {number}
         */
        left: null,

        /**
         * @type {number}
         */
        right: null
    });

    Object.defineProperties(Bounds.prototype, objUtil.cachedGetSpecs({
        /**
         * Width of the bounding box.
         * @type {number}
         */
        "width": function () {
            return this.right - this.left;
        },
        /**
         * Height of the bounding box.
         * @type {number}
         */
        "height": function () {
            return this.bottom - this.top;
        },
        /**
         * Horizontal center of the bounding box.
         * @type {number}
         */
        "xCenter": function () {
            return this.left + (this.width / 2);
        },
        /**
         * Vertical center of the bounding box.
         * @type {number}
         */
        "yCenter": function () {
            return this.top + (this.height / 2);
        }
    }));

    /**
     * Create a new Bounds object from the given document descriptor.
     * 
     * @param {object} descriptor Photoshop document descriptor
     * @return {Bounds}
     */
    Bounds.fromDocumentDescriptor = function (descriptor) {
        var resolution = descriptor.resolution.value,
            multiplier = resolution / 72,
            model = {};

        var height = descriptor.height.value * multiplier,
            width = descriptor.width.value * multiplier;

        model.top = 0;
        model.left = 0;
        model.bottom = height;
        model.right = width;

        return new Bounds(model);
    };

    /**
     * Create a new Bounds object from the given layer descriptor.
     * 
     * @param {object} descriptor Photoshop layer descriptor
     * @return {Bounds}
     */
    Bounds.fromLayerDescriptor = function (descriptor) {
        // Photoshop's group bounds are not useful, so ignore them.
        switch (descriptor.layerKind) {
        case layerLib.layerKinds.GROUP:
        case layerLib.layerKinds.GROUPEND:
            return null;
        }

        var boundsObject = descriptor.boundsNoEffects.value,
            model = {};

        model.top = boundsObject.top.value;
        model.left = boundsObject.left.value;
        model.bottom = boundsObject.bottom.value;
        model.right = boundsObject.right.value;

        return new Bounds(model);
    };

    /**
     * Create a new bounds object from the union of the given bounds objects.
     * Returns null if no bounds objects are supplied.
     * 
     * @param {Array.<Bounds>} childBounds
     * @return {?Bounds}
     */
    Bounds.union = function (childBounds) {
        if (childBounds.isEmpty()) {
            return null;
        }

        var startBounds = childBounds.first(),
            nextBounds = startBounds.withMutations(function (model) {
                childBounds.rest().forEach(function (child) {
                    model.top = Math.min(model.top, child.top);
                    model.left = Math.min(model.left, child.left);
                    model.bottom = Math.max(model.bottom, child.bottom);
                    model.right = Math.max(model.right, child.right);
                });
            });

        return nextBounds;
    };

    /**
     * Indicates whether the given point is contained in the bounding box.
     *
     * @param {number} x
     * @param {number} y
     * @return {boolean}
     */
    Bounds.prototype.contains = function (x, y) {
        return this.top <= y && y <= this.bottom &&
            this.left <= x && x <= this.right;
    };

    /**
     * Clones this bounds object with an updated position.
     *
     * @protected
     * @param {number=} x New X position
     * @param {number=} y New Y position
     * @return {Bounds} The updated bounds object
     */
    Bounds.prototype.updatePosition = function (x, y) {
        var width = this.width,
            height = this.height;

        return this.withMutations(function (model) {
            if (typeof x === "number") {
                model.left = x;
                model.right = x + width;
            }

            if (typeof y === "number") {
                model.top = y;
                model.bottom = y + height;
            }
        });
    };

    /**
     * Clones this bounds object with an updated size.
     *
     * @protected
     * @param {number=} w New width
     * @param {number=} h New height
     * @return {Bounds} The updated bounds object
     */
    Bounds.prototype.updateSize = function (w, h) {
        return this.withMutations(function (model) {
            if (typeof w === "number") {
                //model.set("width", w);
                model.set("right", model.left + w);
            }

            if (typeof h === "number") {
                //model.set("height", h);
                model.set("bottom", model.top + h);
            }
        });
    };

    module.exports = Bounds;
});
