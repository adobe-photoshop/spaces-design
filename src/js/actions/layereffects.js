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

define(function (require, exports) {
    "use strict";

    var _ = require("lodash"),
        Immutable = require("immutable"),
        Promise = require("bluebird");

    var layerEffectLib = require("adapter/lib/layerEffect"),
        documentLib = require("adapter/lib/document");

    var Color = require("js/models/color"),
        events = require("../events"),
        locks = require("js/locks"),
        layerActionsUtil = require("js/util/layeractions"),
        strings = require("i18n!nls/strings");

    /**
     * Call ps adapter for the given layers, setting the dropShadow at the given index with the new props
     * this dispatches events to the fluxx store, and uses the resulting model to drive PS
     *
     * @private
     * @param {Document} document document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {?number} shadowIndex index of the dropShadow TO UPDATE within a list.  If null, adds new dropShadow
     * @param {object} newProps object containing NEW properties to be merged with existing dropShadow props
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var _callAdapter = function (document, layers, shadowIndex, newProps, coalesce, kind) {
        var documentStore = this.flux.store("document"),
            options = {
                paintOptions: {
                    immediateUpdate: true,
                    quality: "draft"
                },
                historyStateInfo: {
                    name: strings.ACTIONS.SET_LAYER_EFFECTS,
                    target: documentLib.referenceBy.id(document.id),
                    coalesce: !!coalesce
                }
            };
        
        // loop over layers, get current dropShadow, merge new properties, build PlayObject array
        var shadowPlayObjects =  layers.map(function (curlayer) {

            var toEmit,
                payload;
            
            if (_.isNumber(shadowIndex)) {
                toEmit = events.document.LAYER_EFFECT_CHANGED;
                payload = {
                    documentID: document.id,
                    layerIDs: [curlayer.id],
                    layerEffectIndex: shadowIndex,
                    layerEffectType: kind,
                    layerEffectProperties: newProps
                };
            } else {
                toEmit = events.document.LAYER_EFFECT_ADDED;
                var index;
                if (kind === "dropShadow") {
                    index = curlayer.dropShadows.size;
                }else if (kind === "innerShadow") {
                    index = curlayer.innerShadows.size;
                }
                payload = {
                    documentID: document.id,
                    layerIDs: [curlayer.id],
                    layerEffectIndex: index,
                    layerEffectType: kind,
                    layerEffectProperties: newProps
                };
            }
                
            this.dispatch(toEmit, payload);

            var layerStruct = documentStore.getDocument(document.id).layers,
                curLayerFromDocumentStore = layerStruct.byID(curlayer.id);

            var shadowsFromDocumentStore;
            if (kind === "dropShadow") {
                shadowsFromDocumentStore = curLayerFromDocumentStore.dropShadows;
            } else if (kind === "innerShadow") {
                shadowsFromDocumentStore = curLayerFromDocumentStore.innerShadows;
            }



            var shadowAdapterObject = shadowsFromDocumentStore
                .map(function (shadow) {
                    return shadow.toAdapterObject();
                }).toArray();

            var referenceID = layerEffectLib
                .referenceBy
                .id(curlayer.id);

            if (layerStruct.hasLayerEffect(curlayer)) {
                return {
                    layer : curlayer,
                    playObject : layerEffectLib.setExtendedLayerEffect(kind, referenceID, shadowAdapterObject)
                };
            } else {
                return {
                    layer : curlayer,
                    playObject : layerEffectLib.setLayerEffect(kind, referenceID, shadowAdapterObject)
                };
            }

        }, this);

        return layerActionsUtil.playLayerActions(document, shadowPlayObjects, true, options);
    };

    /**
     * Creates a new Shadow for each layer and uses the photoshop response to add it to the Store
     * If no props are provided, photoshop gets to choose the defaults
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index that the drop shadow should be added to
     * @param {?object} withProps object containing new drop shadow properties
     * @return {Promise}
     */
    var _addShadowToLayers = function (document, layers, shadowIndex, withProps, kind) {
        // withProps can be null, but force {enabled: true} regardless
        var newProps = _.isObject(withProps) ? withProps : {};
        _.merge(newProps, {enabled: true});

        return _callAdapter.call(this, document, layers, null, newProps, null, kind);
    };

    /**
     * Update an existing dropShadow (at given index) in each given layer
     * Optimistically dispatches event, and calls PS Adapter
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index that the drop shadow should be added to
     * @param {object} newProps object containing new drop shadow properties
     * @return {Promise}
     */
    var _updateShadowProperties = function (document, layers, shadowIndex, newProps, coalesce, kind) {
        // call PS Adapter
        return _callAdapter.call(this, document, layers, shadowIndex, newProps, coalesce, kind);
    };

    /**
     * For each given layer insert or update a new Shadow at given index, depending on its existence,
     * using the provided newProps object
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index that the drop shadow should be added to
     * @param {object} newProps object containing new drop shadow properties
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var _upsertShadowProperties = function (document, layers, shadowIndex, newProps, coalesce, kind) {
        // split layers in to two groups: those with existing dropShadows at index, and those without
        var addPromise,
            updatePromise,
            upsertList = layers.reduce(function (output, layer) {
                var list;
                if (kind === "dropShadow") {
                    list = layer.dropShadows;
                } else if (kind === "innerShadow") {
                    list = layer.innerShadows;
                }
                if (list && list.has(shadowIndex)) {
                    output.toUpdate.push(layer);
                } else {
                    output.toAdd.push(layer);
                }
                return output;
            }, {toUpdate: [], toAdd: []});

        if (upsertList.toAdd.length > 0) {
            addPromise = _addShadowToLayers.call(
                this, document, Immutable.List(upsertList.toAdd), shadowIndex, newProps, kind);
        } else {
            addPromise = Promise.resolve();
        }
        if (upsertList.toUpdate.length > 0) {
            updatePromise = _updateShadowProperties.call(
                this, document, Immutable.List(upsertList.toUpdate), shadowIndex, newProps, coalesce, kind);
        } else {
            updatePromise = Promise.resolve();
        }

        return Promise.join(addPromise, updatePromise);
    };

    /**
     * Add a new Drop Shadow to all selected layers of the given document
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @return {Promise}
     */
    var addDropShadowCommand = function (document, layers) {
        return _addShadowToLayers.call(this, document, layers, 0, null, "dropShadow");
    };
    /**
     * Add a new Inner Shadow to all selected layers of the given document
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @return {Promise}
     */
    var addInnerShadowCommand = function (document, layers) {
        return _addShadowToLayers.call(this, document, layers, 0, null, "innerShadow");
    };

    /**
     * Set the Drop Shadow enabled flag for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {boolean} enabled enabled flag
     * @return {Promise}
     */
    var setDropShadowEnabledCommand = function (document, layers, shadowIndex, enabled) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {enabled: enabled}, 0, "dropShadow");
    };

    /**
     * Set the Inner Shadow enabled flag for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {boolean} enabled enabled flag
     * @return {Promise}
     */
    var setInnerShadowEnabledCommand = function (document, layers, shadowIndex, enabled) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {enabled: enabled}, 0, "innerShadow");
    };

    /**
     * Set the Drop Shadow alpha value for all selected layers. Preserves the opaque color.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} alpha alpha value of the Drop Shadow
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var setDropShadowAlphaCommand = function (document, layers, shadowIndex, alpha, coalesce) {
        // FIXME: this would ideally make a single adapter call and emit a single event.
        return Promise.all(layers.map(function (layer) {
            var dropShadow = layer.dropShadows.get(shadowIndex),
                color;

            if (dropShadow) {
                color = dropShadow.color.setAlpha(alpha);
            } else {
                color = Color.DEFAULT.set("a", alpha);
            }

            return _upsertShadowProperties.call(
                this, document, Immutable.List.of(layer), shadowIndex, {color: color}, coalesce, "dropShadow");
        }, this).toArray());
    };

    /**
     * Set the Inner Shadow alpha value for all selected layers. Preserves the opaque color.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} alpha alpha value of the Drop Shadow
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var setInnerShadowAlphaCommand = function (document, layers, shadowIndex, alpha, coalesce) {
        // FIXME: this would ideally make a single adapter call and emit a single event.
        return Promise.all(layers.map(function (layer) {
            var innerShadow = layer.innerShadows.get(shadowIndex),
                color;

            if (innerShadow) {
                color = innerShadow.color.setAlpha(alpha);
            } else {
                color = Color.DEFAULT.set("a", alpha);
            }

            return _upsertShadowProperties.call(
                this, document, Immutable.List.of(layer), shadowIndex, {color: color}, coalesce, "innerShadow");
        }, this).toArray());
    };
    /**
     * Set the Drop Shadow Color for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {Color} color color of the Drop Shadow
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @param {boolean=} ignoreAlpha Whether to ignore the alpha value of the
     *  given color and only update the opaque color value.
     * @return {Promise}
     */
    var setDropShadowColorCommand = function (document, layers, shadowIndex, color, coalesce, ignoreAlpha) {
        if (ignoreAlpha) {
            // FIXME: this would ideally make a single adapter call and emit a single event.
            return Promise.all(layers.map(function (layer) {
                var shadow = layer.dropShadows.get(shadowIndex),
                    nextColor;

                if (shadow) {
                    nextColor = shadow.color.setOpaque(color);
                } else {
                    nextColor = Color.DEFAULT;
                }
                return _upsertShadowProperties.call(
                    this, document, Immutable.List.of(layer), shadowIndex, {color: nextColor}, coalesce, "dropShadow");
            }, this).toArray());
        } else {
            var normalizedColor = color ? color.normalizeAlpha() : null;
            return _upsertShadowProperties.call(
                this, document, layers, shadowIndex, {color: normalizedColor}, coalesce, "dropShadow");
        }
    };

    /**
     * Set the Drop Shadow Color for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {Color} color color of the Drop Shadow
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @param {boolean=} ignoreAlpha Whether to ignore the alpha value of the
     *  given color and only update the opaque color value.
     * @return {Promise}
     */
    var setInnerShadowColorCommand = function (document, layers, shadowIndex, color, coalesce, ignoreAlpha) {
        if (ignoreAlpha) {
            // FIXME: this would ideally make a single adapter call and emit a single event.
            return Promise.all(layers.map(function (layer) {
                var shadow = layer.innerShadows.get(shadowIndex),
                    nextColor;

                if (shadow) {
                    nextColor = shadow.color.setOpaque(color);
                } else {
                    nextColor = Color.DEFAULT;
                }
                return _upsertShadowProperties.call(
                    this, document, Immutable.List.of(layer), shadowIndex, {color: nextColor}, coalesce, "innerShadow");
            }, this).toArray());
        } else {
            var normalizedColor = color ? color.normalizeAlpha() : null;
            return _upsertShadowProperties.call(
                this, document, layers, shadowIndex, {color: normalizedColor}, coalesce, "innerShadow");
        }
    };

    /**
     * Set the Drop Shadow X coordinate for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} x x coordinate in pixels
     * @return {Promise}
     */
    var setDropShadowXCommand = function (document, layers, shadowIndex, x) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {x: x}, null, "dropShadow");
    };

    /**
     * Set the Drop Shadow X coordinate for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} x x coordinate in pixels
     * @return {Promise}
     */
    var setInnerShadowXCommand = function (document, layers, shadowIndex, x) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {x: x}, null, "innerShadow");
    };


    /**
     * Set the Drop Shadow Y coordinate for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} y y coordinate in pixels
     * @return {Promise}
     */
    var setDropShadowYCommand = function (document, layers, shadowIndex, y) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {y: y}, null, "dropShadow");
    };

    /**
     * Set the Drop Shadow Y coordinate for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} y y coordinate in pixels
     * @return {Promise}
     */
    var setInnerShadowYCommand = function (document, layers, shadowIndex, y) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {y: y}, null, "innerShadow");
    };

    /**
     * Set the Drop Shadow Blur value for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} blur blur value in pixels
     * @return {Promise}
     */
    var setDropShadowBlurCommand = function (document, layers, shadowIndex, blur) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {blur: blur}, null, "dropShadow");
    };

    /**
     * Set the Drop Shadow Blur value for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} blur blur value in pixels
     * @return {Promise}
     */
    var setInnerShadowBlurCommand = function (document, layers, shadowIndex, blur) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {blur: blur}, null, "innerShadow");
    };

    /**
     * Set the Drop Shadow Spread value for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} spread spread value in pixels
     * @return {Promise}
     */
    var setDropShadowSpreadCommand = function (document, layers, shadowIndex, spread) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {spread: spread}, null, "dropShadow");
    };
    
    /**
     * Set the Drop Shadow Spread value for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} shadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} spread spread value in pixels
     * @return {Promise}
     */
    var setInnerShadowSpreadCommand = function (document, layers, shadowIndex, spread) {
        return _upsertShadowProperties.call(
            this, document, layers, shadowIndex, {spread: spread}, null, "innerShadow");
    };

    // Inner Shadow
    var addInnerShadow = {
        command: addInnerShadowCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setInnerShadowEnabled = {
        command: setInnerShadowEnabledCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setInnerShadowAlpha = {
        command: setInnerShadowAlphaCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setInnerShadowColor = {
        command: setInnerShadowColorCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setInnerShadowX = {
        command: setInnerShadowXCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setInnerShadowY = {
        command: setInnerShadowYCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setInnerShadowBlur = {
        command: setInnerShadowBlurCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setInnerShadowSpread = {
        command: setInnerShadowSpreadCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };
        // Drop Shadow
    var addDropShadow = {
        command: addDropShadowCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setDropShadowEnabled = {
        command: setDropShadowEnabledCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setDropShadowAlpha = {
        command: setDropShadowAlphaCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setDropShadowColor = {
        command: setDropShadowColorCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setDropShadowX = {
        command: setDropShadowXCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setDropShadowY = {
        command: setDropShadowYCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setDropShadowBlur = {
        command: setDropShadowBlurCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setDropShadowSpread = {
        command: setDropShadowSpreadCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };


    exports.addInnerShadow = addInnerShadow;
    exports.setInnerShadowEnabled = setInnerShadowEnabled;
    exports.setInnerShadowAlpha = setInnerShadowAlpha;
    exports.setInnerShadowColor = setInnerShadowColor;
    exports.setInnerShadowX = setInnerShadowX;
    exports.setInnerShadowY = setInnerShadowY;
    exports.setInnerShadowBlur = setInnerShadowBlur;
    exports.setInnerShadowSpread = setInnerShadowSpread;


    exports.addDropShadow = addDropShadow;
    exports.setDropShadowEnabled = setDropShadowEnabled;
    exports.setDropShadowAlpha = setDropShadowAlpha;
    exports.setDropShadowColor = setDropShadowColor;
    exports.setDropShadowX = setDropShadowX;
    exports.setDropShadowY = setDropShadowY;
    exports.setDropShadowBlur = setDropShadowBlur;
    exports.setDropShadowSpread = setDropShadowSpread;

});
