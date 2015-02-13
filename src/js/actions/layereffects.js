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
     * @param {number?} dropShadowIndex index of the dropShadow TO UPDATE within a list.  If null, adds new dropShadow
     * @param {object} newProps object containing NEW properties to be merged with existing dropShadow props
     * @return {Promise}
     */
    var _callAdapter = function (document, layers, dropShadowIndex, newProps) {
        var documentStore = this.flux.store("document"),
            layerIds = layers.map(function (layer) {
                return layer.id;
            }),
            options = {
                paintOptions: {
                    immediateUpdate: true,
                    quality: "draft"
                },
                historyStateInfo: {
                    name: strings.ACTIONS.SET_LAYER_EFFECTS,
                    target: documentLib.referenceBy.id(document.id)
                }
            };
        
        // loop over layers, get current dropShadow, merge new properties, build PlayObject array
        var dropShadowPlayObjects =  layers.map(function (curlayer) {

            var toEmit,
                payload;
            
            if (_.isNumber(dropShadowIndex)) {
                toEmit = events.document.LAYER_EFFECT_CHANGED;
                payload = {
                    documentID: document.id,
                    layerIDs: layerIds,
                    layerEffectIndex: dropShadowIndex,
                    layerEffectType: "dropShadow",
                    layerEffectProperties: newProps
                };
            } else {
                toEmit = events.document.LAYER_EFFECT_ADDED;
                payload = {
                    documentID: document.id,
                    layerIDs: layerIds,
                    layerEffectIndex: curlayer.dropShadows.size,
                    layerEffectType: "dropShadow",
                    layerEffectProperties: newProps
                };
            }
                
            this.dispatch(toEmit, payload);

            var dropShadowsFromDocumentStore = documentStore.getDocument(document.id)
                .layers
                .byID(curlayer.id)
                .dropShadows;

            var dropShadowAdapterObject = dropShadowsFromDocumentStore
                .map(function (dropShadow) {
                    return dropShadow.toAdapterObject();
                }).toArray();

            var referenceID = layerEffectLib
                .referenceBy
                .id(curlayer.id);

            return {
                layer : curlayer,
                playObject : layerEffectLib.setDropShadows(referenceID, dropShadowAdapterObject)
            };

        }, this);

        return layerActionsUtil.playLayerActions(document, dropShadowPlayObjects, true, options);
    };

    /**
     * Creates a new DropShadow for each layer and uses the photoshop response to add it to the Store
     * If no props are provided, photoshop gets to choose the defaults
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index that the drop shadow should be added to
     * @param {object?} withProps object containing new drop shadow properties
     * @return {Promise}
     */
    var _addDropShadowToLayers = function (document, layers, dropShadowIndex, withProps) {
        // withProps can be null, but force {enabled: true} regardless
        var newProps = _.isObject(withProps) ? withProps : {};
        _.merge(newProps, {enabled: true});

        return _callAdapter.call(this, document, layers, null, newProps);
    };

    /**
     * Update an existing dropShadow (at given index) in each given layer
     * Optimistically dispatches event, and calls PS Adapter
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index that the drop shadow should be added to
     * @param {object} newProps object containing new drop shadow properties
     * @return {Promise}
     */
    var _updateDropShadowProperties = function (document, layers, dropShadowIndex, newProps) {
        
        // call PS Adapter
        return _callAdapter.call(this, document, layers, dropShadowIndex, newProps);
    };

    /**
     * For each given layer insert or update a new DropShadow at given index, depending on its existence,
     * using the provided newProps object
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index that the drop shadow should be added to
     * @param {object} newProps object containing new drop shadow properties
     * @return {Promise}
     */
    var _upsertDropShadowProperties = function (document, layers, dropShadowIndex, newProps) {
        // split layers in to two groups: those with existing dropShadows at index, and those without
        var addPromise,
            updatePromise,
            upsertList = layers.reduce(function (output, layer) {
                if (layer.dropShadows.has(dropShadowIndex)) {
                    output.toUpdate.push(layer);
                } else {
                    output.toAdd.push(layer);
                }
                return output;
            }, {toUpdate: [], toAdd: []});

        if (upsertList.toAdd.length > 0) {
            addPromise = _addDropShadowToLayers.call(
                this, document, Immutable.List(upsertList.toAdd), dropShadowIndex, newProps);
        } else {
            addPromise = Promise.resolve();
        }
        if (upsertList.toUpdate.length > 0) {
            updatePromise = _updateDropShadowProperties.call(
                this, document, Immutable.List(upsertList.toUpdate), dropShadowIndex, newProps);
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
        return _addDropShadowToLayers.call(this, document, layers, 0);
    };

    /**
     * Set the Drop Shadow enabled flag for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index of the Drop Shadow within the layer(s)
     * @param {boolean} enabled enabled flag
     * @return {Promise}
     */
    var setDropShadowEnabledCommand = function (document, layers, dropShadowIndex, enabled) {
        return _upsertDropShadowProperties.call(
            this, document, layers, dropShadowIndex, {enabled: enabled});
    };

    /**
     * Set the Drop Shadow alpha value for all selected layers. Preserves the opaque color.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} alpha alpha value of the Drop Shadow
     * @return {Promise}
     */
    var setDropShadowAlphaCommand = function (document, layers, dropShadowIndex, alpha) {
        // FIXME: this would ideally make a single adapter call and emit a single event.
        return Promise.all(layers.map(function (layer) {
            var dropShadow = layer.dropShadows.get(dropShadowIndex),
                color;

            if (dropShadow) {
                color = dropShadow.color.setAlpha(alpha);
            } else {
                color = Color.DEFAULT.set("a", alpha);
            }

            return _upsertDropShadowProperties.call(
                this, document, Immutable.List.of(layer), dropShadowIndex, {color: color});
        }, this).toArray());
    };

    /**
     * Set the Drop Shadow Color for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index of the Drop Shadow within the layer(s)
     * @param {Color} color color of the Drop Shadow
     * @param {boolean=} ignoreAlpha Whether to ignore the alpha value of the
     *  given color and only update the opaque color value.
     * @return {Promise}
     */
    var setDropShadowColorCommand = function (document, layers, dropShadowIndex, color, ignoreAlpha) {
        if (ignoreAlpha) {
            // FIXME: this would ideally make a single adapter call and emit a single event.
            return Promise.all(layers.map(function (layer) {
                var dropShadow = layer.dropShadows.get(dropShadowIndex),
                    nextColor;

                if (dropShadow) {
                    nextColor = dropShadow.color.setOpaque(color);
                } else {
                    nextColor = Color.DEFAULT;
                }
                return _upsertDropShadowProperties.call(
                    this, document, Immutable.List.of(layer), dropShadowIndex, {color: nextColor});
            }, this).toArray());
        } else {
            var normalizedColor = color ? color.normalizeAlpha() : null;
            return _upsertDropShadowProperties.call(
                this, document, layers, dropShadowIndex, {color: normalizedColor});
        }
    };

    /**
     * Set the Drop Shadow X coordinate for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} x x coordinate in pixels
     * @return {Promise}
     */
    var setDropShadowXCommand = function (document, layers, dropShadowIndex, x) {
        return _upsertDropShadowProperties.call(
            this, document, layers, dropShadowIndex, {x: x});
    };

    /**
     * Set the Drop Shadow Y coordinate for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} y y coordinate in pixels
     * @return {Promise}
     */
    var setDropShadowYCommand = function (document, layers, dropShadowIndex, y) {
        return _upsertDropShadowProperties.call(
            this, document, layers, dropShadowIndex, {y: y});
    };

    /**
     * Set the Drop Shadow Blur value for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} blur blur value in pixels
     * @return {Promise}
     */
    var setDropShadowBlurCommand = function (document, layers, dropShadowIndex, blur) {
        return _upsertDropShadowProperties.call(
            this, document, layers, dropShadowIndex, {blur: blur});
    };

    /**
     * Set the Drop Shadow Spread value for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index of the Drop Shadow within the layer(s)
     * @param {number} spread spread value in pixels
     * @return {Promise}
     */
    var setDropShadowSpreadCommand = function (document, layers, dropShadowIndex, spread) {
        return _upsertDropShadowProperties.call(
            this, document, layers, dropShadowIndex, {spread: spread});
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


    exports.addDropShadow = addDropShadow;
    exports.setDropShadowEnabled = setDropShadowEnabled;
    exports.setDropShadowAlpha = setDropShadowAlpha;
    exports.setDropShadowColor = setDropShadowColor;
    exports.setDropShadowX = setDropShadowX;
    exports.setDropShadowY = setDropShadowY;
    exports.setDropShadowBlur = setDropShadowBlur;
    exports.setDropShadowSpread = setDropShadowSpread;

});
