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

    var layerLib = require("adapter/lib/layer");

    /**
     * Model for a Photoshop layer (sheet).
     * TODO: Implement subclasses for different layer types
     * 
     * @constructor
     * @param {object} descriptor Photoshop's data on the layer
     */
    var Layer = function (descriptor) {
        // TODO: Handled properties for sub classes?!
        var property;

        for (property in descriptor) {
            if (descriptor.hasOwnProperty(property)) {
                switch (property) {
                    case "layerID":
                        this._id = descriptor.layerID;
                        break;
                    case "name":
                        this._name = descriptor.name;
                        break;
                    case "visible":
                        this._visible = descriptor.visible;
                        break;
                    case "layerLocking":
                        // TODO: May expand later
                        this._locked = descriptor.layerLocking.value.protectAll;
                        break;
                    case "layerKind":
                        this._kind = descriptor.layerKind;
                        break;
                    case "itemIndex":
                        this._index = descriptor.itemIndex;
                        break;
                    case "background":
                        this._isBackground = descriptor.background;
                        break;
                    case "opacity":
                        this._opacity = Math.round((descriptor.opacity / 255) * 100);
                        break;
                    //Ignore the rest for now but we need to handle
                    // Blend Mode
                    // Opacity
                    // FX related things
                    // Bounds - Handled in models/bounds.js
                }
            }
        }
    };

    Object.defineProperties(Layer.prototype, {
        "id": {
            get: function () { return this._id; }
        },
        "name": {
            get: function () { return this._name; }
        },
        "visible": {
            get: function () { return this._visible; }
        },
        "locked": {
            get: function () { return this._locked; }
        },
        "selected": {
            get: function () { return this._selected; }
        },
        "kind": {
            get: function () { return this._kind; }
        },
        "children": {
            get: function () { return this._children; }
        },
        "parent": {
            get: function () { return this._parent; }
        },
        "layerKinds": {
            get: function () { return layerLib.layerKinds; }
        },
        "index": {
            get: function () { return this._index; }
        },
        "bounds": {
            get: function () { return this._bounds; }
        },
        "isBackground": {
            get: function () { return this._isBackground; }
        },
        "opacity": {
            get: function () { return this._opacity; }
        },
        "strokes": {
            get: function () { return this._strokes; }
        },
        "fills": {
            get: function () { return this._fills; }
        },
        "radii": {
            get: function () { return this._radii; }
        },
        "textStyles": {
            get: function () { return this._textStyles; }
        },
        "dropShadows": {
            get: function () { return this._dropShadows; }
        }
    });

    /**
     * @type {number} Id of layer
     */
    Layer.prototype._id = null;

    /**
     * @type {number} Index of layer in it's owner document
     */
    Layer.prototype._index = null;

    /**
     * @type {string} Layer name
     */
    Layer.prototype._name = null;

    /**
     * @type {boolean} True if layer is visible
     */
    Layer.prototype._visible = null;

    /**
     * @type {boolean} True if layer is locked
     */
    Layer.prototype._locked = null;

    /**
     * @type {boolean} True if layer is selected
     */
    Layer.prototype._selected = null;

    /**
     * @type {number} Layer Kind
     */
    Layer.prototype._kind = null;

    /**
     * @type {Array.<Layer>} Array of this layer's children
     */
    Layer.prototype._children = null;

    /**
     * @type {Layer} Group this layer belongs to
     */
    Layer.prototype._parent = null;

    /**
     * @type {Bounds} Bounding rectangle for this layer
     */
    Layer.prototype._bounds = null;

    /**
     * @type {boolean} True if this layer is a background layer
     */
    Layer.prototype._isBackground = null;

    /**
     * @type {number} The layer's opacity
     */
    Layer.prototype._opacity = null;

    /**
     * @type {Array.<Stroke>} stroke information
     */
    Layer.prototype._strokes = null;

    /**
     * @type {Array.<Fill>} fill information
     */
    Layer.prototype._fills = null;

    /**
     * @type {?Radii} Border radii
     */
    Layer.prototype._radii = null;

    /**
     * @type {Array.<TextStyle>} List of text styles
     */
    Layer.prototype._textStyles = null;

    /**
     * @type {?Array.<DropShadow>} Drop Shadows
     */
    Layer.prototype._dropShadows = null;

    /**
     * Get the list of (strict) ancestors of this layer.
     *
     * @return {Array.<Layer>} The ancestors of this layer.
     */
    Layer.prototype.getAncestors = function () {
        var ancestors;

        if (this._parent) {
            ancestors = this._parent.getAncestors();
            ancestors.push(this._parent);
        } else {
            ancestors = [];
        }

        return ancestors;
    };

    /**
     * Indicates whether this layer or one of its ancestors is locked.
     * 
     * @return {boolean}
     */
    Layer.prototype.isAncestorLocked = function () {
        return this.locked || (this.parent && this.parent.isAncestorLocked());
    };

    module.exports = Layer;
});
