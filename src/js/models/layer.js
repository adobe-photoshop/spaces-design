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
        SmartObject = require("./smartobject"),
        Fill = require("./fill"),
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

    Layer.layerKinds = layerLib.layerKinds;

    Layer.smartObjectTypes = smartObjectTypes;

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
            return !this.locked &&
                this.kind !== this.layerKinds.ADJUSTMENT &&
                this.kind !== this.layerKinds.GROUPEND;
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
        });
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
        var resolution = previousDocument.resolution,
            artboardEnabled = layerDescriptor.artboardEnabled,
            exportEnabled = artboardEnabled && layerDescriptor.exportEnabled !== false || layerDescriptor.exportEnabled,
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
        if (properties.opacity && this.isTextLayer()) {
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
