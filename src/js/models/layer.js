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

    var layerLib = require("adapter/lib/layer");

    var object = require("js/util/object"),
        Bounds = require("./bounds"),
        Radii = require("./radii"),
        Stroke = require("./stroke"),
        Fill = require("./fill"),
        Shadow = require("./shadow"),
        Text = require("./text");

    /**
     * A model of Photoshop layer.
     *
     * @constructor
     */
    var Layer = Immutable.Record({
        /**
         * @type {number} Id of layer
         */
        id: null,

        /**
         * @param {string} A unique key for the layer.
         */
        key: null,

        /**
         * @type {string} Layer name
         */
        name: null,

        /**
         * @type {boolean} True if layer is visible
         */
        visible: null,

        /**
         * @type {boolean} True if layer is locked
         */
        locked: null,

        /**
         * @type {boolean} True if layer is selected
         */
        selected: null,

        /**
         * @type {number} Layer Kind
         */
        kind: null,

        /**
         * @type {Bounds} Bounding rectangle for this layer
         */
        bounds: null,

        /**
         * @type {boolean} True if this layer is a background layer
         */
        isBackground: null,

        /**
         * @type {number} Layer opacity as a percentage in [0,100];
         */
        opacity: null,

        /**
         * @type {string} Blend mode ID.
         */
        blendMode: "normal",

        /**
         * @type {Immutable.List.<Stroke>} stroke information
         */
        strokes: null,

        /**
         * @type {?Radii} Border radii
         */
        radii: null,

        /**
         * @type {Immutable.List.<Fill>}
         */
        fills: null,

        /**
         * @type {Immutable.List.<Shadow>}
         */
        dropShadows: null,

        /**
         * @type {Immutable.List.<Shadow>}
         */
        innerShadows: null,

        /**
         * @type {text}
         */
        text: null,

        /**
         * @type {object}
         */
        layerKinds: layerLib.layerKinds,

        /**
         * @type {boolean}
         */
        proportionalScaling: null,

        /**
         *  @type {boolean}
         */
        isArtboard: null,

        /**
         *  @type {boolean}
         */
        isLinked: false,

        /**
         * @type {boolean}
         */
        hasLayerEffect: false
    });

    Layer.layerKinds = layerLib.layerKinds;

    Object.defineProperties(Layer.prototype, object.cachedGetSpecs({
        /**
         * @type {boolean} Indicates whether there are features in the layer
         *  that are currently unsupported.
         */
        unsupported: function () {
            switch (this.kind) {
            case layerLib.layerKinds.VIDEO:
            case layerLib.layerKinds["3D"]:
                return true;
            default:
                return false;
            }
        },
        /**
         * Subset of properties that define the layer face
         * @type {Immutable.Map.<string, *>}
         */
        "face": function () {
            var self = this;
            return new Immutable.Map({
                id: self.id,
                name: self.name,
                visible: self.visible,
                locked: self.locked,
                selected: self.selected,
                kind: self.kind,
                isBackground: self.isBackground
            });
        },
        /**
         * This layer is safe to be super-selected
         * @type {boolean}
         */
        "superSelectable": function () {
            return !this.locked &&
                this.kind !== this.layerKinds.ADJUSTMENT &&
                this.kind !== this.layerKinds.GROUPEND;
        }
    }));

    /**
     * Determine if the given layer is locked in any way.
     * 
     * @param {object} layerDescriptor
     * @return {boolean}
     */
    var _extractLocked = function (layerDescriptor) {
        var value = layerDescriptor.layerLocking.value;
        
        return value.protectAll ||
            value.protectComposite ||
            value.protectPosition ||
            value.protectTransparency;
    };

    /**
     * Determine the layer opacity as a percentage.
     * 
     * @param {object} layerDescriptor
     * @return {number}
     */
    var _extractOpacity = function (layerDescriptor) {
        return Math.round(100 * layerDescriptor.opacity / 255);
    };

    /**
     * Construct a Layer model from information Photoshop gives after grouping layers
     *
     * @param {number} documentID
     * @param {number} layerID
     * @param {string} layerName Name of the group, provided by Photoshop
     * @param {Boolean} isGroupEnd If the layer is the groupEnd layer or the group start layer
     *
     * @return {Layer}
     */
    Layer.fromGroupDescriptor = function (documentID, layerID, layerName, isGroupEnd) {
        return new Layer({
            id: layerID,
            key: documentID + "." + layerID,
            name: isGroupEnd ? "</Layer Group>" : layerName,
            kind: isGroupEnd ? layerLib.layerKinds.GROUPEND : layerLib.layerKinds.GROUP,
            visible: true,
            locked: false,
            isBackground: false,
            opacity: 100,
            selected: true, // We'll set selected after moving layers
            fills: Immutable.List(),
            strokes: Immutable.List(),
            dropShadows: Immutable.List(),
            innerShadows: Immutable.List(),
            mode: "passThrough",
            proportionalScaling: false,
            isArtboard: false,
            isLinked: false,
            hasLayerEffect: false
        });
    };

    /**
     * Construct a Layer model from a Photoshop document and layer descriptor.
     *
     * @param {object|Immutable.Record} document Document descriptor or Document model
     * @param {object} layerDescriptor
     * @param {boolean} selected Whether or not this layer is currently selected
     * @return {Layer}
     */
    Layer.fromDescriptor = function (document, layerDescriptor, selected) {
        var id = layerDescriptor.layerID,
            documentID,
            resolution;

        // handle either style of document param
        if (document instanceof Immutable.Record) {
            documentID = document.id;
            resolution = document.resolution;
        } else {
            documentID = document.documentID;
            resolution = object.getPath(document, "resolution.value");
        }

        var model = {
                id: id,
                key: documentID + "." + id,
                name: layerDescriptor.name,
                kind: layerDescriptor.layerKind,
                visible: layerDescriptor.visible,
                locked: _extractLocked(layerDescriptor),
                isBackground: layerDescriptor.background,
                opacity: _extractOpacity(layerDescriptor),
                selected: selected,
                bounds: Bounds.fromLayerDescriptor(layerDescriptor),
                radii: Radii.fromLayerDescriptor(layerDescriptor),
                strokes: Stroke.fromLayerDescriptor(layerDescriptor),
                fills: Fill.fromLayerDescriptor(layerDescriptor),
                dropShadows: Shadow.fromLayerDescriptor(layerDescriptor, "dropShadow"),
                innerShadows: Shadow.fromLayerDescriptor(layerDescriptor, "innerShadow"),
                text: Text.fromLayerDescriptor(resolution, layerDescriptor),
                proportionalScaling: layerDescriptor.proportionalScaling,
                isArtboard: layerDescriptor.artboardEnabled

            };

        var mode = object.getPath(layerDescriptor, "mode.value");
        if (mode) {
            model.blendMode = mode;
        }

        var linked = object.getPath(layerDescriptor, "smartObject.value.linked");
        if (linked) {
            model.isLinked = linked;
        }
        
        var layerEffectObject = object.getPath(layerDescriptor, "layerEffects");
        if (layerEffectObject) {
            model.hasLayerEffect = true;
        }

        return new Layer(model);
    };

    /**
     * Reset this layer model using the given Photoshop layer descriptor.
     *
     * @param {object} layerDescriptor
     * @param {Document} previousDocument
     * @return {Layer}
     */
    Layer.prototype.resetFromDescriptor = function (layerDescriptor, previousDocument) {
        var resolution = previousDocument.resolution,
            model = {
                name: layerDescriptor.name,
                kind: layerDescriptor.layerKind,
                visible: layerDescriptor.visible,
                locked: _extractLocked(layerDescriptor),
                isBackground: layerDescriptor.background,
                opacity: _extractOpacity(layerDescriptor),
                bounds: Bounds.fromLayerDescriptor(layerDescriptor),
                radii: Radii.fromLayerDescriptor(layerDescriptor),
                strokes: Stroke.fromLayerDescriptor(layerDescriptor),
                fills: Fill.fromLayerDescriptor(layerDescriptor),
                dropShadows: Shadow.fromLayerDescriptor(layerDescriptor, "dropShadow"),
                innerShadows: Shadow.fromLayerDescriptor(layerDescriptor, "innerShadow"),
                text: Text.fromLayerDescriptor(resolution, layerDescriptor),
                proportionalScaling: layerDescriptor.proportionalScaling,
                isArtboard: layerDescriptor.artboardEnabled
            };

        var mode = object.getPath(layerDescriptor, "mode.value");
        if (mode) {
            model.blendMode = mode;
        }

        var linked = object.getPath(layerDescriptor, "smartObject.value.placed.value");
        model.isLinked = (linked === "rasterizeLinked");

        var layerEffectObject = object.getPath(layerDescriptor, "layerEffects");
        if (layerEffectObject) {
            model.hasLayerEffect = true;
        }
        
        return this.merge(model);
    };

    module.exports = Layer;
});
