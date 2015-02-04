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

    var Immutable = require("immutable");

    var descriptor = require("adapter/ps/descriptor"),
        layerLib = require("adapter/lib/layer"),
        contentLayerLib = require("adapter/lib/contentLayer");

    var events = require("../events"),
        locks = require("js/locks"),
        collection = require("js/util/collection"),
        process = require("js/util/process"),
        objUtil = require("js/util/object"),
        layerActionsUtil = require("js/util/layeractions");

    /**
     * Helper function to generically dispatch strokes update events
     *
     * @private
     * @param {Document} document active Document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} strokeIndex index of the stroke in each layer
     * @param {object} strokeProperties a pseudo stroke object containing only new props
     * @param {string} eventName name of the event to emit afterwards
     */
    var _strokeChangeDispatch = function (document, layers, strokeIndex, strokeProperties, eventName) {
        var payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                strokeIndex: strokeIndex,
                strokeProperties: strokeProperties
            };

        process.nextTick(function () {
            this.dispatch(eventName, payload);
        }, this);
    };

    /**
     * Helper function to generically dispatch fills update events
     *
     * @private
     * @param {Document} document active Document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} fillIndex index of the fill in each layer
     * @param {object} fillProperties a pseudo fill object containing only new props
     * @param {string} eventName name of the event to emit afterwards
     */
    var _fillChangeDispatch = function (document, layers, fillIndex, fillProperties, eventName) {
        // TODO layers param needs to be made fa real
        var payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                fillIndex: fillIndex,
                fillProperties: fillProperties
            };

        process.nextTick(function () {
            this.dispatch(eventName, payload);
        }, this);
    };

    /**
     * Test the given layers for the existence of a stroke of specified index
     *
     * @private
     * @param {Immutable.Iterable.<Layer>} layers set of layers to test
     * @param {number} strokeIndex index of the stroke of which to test or existence
     *
     * @return {boolean} true if all strokes exist
     */
    var _allStrokesExist = function (layers, strokeIndex) {
        return layers.every(function (layer) {
            return layer.strokes && layer.strokes.get(strokeIndex);
        });
    };

    /**
     * Make a batch call to photoshop to get the Stroke Style information for the specified layers
     * Use the results to build a payload of strokes to add at the specified index
     *
     * @private
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {number} strokeIndex the index at which the given strokes will be added to the layer model
     *
     * @return {Promise} Promise of the initial batch call to photoshop
     */
    var _refreshStrokes = function (document, layers, strokeIndex) {
        var refs = layerLib.referenceBy.id(collection.pluck(layers, "id").toArray());

        return descriptor.batchGetProperty(refs.ref, "AGMStrokeStyleInfo")
            .bind(this)
            .then(function (batchGetResponse) {
                // dispatch information about the newly created stroke
                layers.forEach(function (layer, index) {
                    var payload = {
                        documentID: document.id,
                        strokeIndex: strokeIndex,
                        layerIDs: Immutable.List.of(layer.id),
                        strokeStyleDescriptor: batchGetResponse[index]
                    };

                    this.dispatch(events.document.STROKE_ADDED, payload);
                }, this);
            });
    };


    /**
     * Sets the enabled flag for all selected Layers on a given doc.
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} strokeIndex index of the stroke within the layer
     * @param {Color} color color of the strokes, since photoshop does not provide a way to simply enable a stroke
     * @param {boolean=} enabled
     * @return {Promise}
     */
    var setStrokeEnabledCommand = function (document, layers, strokeIndex, color, enabled) {
        // TODO is it reasonable to not require a color, but instead to derive it here based on the selected layers?
        // the only problem with that is having to define a default color here if none can be derived
        return setStrokeColorCommand.call(this, document, layers, strokeIndex, color, enabled);
    };

    /**
     * Set the color of the stroke for the given layers of the given document
     * If there are selected layers that do not currently have a stroke, then a subsequent call
     * will be made to fetch the stroke style for each layer, and the result will be used to update the stroke store.
     * This is necessary because photoshop does not report the width in the first response
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} strokeIndex index of the stroke within the layer(s)
     * @param {Color} color
     * @param {boolean=} enabled optional enabled flag, default=true
     * @return {Promise}
     */
    var setStrokeColorCommand = function (document, layers, strokeIndex, color, enabled) {
        // if a color is provided, adjust the alpha to one that can be represented as a fraction of 255
        color = color ? color.normalizeAlpha() : null;
        // if enabled is not provided, assume it is true
        enabled = enabled === undefined ? true : enabled;

        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setStrokeFillTypeSolidColor(layerRef, enabled ? color.toJS() : null);

        if (_allStrokesExist(layers, strokeIndex)) {
            // optimistically dispatch the change event    
            _strokeChangeDispatch.call(this,
                document,
                layers,
                strokeIndex,
                {enabled: enabled, color: color},
                events.document.STROKE_COLOR_CHANGED);

            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true);
        } else {
            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true)
                .bind(this)
                .then(function () {
                    // upon completion, fetch the stroke info for all layers
                    _refreshStrokes.call(this, document, layers, strokeIndex);
                });
        }
    };

    /**
     * Set the opacity of the stroke for all selected layers of the given document.
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} strokeIndex index of the stroke within the layer(s)
     * @param {number} opacity opacity as a percentage [0,100]
     * @return {Promise}
     */
    var setStrokeOpacityCommand = function (document, layers, strokeIndex, opacity) {
        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setStrokeOpacity(layerRef, opacity);

        if (_allStrokesExist(layers, strokeIndex)) {
            // optimistically dispatch the change event    
            _strokeChangeDispatch.call(this,
                document,
                layers,
                strokeIndex,
                {opacity: opacity},
                events.document.STROKE_OPACITY_CHANGED);

            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true);
        } else {
            // There is an existing photoshop bug that clobbers color when setting opacity
            // on a set of layers that inclues "no stroke" layers.  SO this works as well as it can
            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true)
                .bind(this)
                .then(function () {
                    // upon completion, fetch the stroke info for all layers
                    _refreshStrokes.call(this, document, layers, strokeIndex);
                });
        }
    };

    /**
     * Set the size of the stroke for all selected layers of the given document
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} strokeIndex index of the stroke within the layer(s)
     * @param {number} width stroke width, in pixels
     * @return {Promise}
     */
    var setStrokeWidthCommand = function (document, layers, strokeIndex, width) {
        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setShapeStrokeWidth(layerRef, width);

        if (_allStrokesExist(layers, strokeIndex)) {
            // dispatch the change event    
            _strokeChangeDispatch.call(this,
                document,
                layers,
                strokeIndex,
                {width: width, enabled: true},
                events.document.STROKE_WIDTH_CHANGED);

            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true);
        } else {
            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true)
                .bind(this)
                .then(function () {
                    // upon completion, fetch the stroke info for all layers
                    _refreshStrokes.call(this, document, layers, strokeIndex);
                });
        }
    };

    /**
     * Add a stroke from scratch
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @return {Promise}
     */
    var addStrokeCommand = function (document, layers) {
        
        // build the playObject
        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setShapeStrokeWidth(layerRef, 1); // TODO hardcoded default

        // submit to adapter
        return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true)
            .bind(this)
            .then(function (playResponse) {
                // dispatch information about the newly created stroke
                var strokeStyleDescriptor = objUtil.getPath(playResponse, "to.value.strokeStyle"),
                    payload = {
                        documentID: document.id,
                        layerIDs: collection.pluck(layers, "id"),
                        strokeStyleDescriptor: strokeStyleDescriptor,
                        strokeIndex: 0
                    };

                this.dispatch(events.document.STROKE_ADDED, payload);
            });
    };

    /**
     * Set the enabled flag for the given fill of all selected Layers on a given doc
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} fillIndex index of the fill within the layer
     * @param {Color} color
     * @param {boolean=} enabled
     * @return {Promise}
     */
    var setFillEnabledCommand = function (document, layers, fillIndex, color, enabled) {
        return setFillColorCommand.call(this, document, layers, fillIndex, color, enabled);
    };

    /**
     * Set the color of the fill for all selected layers of the given document
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} fillIndex index of the fill within the layer(s)
     * @param {Color} color
     * @param {boolean=} enabled optional enabled flag, default=true
     * @return {Promise}
     */
    var setFillColorCommand = function (document, layers, fillIndex, color, enabled) {
        // if a color is provided, adjust the alpha to one that can be represented as a fraction of 255
        color = color ? color.normalizeAlpha() : null;
        // if enabled is not provided, assume it is true
        enabled = (enabled === undefined) ? true : enabled;

        // dispatch the change event    
        _fillChangeDispatch.call(this,
            document,
            layers,
            fillIndex,
            {color: color, enabled: enabled},
            events.document.FILL_COLOR_CHANGED);
        
        // build the playObject
        var contentLayerRef = contentLayerLib.referenceBy.current,
            layerRef = layerLib.referenceBy.current,
            fillColorObj = contentLayerLib.setShapeFillTypeSolidColor(contentLayerRef, enabled ? color : null),
            fillOpacityObj = layerLib.setFillOpacity(layerRef, color.a * 100);

        // submit to Ps
        if (enabled) {
            return layerActionsUtil.playSimpleLayerActions(document, layers, [fillColorObj, fillOpacityObj], true);
        } else {
            return layerActionsUtil.playSimpleLayerActions(document, layers, fillColorObj, true);
        }
    };

    /**
     * Set the opacity of the fill for all selected layers of the given document
     * If only changing the alpha, this has a slight savings over setFillColorCommand by only using one adapter call
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers
     * @param {number} fillIndex index of the fill within the layer(s)
     * @param {number} opacity Opacity percentage [0,100]
     * @return {Promise}
     */
    var setFillOpacityCommand = function (document, layers, fillIndex, opacity) {
        // dispatch the change event
        _fillChangeDispatch.call(this,
            document,
            layers,
            fillIndex,
            {opacity: opacity, enabled: true},
            events.document.FILL_OPACITY_CHANGED);
        
        // build the playObject
        var layerRef = layerLib.referenceBy.current,
            fillObj = layerLib.setFillOpacity(layerRef, opacity);

        return layerActionsUtil.playSimpleLayerActions(document, layers, fillObj, true);
    };

    /**
     * Add a new fill to the specified layers of the specified document.
     *
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers
     * @param {Color} color of the fill to be added
     * @return {Promise}
     */
    var addFillCommand = function (document, layers, color) {
        // build the playObject
        var contentLayerRef = contentLayerLib.referenceBy.current,
            fillObj = contentLayerLib.setShapeFillTypeSolidColor(contentLayerRef, color);

        return layerActionsUtil.playSimpleLayerActions(document, layers, fillObj, true)
            .bind(this)
            .then(function (setDescriptor) {
                // dispatch information about the newly created stroke
                var payload = {
                        documentID: document.id,
                        layerIDs: collection.pluck(layers, "id"),
                        setDescriptor: setDescriptor
                    };
                this.dispatch(events.document.FILL_ADDED, payload);
            });
    };

    // STROKE
    var setStrokeEnabled = {
        command: setStrokeEnabledCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setStrokeWidth = {
        command: setStrokeWidthCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setStrokeColor = {
        command: setStrokeColorCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setStrokeOpacity = {
        command: setStrokeOpacityCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var addStroke = {
        command: addStrokeCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    // FILL
    var setFillEnabled = {
        command: setFillEnabledCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setFillColor = {
        command: setFillColorCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setFillOpacity = {
        command: setFillOpacityCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var addFill = {
        command: addFillCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };


    exports.setStrokeEnabled = setStrokeEnabled;
    exports.setStrokeWidth = setStrokeWidth;
    exports.setStrokeColor = setStrokeColor;
    exports.setStrokeOpacity = setStrokeOpacity;
    exports.addStroke = addStroke;

    exports.setFillEnabled = setFillEnabled;
    exports.setFillColor = setFillColor;
    exports.setFillOpacity = setFillOpacity;
    exports.addFill = addFill;

});
