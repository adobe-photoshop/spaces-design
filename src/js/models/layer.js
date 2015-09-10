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
     * Possible smart object types for a layer
     *
     * @type {number}
     */
    var smartObjectTypes = Object.defineProperties({}, {
        EMBEDDED: {
            writeable: false,
            enumerable: true,
            value: 0
        },
        LOCAL_LINKED: {
            writeable: false,
            enumerable: true,
            value: 1
        },
        CLOUD_LINKED: {
            writeable: false,
            enumerable: true,
            value: 2
        }
    });

    /**
     * A model of Photoshop layer.
     *
     * @constructor
     */
    var Layer = Immutable.Record({
        /**
         * The ID of this layer's document
         * @type {number}
         */
        documentID: null,

        /**
         * Id of layer
         * @type {number}
         */
        id: null,

        /**
         * A unique key for the layer.
         * @param {string}
         */
        key: null,

        /**
         * Layer name
         * @type {string}
         */
        name: null,

        /**
         * True if layer is visible
         * @type {boolean}
         */
        visible: null,

        /**
         * True if layer is locked
         * @type {boolean}
         */
        locked: null,

        /**
         * True if layer is selected
         * @type {boolean}
         */
        selected: null,

        /**
         * Layer Kind
         * @type {number}
         */
        kind: null,

        /**
         * Indicates whether this group layer is expanded or collapsed.
         * @type {boolean}
         */
        expanded: false,

        /**
         * Bounding rectangle for this layer
         * @type {Bounds}
         */
        bounds: null,

        /**
         * True if this layer is a background layer
         * @type {boolean}
         */
        isBackground: null,

        /**
         * Layer opacity as a percentage in [0,100];
         * @type {number}
         */
        opacity: null,

        /**
         * Blend mode ID.
         * @type {string}
         */
        blendMode: "normal",

        /**
         * stroke information
         * @type {Stroke}
         */
        stroke: null,

        /**
         * Border radii
         * @type {?Radii}
         */
        radii: null,

        /**
         * @type {Fill}
         */
        fill: null,

        /**
         * @type {Immutable.List.<Shadow>}
         */
        dropShadows: Immutable.List(),

        /**
         * @type {Immutable.List.<Shadow>}
         */
        innerShadows: Immutable.List(),

        /**
         * @type {text}
         */
        text: null,

        /**
         * @type {object}
         */
        layerKinds: layerLib.layerKinds,

        /**
         * @type {object}
         */
        smartObjectTypes: smartObjectTypes,

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
         * If layer is a smart object, contains the smart object information
         *
         * @type {object}
         */
        smartObject: null,

        /**
         * Indicates whether the layer used to have layer effect or not. If yes, the layer will have
         * a hidden layer effect that makes the extended property descriptor works, even if the layer
         * may not have any existing layer effect.
         *
         * @type {boolean}
         */
        usedToHaveLayerEffect: false,

        /**
         * @type {boolean}
         */
        vectorMaskEnabled: false,

        /**
         * Should this layer be included in the "export all" process?
         * @type {boolean}
         */
        exportEnabled: false
    });

    Layer.layerKinds = layerLib.layerKinds;

    Layer.smartObjectTypes = smartObjectTypes;

    /**
     * Array of available layer effect types
     *
     * @type {Set.<string>}
     */
    Layer.layerEffectTypes = new Set(["dropShadow", "innerShadow"]);

    Object.defineProperties(Layer.prototype, object.cachedGetSpecs({
        /**
         * Indicates whether there are features in the layer
         *  that are currently unsupported.
         * @type {boolean}
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
        face: function () {
            return new Immutable.Map({
                id: this.id,
                name: this.name,
                kind: this.kind,
                visible: this.visible,
                locked: this.locked,
                expanded: this.expanded,
                selected: this.selected,
                isArtboard: this.isArtboard,
                isBackground: this.isBackground,
                isLinked: this.isLinked
            });
        },
        /**
         * This layer is safe to be super-selected
         * @type {boolean}
         */
        superSelectable: function () {
            return !this.locked &&
                this.kind !== this.layerKinds.ADJUSTMENT &&
                this.kind !== this.layerKinds.GROUPEND;
        }
    }));

    /**
     * Retrieve the list of layer effects based on the provided type
     * This currently assumes a simple "pluralization" rule
     *
     * @param {string} layerEffectType
     * @return {Immutable.List<Layer>}
     */
    Layer.prototype.getLayerEffectsByType = function (layerEffectType) {
        return this[layerEffectType + "s"];
    };

    /**
     * Set the given layerEffect deeply within the layer based on type and index
     *
     * @param {string} layerEffectType eg "dropShadow"
     * @param {number} layerEffectIndex
     * @param {object} layerEffect instance of a layer effect such as a Shadow
     */
    Layer.prototype.setLayerEffectByType = function (layerEffectType, layerEffectIndex, layerEffect) {
        return this.setIn([layerEffectType + "s", layerEffectIndex], layerEffect);
    };

    /**
     * Set replace the layerEffects within the layer
     *
     * @param {string} layerEffectType eg "dropShadow"
     * @param {Immutable.List<Object>} layerEffects list of layer effects
     */
    Layer.prototype.setLayerEffectsByType = function (layerEffectType, layerEffects) {
        return this.set(layerEffectType + "s", layerEffects);
    };

    /**
     * Static method to generate the appropriate LayerEffect based on a provided type
     *
     * @param {string} layerEffectType
     * @return {Shadow}  instance of a layer effect such as a Shadow
     */
    Layer.newLayerEffectByType = function (layerEffectType) {
        if (layerEffectType === "dropShadow" || layerEffectType === "innerShadow") {
            return new Shadow();
        } else {
            throw new Error("Can not generate layer effect model for unknown type: %s", layerEffectType);
        }
    };

    /**
     * Determine if the given layer is locked in any way.
     *
     * @param {object} layerDescriptor
     * @return {boolean}
     */
    var _extractLocked = function (layerDescriptor) {
        var value = layerDescriptor.layerLocking;

        return value.protectAll ||
            value.protectComposite ||
            value.protectPosition ||
            value.protectTransparency;
    };

    /**
     * Determine whether the given layer is expanded or collapsed.
     * 
     * @param {object} layerDescriptor
     * @return {boolean}
     */
    var _extractExpanded = function (layerDescriptor) {
        return !layerDescriptor.hasOwnProperty("layerSectionExpanded") ||
            layerDescriptor.layerSectionExpanded;
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
     * Determine the blend mode from the layer descriptor.
     *
     * @param {object} layerDescriptor
     * @return {string}
     */
    var _extractBlendMode = function (layerDescriptor) {
        return object.getPath(layerDescriptor, "mode._value");
    };

    /**
     * Determine whether the layer descriptor describes a linked object.
     *
     * @param {object} layerDescriptor
     * @return {boolean}
     */
    var _extractIsLinked = function (layerDescriptor) {
        return !!object.getPath(layerDescriptor, "smartObject.linked");
    };

    /**
     * Determine whether the layer descriptor describes layer effects.
     *
     * @param {object} layerDescriptor
     * @return {boolean}
     */
    var _extractHasLayerEffect = function (layerDescriptor) {
        return !!object.getPath(layerDescriptor, "layerEffects");
    };

    /**
     * Construct a Layer model from information Photoshop gives after grouping layers
     *
     * @param {number} documentID
     * @param {number} layerID
     * @param {string} layerName Name of the group, provided by Photoshop
     * @param {boolean} isGroupEnd If the layer is the groupEnd layer or the group start layer
     * @param {boolean=} isArtboard
     * @param {object=} boundsDescriptor If isArtboard, boundsDescriptor is required
     *
     * @return {Layer}
     */
    Layer.fromGroupDescriptor = function (documentID, layerID, layerName, isGroupEnd,
        isArtboard, boundsDescriptor) {
        return new Layer({
            id: layerID,
            key: documentID + "." + layerID,
            name: isGroupEnd ? "</Layer Group>" : layerName,
            kind: isGroupEnd ? layerLib.layerKinds.GROUPEND : layerLib.layerKinds.GROUP,
            visible: true,
            locked: false,
            expanded: true,
            isBackground: false,
            opacity: 100,
            selected: true, // We'll set selected after moving layers
            fill: null,
            stroke: null,
            dropShadows: Immutable.List(),
            innerShadows: Immutable.List(),
            mode: "passThrough",
            proportionalScaling: false,
            isArtboard: !!isArtboard,
            bounds: isArtboard ? new Bounds(boundsDescriptor) : null,
            isLinked: false,
            vectorMaskEnabled: false
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
            resolution = object.getPath(document, "resolution._value");
        }

        var model = {
            documentID: documentID,
            id: id,
            key: documentID + "." + id,
            name: layerDescriptor.name,
            kind: layerDescriptor.layerKind,
            visible: layerDescriptor.visible,
            expanded: _extractExpanded(layerDescriptor),
            locked: _extractLocked(layerDescriptor),
            isBackground: layerDescriptor.background,
            opacity: _extractOpacity(layerDescriptor),
            selected: selected,
            bounds: Bounds.fromLayerDescriptor(layerDescriptor),
            radii: Radii.fromLayerDescriptor(layerDescriptor),
            stroke: Stroke.fromLayerDescriptor(layerDescriptor),
            fill: Fill.fromLayerDescriptor(layerDescriptor),
            dropShadows: Shadow.fromLayerDescriptor(layerDescriptor, "dropShadow"),
            innerShadows: Shadow.fromLayerDescriptor(layerDescriptor, "innerShadow"),
            text: Text.fromLayerDescriptor(resolution, layerDescriptor),
            proportionalScaling: layerDescriptor.proportionalScaling,
            isArtboard: layerDescriptor.artboardEnabled,
            vectorMaskEnabled: layerDescriptor.vectorMaskEnabled,
            exportEnabled: layerDescriptor.exportEnabled,
            isLinked: _extractIsLinked(layerDescriptor)
        };

        object.assignIf(model, "blendMode", _extractBlendMode(layerDescriptor));
        object.assignIf(model, "usedToHaveLayerEffect", _extractHasLayerEffect(layerDescriptor));
        object.assignIf(model, "smartObject", layerDescriptor.smartObject);
        
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
                expanded: _extractExpanded(layerDescriptor),
                isBackground: layerDescriptor.background,
                opacity: _extractOpacity(layerDescriptor),
                bounds: Bounds.fromLayerDescriptor(layerDescriptor),
                radii: Radii.fromLayerDescriptor(layerDescriptor),
                stroke: Stroke.fromLayerDescriptor(layerDescriptor),
                fill: Fill.fromLayerDescriptor(layerDescriptor),
                dropShadows: Shadow.fromLayerDescriptor(layerDescriptor, "dropShadow"),
                innerShadows: Shadow.fromLayerDescriptor(layerDescriptor, "innerShadow"),
                text: Text.fromLayerDescriptor(resolution, layerDescriptor),
                proportionalScaling: layerDescriptor.proportionalScaling,
                isArtboard: layerDescriptor.artboardEnabled,
                vectorMaskEnabled: layerDescriptor.vectorMaskEnabled,
                exportEnabled: layerDescriptor.exportEnabled,
                isLinked: _extractIsLinked(layerDescriptor)
            };

        object.assignIf(model, "blendMode", _extractBlendMode(layerDescriptor));
        object.assignIf(model, "usedToHaveLayerEffect", _extractHasLayerEffect(layerDescriptor));
        object.assignIf(model, "smartObject", layerDescriptor.smartObject);

        return this.merge(model);
    };
    
    /**
     * True if the layer has layer effect.
     * @return {boolean}  
     */
    Layer.prototype.hasLayerEffect = function () {
        return !this.innerShadows.isEmpty() || !this.dropShadows.isEmpty();
    };

    /**
     * True if the layer is text layer.
     * @return {boolean}  
     */
    Layer.prototype.isTextLayer = function () {
        return this.kind === this.layerKinds.TEXT;
    };

    /**
     * True if the layer is a smart object
     * @return {boolean}
     */
    Layer.prototype.isSmartObject = function () {
        return this.kind === this.layerKinds.SMARTOBJECT;
    };
    
    /**
     * True if the layer is a vector
     * @return {boolean}
     */
    Layer.prototype.isVector = function () {
        return this.kind === this.layerKinds.VECTOR;
    };

    /**
     * Returns the smart object type for smart object layers, null otherwise
     *
     * @return {?SmartObjectType}
     */
    Layer.prototype.smartObjectType = function () {
        if (!this.isSmartObject()) {
            return null;
        }

        if (!this.smartObject.linked) {
            return smartObjectTypes.EMBEDDED;
        } else if (this.smartObject.link._obj === "ccLibrariesElement") {
            return smartObjectTypes.CLOUD_LINKED;
        } else {
            return smartObjectTypes.LOCAL_LINKED;
        }
    };
    
    /**
     * Return true if the layer is a smart object that links to a CC Libiraries element.
     * 
     * @return {boolean}
     */
    Layer.prototype.isCloudLinkedSmartObject = function () {
        return this.smartObjectType() === smartObjectTypes.CLOUD_LINKED;
    };
    
    /**
     * Return the reference of the layer's linked CC Libraries element. 
     * 
     * @return {?string}
     */
    Layer.prototype.getLibraryElementReference = function () {
        return this.isCloudLinkedSmartObject() ? this.smartObject.link.elementReference : null;
    };

    module.exports = Layer;
});
