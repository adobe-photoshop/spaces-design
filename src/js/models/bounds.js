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
        },
        /**
         * Area of the bounding box
         * @type {number}
         */
        "area": function () {
            return this.width * this.height;
        },
        /**
         * Whether the bounds are empty.
         * @type {boolean}
         */
        "empty": function () {
            return this.area === 0;
        }
    }));

    /**
     * Create a new Bounds object from the given document descriptor.
     * 
     * @param {object} descriptor Photoshop document descriptor
     * @return {Bounds}
     */
    Bounds.fromDocumentDescriptor = function (descriptor) {
        var resolution = descriptor.resolution._value,
            multiplier = resolution / 72,
            model = {};

        var height = descriptor.height._value * multiplier,
            width = descriptor.width._value * multiplier;

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
        var boundsObject = this.parseLayerDescriptor(descriptor);
            
        return new Bounds(boundsObject);
    };

    /**
     * Parses given layer descriptor to a constructor usable object
     *
     * @param {object} descriptor
     * @param {number} descriptor.layerKind
     * @param {boolean?} descriptor.artboardEnabled If set, will parse artboard value
     * @param {object?} descriptor.artboard Contains the artboard bounds descriptor
     * @param {object?} descriptor.pathBounds If available, will be parsed as shape layer
     * @param {object?} descriptor.boundsNoEffects Bounds object available for all layers
     *
     * @return {{top: number, left: number, bottom: number, right: number}}
     */
    Bounds.parseLayerDescriptor = function (descriptor) {
        var boundsObject;

        // artboards are also groups. so we handle them separately 
        if (descriptor.artboardEnabled) {
            boundsObject = objUtil.getPath(descriptor, "artboard.artboardRect");
        } else if (descriptor.hasOwnProperty("pathBounds")) {
            boundsObject = objUtil.getPath(descriptor, "pathBounds.pathBounds");
        } else {
            switch (descriptor.layerKind) {
                // Photoshop's group bounds are not useful, so ignore them.
                case layerLib.layerKinds.GROUP:
                case layerLib.layerKinds.GROUPEND:
                    return null;
                case layerLib.layerKinds.TEXT:
                    boundsObject = descriptor.boundingBox;
                    break;
                default:
                    boundsObject = descriptor.boundsNoEffects;
                    break;
            }

            var model = {};

            model.top = boundsObject.top._value;
            model.left = boundsObject.left._value;
            model.bottom = boundsObject.bottom._value;
            model.right = boundsObject.right._value;

            boundsObject = model;
        }

        delete boundsObject._obj;

        return boundsObject;
    };

    /**
     * Updates the bound object with new properties
     *
     * @param {object} descriptor Photoshop layer descriptor
     * @return {Bounds} [description]
     */
    Bounds.prototype.resetFromDescriptor = function (descriptor) {
        var newBoundObject = Bounds.parseLayerDescriptor(descriptor);

        return this.merge(newBoundObject);
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
     * Creates a new bounds object from the intersection of the given bounds objects.
     * Returns null if they don't intersect 
     *
     * @param {Bounds} boundsOne
     * @param {Bounds} boundsTwo
     * @return {Bounds} Intersection of boundsOne and boundsTwo
     */
    Bounds.intersection = function (boundsOne, boundsTwo) {
        if (!boundsOne || !boundsTwo) {
            return null;
        }
        
        var model = {
            top: boundsTwo.top < boundsOne.top ? boundsOne.top : boundsTwo.top,
            left: boundsTwo.left < boundsOne.left ? boundsOne.left : boundsTwo.left,
            bottom: boundsTwo.bottom < boundsOne.bottom ? boundsTwo.bottom : boundsOne.bottom,
            right: boundsTwo.right < boundsOne.right ? boundsTwo.right : boundsOne.right
        };

        if (model.bottom < model.top || model.right < model.left) {
            return null;
        }

        return new Bounds(model);
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
     * If the width or height are negative, will swap the adjacent edges
     *
     * @return {Bounds} Updated bounds object
     */
    Bounds.prototype.normalize = function () {
        var newBounds = {};

        if (this.right < this.left) {
            newBounds.left = this.right;
            newBounds.right = this.left;
        }

        if (this.bottom < this.top) {
            newBounds.top = this.bottom;
            newBounds.bottom = this.top;
        }

        return this.merge(newBounds);
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
            height = this.height,
            newBounds = {};

        if (typeof x === "number") {
            newBounds.left = x;
            newBounds.right = x + width;
        }

        if (typeof y === "number") {
            newBounds.top = y;
            newBounds.bottom = y + height;
        }

        return this.merge(newBounds);
    };

    /**
     * Clones this bounds object with an updated size.
     *
     * @protected
     * @param {number=} w New width
     * @param {number=} h New height
     * @param {boolean=} proportional size change  
     * @return {Bounds} The updated bounds object
     */
    Bounds.prototype.updateSize = function (w, h, proportional) {
        var newBounds = {};

        if (typeof w === "number") {
            var oldWidth = this.width;
            newBounds.right = this.left + w;
            if (proportional) {
                var newHeight = this.height / oldWidth * w;
                newBounds.bottom = this.top + newHeight;
            }
        }

        if (typeof h === "number") {
            var oldHeight = this.height;
            newBounds.bottom = this.top + h;
            if (proportional) {
                var newWidth = this.width / oldHeight * h;
                newBounds.right = this.left + newWidth;
            }
        }

        return this.merge(newBounds);
    };

    /**
     * Clones this bounds object with an updated position and size.
     *
     * @protected
     * @param {number=} x New X position
     * @param {number=} y New Y position
     * @param {number=} width New width
     * @param {number=} height New height
     * @return {Bounds} The updated bounds object
     */
    Bounds.prototype.updateSizeAndPosition = function (x, y, width, height) {
        var model = {};

        if (typeof x === "number") {
            model.left = x;
            if (typeof width === "number") {
                model.right = x + width;
            }
        }

        if (typeof y === "number") {
            model.top = y;
            if (typeof height === "number") {
                model.bottom = y + height;
            }
        }

        return this.merge(model);
    };

    /**
     * Checks to see if these bounds intersects with other bounds
     *
     * @param {Bounds} otherBounds
     * @return {boolean}
     */
    Bounds.prototype.intersects = function (otherBounds) {
        return this.left < otherBounds.right && this.right > otherBounds.left &&
            this.top < otherBounds.bottom && this.bottom > otherBounds.top;
    };

    module.exports = Bounds;
});
