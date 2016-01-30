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

    var Immutable = require("immutable"),
        _ = require("lodash");

    var layerLib = require("adapter").lib.layer;

    var object = require("js/util/object"),
        Radii = require("./radii"),
        Stroke = require("./stroke"),
        SmartObject = require("./smartobject"),
        LayerEffect = require("./effects/layereffect"),
        Text = require("./text");

    /**
     * Model for a layer's effects. Except for InnerShadow and DropShadow.
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
         * @type {string}
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
         * Stores layer effects map by types that are defined in LayerEffect.TYPES. 
         * For effect types that the layer does not have, they will assign with an 
         * empty immutable list as default value.
         * 
         * @type {LayerEffectsMap}
         */
        effects: null,

        /**
         * @type {text}
         */
        text: null,

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
         * True if this layer is a background layer
         * @type {boolean}
         */
        isBackground: null,
        
        /**
         * True if this layer is a pixel layer
         * @type {boolean}
         */
        isPixel: false,
        
        /**
         * True if this layer is an adjustment layer
         * @type {boolean}
         */
        isAdjustment: false,
        
        /**
         * True if this layer is a text layer
         * @type {boolean}
         */
        isText: false,
        
        /**
         * True if this layer is a vector layer
         * @type {boolean}
         */
        isVector: false,
        
        /**
         * True if this layer is a smart object
         * @type {boolean}
         */
        isSmartObject: false,
        
        /**
         * True if this layer is a group layer
         * @type {boolean}
         */
        isGroup: false,
        
        /**
         * True if this layer is a group end layer
         * @type {boolean}
         */
        isGroupEnd: false,
        
        /**
         * True if this layer is a 3D layer
         * @type {boolean}
         */
        is3D: false,
        
        /**
         * True if this layer is a video layer
         * @type {boolean}
         */
        isVideo: false,

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
        exportEnabled: false,

        /**
         * Indicates whether or not the lazy properties have yet been loaded
         * into this layer.
         *
         * @type {boolean}
         */
        initialized: false,

        /** 
         * indicates if the vector mask has any path components.
         *
         * @type {boolean}
         */
        vectorMaskEmpty: true,

        /** 
         *indicates if a Font on a text layer is missing with 0 being a non missing font. 
         * 
         * @type {number}
         */
        textWarningLevel: 0
    });
    
    /**
     * List of layer kinds.
     *
     * @const
     * @enum {LayerKind}
     * @typedef {string} LayerKind
     */
    Layer.KINDS = Object.freeze({
        ANY: "ANY",
        PIXEL: "PIXEL",
        ADJUSTMENT: "ADJUSTMENT",
        TEXT: "TEXT",
        VECTOR: "VECTOR",
        SMARTOBJECT: "SMARTOBJECT",
        VIDEO: "VIDEO",
        GROUP: "GROUP",
        GROUPEND: "GROUPEND",
        GRADIENT: "GRADIENT",
        PATTERN: "PATTERN",
        SOLIDCOLOR: "SOLIDCOLOR",
        BACKGROUND: "BACKGROUND",
        "3D": "3D"
    });
    
    /**
     * Used to convert the Adapter's internal layer kind id into names. For example: 1 -> PIXEL
     * 
     * @const
     * @type {Map.<number, LayerKind>}
     */
    Layer.KIND_TO_NAME = Object.freeze(_.zipObject([
       [layerLib.layerKinds.ANY, Layer.KINDS.ANY],
       [layerLib.layerKinds.PIXEL, Layer.KINDS.PIXEL],
       [layerLib.layerKinds.ADJUSTMENT, Layer.KINDS.ADJUSTMENT],
       [layerLib.layerKinds.TEXT, Layer.KINDS.TEXT],
       [layerLib.layerKinds.VECTOR, Layer.KINDS.VECTOR],
       [layerLib.layerKinds.SMARTOBJECT, Layer.KINDS.SMARTOBJECT],
       [layerLib.layerKinds.VIDEO, Layer.KINDS.VIDEO],
       [layerLib.layerKinds.GROUP, Layer.KINDS.GROUP],
       [layerLib.layerKinds.GROUPEND, Layer.KINDS.GROUPEND],
       [layerLib.layerKinds["3D"], Layer.KINDS["3D"]],
       [layerLib.layerKinds.GRADIENT, Layer.KINDS.GRADIENT],
       [layerLib.layerKinds.PATTERN, Layer.KINDS.PATTERN],
       [layerLib.layerKinds.SOLIDCOLOR, Layer.KINDS.SOLIDCOLOR],
       [layerLib.layerKinds.BACKGROUND, Layer.KINDS.BACKGROUND]
    ]));
    
    Layer.smartObjectTypes = smartObjectTypes;

    Object.defineProperties(Layer.prototype, object.cachedGetSpecs({
        /**
         * Indicates whether there are features in the layer
         *  that are currently unsupported.
         * @type {boolean}
         */
        unsupported: function () {
            switch (this.kind) {
            case Layer.KINDS.VIDEO:
            case Layer.KINDS["3D"]:
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
                isLinked: this.isLinked,
                vectorMaskEnabled: this.vectorMaskEnabled,
                vectorMaskEmpty: this.vectorMaskEmpty,
                textWarningLevel: this.textWarningLevel,
                smartObject: this.smartObject
            });
        },

        /**
         * This layer is safe to be super-selected
         * @type {boolean}
         */
        superSelectable: function () {
            return !this.locked && !this.isAdjustment && !this.isGroupEnd;
        },
        
        /**
         * Return all inner shadows.
         * @type {Immutable.List<?Shadow>}
         */
        innerShadows: function () {
            return this.effects.get("innerShadow");
        },
        
        /**
         * Return all drop shadows.
         * @type {Immutable.List<?Shadow>}
         */
        dropShadows: function () {
            return this.effects.get("dropShadow");
        },
        
        /**
         * Return all color overlays.
         * @type {Immutable.List<?ColorOverlay>}
         */
        colorOverlays: function () {
            return this.effects.get("colorOverlay");
        },
        
        /**
         * Return all stroke effects.
         * @type {Immutable.List<?Stroke>}
         */
        strokeEffects: function () {
            return this.effects.get("stroke");
        },
        
        /**
         * True if the layer has layer effect.
         * @type {boolean}  
         */
        hasLayerEffect: function () {
            return !!this.effects.find(function (effects) {
                return !effects.isEmpty();
            });
        },
        
        /**
         * True if the layer has unsupported layer effect.
         * @type {boolean}  
         */
        hasUnsupportedLayerEffect: function () {
            return !!this.effects.find(function (effects, effectType) {
                if (LayerEffect.UNSUPPORTED_TYPES.has(effectType)) {
                    return !effects.isEmpty();
                }
            });
        }
    }));

    /**
     * Retrieve the list of layer effects based on the provided type.
     *
     * @param {string} layerEffectType
     * @return {Immutable.List<Layer>}
     */
    Layer.prototype.getLayerEffectsByType = function (layerEffectType) {
        if (!LayerEffect.TYPES.has(layerEffectType)) {
            throw new Error("Invalid layer effect type: " + layerEffectType);
        }
        
        return this.effects.get(layerEffectType);
    };

    /**
     * Set the given layerEffect deeply within the layer based on type and index
     *
     * @param {string} layerEffectType eg "dropShadow"
     * @param {number} layerEffectIndex
     * @param {object} layerEffect instance of a layer effect such as a Shadow
     */
    Layer.prototype.setLayerEffectByType = function (layerEffectType, layerEffectIndex, layerEffect) {
        if (!LayerEffect.TYPES.has(layerEffectType)) {
            throw new Error("Invalid layer effect type: " + layerEffectType);
        }
        
        var nextEffects = this.effects.setIn([layerEffectType, layerEffectIndex], layerEffect);
        
        return this.set("effects", nextEffects);
    };

    /**
     * Set replace the layerEffects within the layer
     *
     * @param {string} layerEffectType eg "dropShadow"
     * @param {Immutable.List<Object>} layerEffects list of layer effects
     */
    Layer.prototype.setLayerEffectsByType = function (layerEffectType, layerEffects) {
        if (!LayerEffect.TYPES.has(layerEffectType)) {
            throw new Error("Invalid layer effect type: " + layerEffectType);
        }
        
        var nextEffects = this.effects.set(layerEffectType, layerEffects);
        
        return this.set("effects", nextEffects);
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
     * Return the capitalized layer kind name. For example: SMARTOBJECT -> SmartObject
     *
     * @private
     * @param {LayerKind} layerKind
     * @return {string}
     */
    var _capitalizeLayerKindName = function (layerKind) {
        switch (layerKind) {
        case Layer.KINDS.SMARTOBJECT:
            return "SmartObject";
        case Layer.KINDS.GROUPEND:
            return "GroupEnd";
        case Layer.KINDS.SOLIDCOLOR:
            return "SolidColor";
        default:
            return _.capitalize(layerKind.toLowerCase());
        }
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
        var Bounds = require("./bounds"),
            model = {
                id: layerID,
                key: documentID + "." + layerID,
                name: isGroupEnd ? "</Layer Group>" : layerName,
                kind: isGroupEnd ? Layer.KINDS.GROUPEND : Layer.KINDS.GROUP,
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
                effects: LayerEffect.EMPTY_EFFECTS,
                mode: "passThrough",
                proportionalScaling: false,
                isArtboard: !!isArtboard,
                bounds: isArtboard ? new Bounds(boundsDescriptor) : null,
                isLinked: false,
                vectorMaskEnabled: false,
                vectorMaskEmpty: true,
                textWarningLevel: 0,
                initialized: true
            };

        model["is" + _capitalizeLayerKindName(model.kind)] = true;

        return new Layer(model);
    };

    /**
     * Construct a Layer model from a Photoshop document and layer descriptor.
     *
     * @param {object|Immutable.Record} document Document descriptor or Document model
     * @param {object} layerDescriptor
     * @param {boolean} selected Whether or not this layer is currently selected
     * @param {boolean=} initialized
     * @return {Layer}
     */
    Layer.fromDescriptor = function (document, layerDescriptor, selected, initialized) {
        var id = layerDescriptor.layerID,
            artboardEnabled = layerDescriptor.artboardEnabled,
            exportEnabled = artboardEnabled && layerDescriptor.exportEnabled !== false || layerDescriptor.exportEnabled,
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

        var Bounds = require("./bounds"),
            Fill = require("./fill"),
            model = {
                documentID: documentID,
                id: id,
                key: documentID + "." + id,
                name: layerDescriptor.name,
                kind: Layer.KIND_TO_NAME[layerDescriptor.layerKind],
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
                effects: LayerEffect.fromLayerDescriptor(layerDescriptor),
                text: Text.fromLayerDescriptor(resolution, layerDescriptor),
                proportionalScaling: layerDescriptor.proportionalScaling,
                isArtboard: layerDescriptor.artboardEnabled,
                vectorMaskEnabled: layerDescriptor.vectorMaskEnabled,
                exportEnabled: exportEnabled,
                vectorMaskEmpty: layerDescriptor.vectorMaskEmpty,
                textWarningLevel: layerDescriptor.textWarningLevel,
                isLinked: _extractIsLinked(layerDescriptor),
                initialized: initialized || selected
                // if not explicitly marked as initialized, then it is initialized iff it is selected
            };

        model["is" + _capitalizeLayerKindName(model.kind)] = true;

        object.assignIf(model, "blendMode", _extractBlendMode(layerDescriptor));
        object.assignIf(model, "usedToHaveLayerEffect", _extractHasLayerEffect(layerDescriptor));

        if (layerDescriptor.smartObject) {
            model.smartObject = SmartObject.fromDescriptor(layerDescriptor.smartObject);
        }
        
        return new Layer(model);
    };

    /**
     * Reset this layer model using the given Photoshop layer descriptor.
     *
     * @param {object} layerDescriptor
     * @param {Document} previousDocument
     * @param {boolean=} lazy If true, layer will be marked as initialized iff it is selected
     * @return {Layer}
     */
    Layer.prototype.resetFromDescriptor = function (layerDescriptor, previousDocument, lazy) {
        var Bounds = require("./bounds"),
            Fill = require("./fill"),
            resolution = previousDocument.resolution,
            artboardEnabled = layerDescriptor.artboardEnabled,
            exportEnabled = artboardEnabled && layerDescriptor.exportEnabled !== false || layerDescriptor.exportEnabled,
            model = {
                name: layerDescriptor.name,
                kind: Layer.KIND_TO_NAME[layerDescriptor.layerKind],
                visible: layerDescriptor.visible,
                locked: _extractLocked(layerDescriptor),
                expanded: _extractExpanded(layerDescriptor),
                isBackground: layerDescriptor.background,
                opacity: _extractOpacity(layerDescriptor),
                bounds: Bounds.fromLayerDescriptor(layerDescriptor),
                radii: Radii.fromLayerDescriptor(layerDescriptor),
                stroke: Stroke.fromLayerDescriptor(layerDescriptor),
                fill: Fill.fromLayerDescriptor(layerDescriptor),
                effects: LayerEffect.fromLayerDescriptor(layerDescriptor),
                text: Text.fromLayerDescriptor(resolution, layerDescriptor),
                proportionalScaling: layerDescriptor.proportionalScaling,
                isArtboard: layerDescriptor.artboardEnabled,
                vectorMaskEnabled: layerDescriptor.vectorMaskEnabled,
                exportEnabled: exportEnabled,
                vectorMaskEmpty: layerDescriptor.vectorMaskEmpty,
                textWarningLevel: layerDescriptor.textWarningLevel,
                isLinked: _extractIsLinked(layerDescriptor),
                initialized: lazy ? this.selected : true
            };

        object.assignIf(model, "blendMode", _extractBlendMode(layerDescriptor));
        object.assignIf(model, "usedToHaveLayerEffect", _extractHasLayerEffect(layerDescriptor));

        if (layerDescriptor.smartObject) {
            model.smartObject = SmartObject.fromDescriptor(layerDescriptor.smartObject);
        }

        return this.merge(model);
    };

    /**
     * Returns the smart object type for smart object layers, null otherwise
     *
     * @return {?SmartObjectType}
     */
    Layer.prototype.smartObjectType = function () {
        if (!this.isSmartObject) {
            return null;
        }

        if (!this.smartObject.linked) {
            return smartObjectTypes.EMBEDDED;
        } else if (this.smartObject.link && this.smartObject.link._obj === "ccLibrariesElement") {
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
    
    /**
     * Batch update layer properties.
     *
     * @param {object} properties
     * @return {Layer}
     */
    Layer.prototype.setProperties = function (properties) {
        var nextLayer = this.merge(properties);
        
        // If the layer is text layer, and the updated attributes include opacity, 
        // then we sync the new opacity to its CharacterStyle.
        // 
        // FIXME: we should avoid keeping multiple copies of the same attribute in different objects.
        if (properties.opacity && this.isText) {
            var charStyle = nextLayer.text.characterStyle,
                nextCharStyle = !charStyle.color ? charStyle :
                    charStyle.set("color", charStyle.color.setOpacity(nextLayer.opacity)),
                firstCharStyle = nextLayer.text.firstCharacterStyle,
                nextFirstCharStyle = firstCharStyle.set("color", firstCharStyle.color.setOpacity(nextLayer.opacity));

            nextLayer = nextLayer.set("text", nextLayer.text.merge({
                characterStyle: nextCharStyle,
                firstCharacterStyle: nextFirstCharStyle
            }));
        }

        return nextLayer;
    };

    module.exports = Layer;
});
