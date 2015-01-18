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

    var descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerEffectLib = require("adapter/lib/layerEffect"),
        layerLib = require("adapter/lib/layer");

    var DropShadow = require("js/models/dropshadow"),
        events = require("../events"),
        locks = require("js/locks"),
        collection = require("js/util/collection"),
        objUtil = require("js/util/object");

    /**
     * Helper function to generically dispatch layerEffect update events
     *
     * @private
     * @param {Document} document active Document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} layerEffectIndex index of the layerEffect in each layer
     * @param {object} layerEffectProperties a pseudo layerEffect object containing only new props
     * @param {string} eventName name of the event to emit afterwards
     */
    var _layerEffectChangeDispatch =
        function (document, layers, layerEffectIndex, layerEffectType, layerEffectProperties, eventName) {

        var payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                layerEffectIndex: layerEffectIndex,
                layerEffectType: layerEffectType,
                layerEffectProperties: layerEffectProperties
            };
        this.dispatch(eventName, payload);
    };

    /**
     * Call ps adapter for the given layers, setting the dropShadow at the given index with the new props
     * If more than layer is selected, this will transparently, temporarily de-select all-but-the-first
     * to work around a photoshop limitation.
     *
     * @private
     * @param {Document} document document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number?} dropShadowIndex index of the dropShadow TO UPDATE within a list.  If null, adds new dropShadow
     * @param {object} newProps object containing NEW properties to be merged with existing dropShadow props
     * @return {Promise}
     */
    var _callAdapter = function (document, layers, dropShadowIndex, newProps) {
        var documentRef = documentLib.referenceBy.id(document.id),
            selectedLayers = document.layers.selected;
        
        // loop over layers, get current dropShadow, merge new properties, build PlayObject array
        var dropShadowPlayObjects =  layers.map(function (layer) {
            var dropShadowAdapterObject;
            if (_.isNumber(dropShadowIndex)) {
                var dropShadow = layer.dropShadows.get(dropShadowIndex);
                dropShadowAdapterObject = dropShadow.merge(newProps).toAdapterObject();
            } else {
                dropShadowAdapterObject = new DropShadow(newProps).toAdapterObject();
            }
            return layerEffectLib.setDropShadow(
                layerEffectLib.referenceBy.id(layer.id), dropShadowAdapterObject);
        });

        // If more than one layer is selected we need to hack around a photoshop limitation 
        // which does not allow updating layer effects when more than one layer is selected
        if (selectedLayers.size > 1) {
            // select the first of the selected layers
            dropShadowPlayObjects = dropShadowPlayObjects.unshift(
                layerLib.select([documentRef, layerLib.referenceBy.id(selectedLayers.first().id)]));

            // at the end of the batch, re-select the original layers
            var allLayerRefs = selectedLayers.map(function (layer) {
                    return layerLib.referenceBy.id(layer.id);
                });
            allLayerRefs = allLayerRefs.unshift(documentRef);
            dropShadowPlayObjects = dropShadowPlayObjects.push(layerLib.select(allLayerRefs.toArray()));

            return descriptor.batchPlayObjects(dropShadowPlayObjects.toArray())
                .then(function (dropShadowDescriptor) {
                    // strip off the extraneous first and last response elements caused by this selection dance
                    return _.rest(_.initial(dropShadowDescriptor));
                });
        } else {
            return descriptor.batchPlayObjects(dropShadowPlayObjects.toArray());
        }
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

        return _callAdapter (document, layers, null, newProps)
            .bind(this)
            .then(function (dropShadowDescriptor) {
                // If more than one layer was selected, grab the first result as example dropShadow
                var descriptor = _.isArray(dropShadowDescriptor) ? _.first(dropShadowDescriptor) : dropShadowDescriptor;

                // dispatch information about the newly created stroke
                var payload = {
                        documentID: document.id,
                        layerIDs: collection.pluck(layers, "id"),
                        layerEffectType: "dropShadow",
                        layerEffectDescriptor: objUtil.getPath(descriptor, "to.value.dropShadow"),
                        layerEffectIndex: dropShadowIndex || 0
                    };

                this.dispatch(events.document.LAYER_EFFECT_ADDED, payload);
            });
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
        // dispatch the change event    
        _layerEffectChangeDispatch.call(this,
            document,
            layers,
            dropShadowIndex,
            "dropShadow",
            newProps,
            events.document.LAYER_EFFECT_CHANGED);
        
        // call PS Adapter
        return _callAdapter (document, layers, dropShadowIndex, newProps);
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
     * Set the Drop Shadow Color for all selected layers
     * 
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers list of layers to update
     * @param {number} dropShadowIndex index of the Drop Shadow within the layer(s)
     * @param {Color} color color of the Drop Shadow
     * @return {Promise}
     */
    var setDropShadowColorCommand = function (document, layers, dropShadowIndex, color) {
        var normalizedColor = color ? color.normalizeAlpha() : null;
        return _upsertDropShadowProperties.call(
            this, document, layers, dropShadowIndex, {color: normalizedColor});
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
    exports.setDropShadowColor = setDropShadowColor;
    exports.setDropShadowX = setDropShadowX;
    exports.setDropShadowY = setDropShadowY;
    exports.setDropShadowBlur = setDropShadowBlur;
    exports.setDropShadowSpread = setDropShadowSpread;

});
