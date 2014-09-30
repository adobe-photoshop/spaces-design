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

    var LayerTypes = Object.defineProperties({}, {
        "ANY": {
            writeable: false,
            enumerable: true,
            value:  0
        },
        PIXEL: {
            writeable: false,
            enumerable: true,
            value:  1
        },
        ADJUSTMENT: {
            writeable: false,
            enumerable: true,
            value:  2
        },
        TEXT: {
            writeable: false,
            enumerable: true,
            value:  3
        },
        VECTOR: {
            writeable: false,
            enumerable: true,
            value:  4
        },
        SMARTOBJECT: {
            writeable: false,
            enumerable: true,
            value:  5
        },
        VIDEO: {
            writeable: false,
            enumerable: true,
            value:  6
        },
        GROUP: {
            writeable: false,
            enumerable: true,
            value:  7
        },
        "3D": {
            writeable: false,
            enumerable: true,
            value:  8
        },
        GRADIENT: {
            writeable: false,
            enumerable: true,
            value:  9
        },
        PATTERN: {
            writeable: false,
            enumerable: true,
            value:  10
        },
        SOLIDCOLOR: {
            writeable: false,
            enumerable: true,
            value:  11
        },
        BACKGROUND: {
            writeable: false,
            enumerable: true,
            value:  12
        },
        GROUPEND: {
            writeable: false,
            enumerable: true,
            value:  13
        }
    });

    //TODO: Implement subclasses for different layer types
    /**
     * Model for a Photoshop layer (sheet)
     * 
     * @constructor
     * @param {Document} document Document that owns this layer
     * @param {object} descriptor Photoshop's data on the layer
     */
    var Layer = function (document, descriptor) {
        this._document = document;

        // TODO: Handled proeprties for sub classes?!
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
                        this._type = descriptor.layerKind;
                        break;
                    case "itemIndex":
                        this._index = descriptor.itemIndex;
                        break;
                    //Ignore the rest for now but we need to handle
                    // Blend Mode
                    // Opacity
                    // FX related things
                    // Bounds
                }
            }
        }
    };

    Object.defineProperties(Layer.prototype, {
        "document": {
            get: function () { return this._document; }
        },
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
            get: function () { return LayerTypes; }
        },
        "depth": {
            get: function () { return this._depth; }
        },
        "selected": {
            get: function () { return this._selected; }
        },
        "index": {
            get: function () { return this._index; }
        }
    });

    /**
     * @type {Document} Owner document
     */
    Layer.prototype._document = null;

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
     * @type {boolean} True if this layer is currently selected
     */
    Layer.prototype._selected = null;

    /**
     * @type {boolean} True if layer is visible
     */
    Layer.prototype._visible = null;

    /**
     * @type {boolean} True if layer is locked
     */
    Layer.prototype._locked = null;

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
     * @type {Layer} How deep this layer is in the tree, 0 being root
     */
    Layer.prototype._depth = null;

    module.exports = Layer;
});
