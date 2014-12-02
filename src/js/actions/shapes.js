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
        descriptor = require("adapter/ps/descriptor"),
        layerLib = require("adapter/lib/layer"),
        contentLayerLib = require("adapter/lib/contentLayer");

    var events = require("../events"),
        locks = require("js/locks"),
        objUtil = require("js/util/object");

    /**
     * Helper function to generically dispatch strokes update events
     *
     * @private
     * @param {Document} document active Document
     * @param {number} strokeIndex index of the stroke in each layer
     * @param {object} strokeProperties a pseudo stroke object containing only new props
     * @param {string} eventName name of the event to emit afterwards
     */
    var _strokeChangeDispatch = function (document, strokeIndex, strokeProperties, eventName) {
        var payload = {
                documentID: document.id,
                layerIDs: _.pluck(document.getSelectedLayers(), "id"),
                strokeIndex: strokeIndex,
                strokeProperties: strokeProperties
            };
        this.dispatch(eventName, payload);
    };

    /**
     * Helper function to generically dispatch fills update events
     *
     * @private
     * @param {Document} document active Document
     * @param {number} fillIndex index of the fill in each layer
     * @param {object} fillProperties a pseudo fill object containing only new props
     * @param {string} eventName name of the event to emit afterwards
     */
    var _fillChangeDispatch = function (document, fillIndex, fillProperties, eventName) {
        var payload = {
                documentID: document.id,
                layerIDs: _.pluck(document.getSelectedLayers(), "id"),
                fillIndex: fillIndex,
                fillProperties: fillProperties
            };
        this.dispatch(eventName, payload);
    };


    /**
     * Toggles the enabled flag for all selected Layers on a given doc
     * 
     * @param {Document} document
     * @param {number} strokeIndex index of the stroke within the layer
     * @param {Color} color instead of letting photoshop choose the color
     * @param {boolean} enabled
     * @return {Promise}
     */
    var toggleStrokeEnabledCommand = function (document, strokeIndex, color, enabled) {
        // dispatch the change event    
        _strokeChangeDispatch.call(this,
            document,
            strokeIndex,
            {enabled: enabled, color: color},
            events.strokes.STROKE_ENABLED_CHANGED);

        var rgb = enabled ? color : null,
            layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setStrokeFillTypeSolidColor(layerRef, rgb);

        return descriptor.playObject(strokeObj);
    };

    /**
     * Set the size of the stroke for all selected layers of the given document
     * 
     * @param {Document} document
     * @param {number} strokeIndex index of the stroke within the layer(s)
     * @param {number} width stroke width, in pixels
     * @return {Promise}
     */
    var setStrokeWidthCommand = function (document, strokeIndex, width) {
        // dispatch the change event    
        _strokeChangeDispatch.call(this,
            document,
            strokeIndex,
            {width: width},
            events.strokes.STROKE_WIDTH_CHANGED);

        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setShapeStrokeWidth(layerRef, width);

        return descriptor.playObject(strokeObj);
    };

    /**
     * Set the color of the stroke for all selected layers of the given document
     * 
     * @param {Document} document
     * @param {number} strokeIndex index of the stroke within the layer(s)
     * @param {Color} color
     * @return {Promise}
     */
    var setStrokeColorCommand = function (document, strokeIndex, color) {
        // dispatch the change event    
        _strokeChangeDispatch.call(this,
            document,
            strokeIndex,
            {color: color},
            events.strokes.STROKE_COLOR_CHANGED);
        
        // build the playObject
        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setStrokeFillTypeSolidColor(layerRef, color);

        // submit to Ps
        return descriptor.playObject(strokeObj);
        
    };

    /**
     * Add a stroke from scratch
     * 
     * @param {Document} document
     * @return {Promise}
     */
    var addStrokeCommand = function (document) {
        
        // build the playObject
        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setShapeStrokeWidth(layerRef, 1); // TODO hardcoded default

        // submit to adapter
        return descriptor.playObject(strokeObj)
            .bind(this)
            .then(function (playResponse) {
                // dispatch information about the newly created stroke
                var payload = {
                        documentID: document.id,
                        layerIDs: _.pluck(document.getSelectedLayers(), "id"),
                        strokeStyleDescriptor: objUtil.getPath(playResponse, "to.value.strokeStyle")
                    };
                this.dispatch(events.strokes.STROKE_ADDED, payload);
            });
    };

    /**
     * Toggles the enabled flag for the given fill of all selected Layers on a given doc
     * 
     * @param {Document} document
     * @param {number} fillIndex index of the fill within the layer
     * @param {Color} color
     * @param {boolean} enabled
     * @return {Promise}
     */
    var toggleFillEnabledCommand = function (document, fillIndex, color, enabled) {
        // dispatch the change event    
        // TODO does this action actually need the color (like stroke does, we think)
        _fillChangeDispatch.call(this,
            document,
            fillIndex,
            {enabled: enabled, color: color},
            events.fills.FILL_ENABLED_CHANGED);

        var layerRef = contentLayerLib.referenceBy.current,
            fillObj = contentLayerLib.setShapeFillTypeSolidColor(layerRef, enabled ? color : null);

        return descriptor.playObject(fillObj);
    };

    /**
     * Set the color of the fill for all selected layers of the given document
     * 
     * @param {Document} document
     * @param {number} fillIndex index of the fill within the layer(s)
     * @param {Color} color
     * @return {Promise}
     */
    var setFillColorCommand = function (document, fillIndex, color) {
        // dispatch the change event    
        _fillChangeDispatch.call(this,
            document,
            fillIndex,
            {color: color},
            events.fills.FILL_COLOR_CHANGED);
        
        // build the playObject
        var contentLayerRef = contentLayerLib.referenceBy.current,
            layerRef = layerLib.referenceBy.current,
            fillColorObj = contentLayerLib.setShapeFillTypeSolidColor(contentLayerRef, color),
            fillOpacityObj = layerLib.setFillOpacity(layerRef, color.a * 100);

        // submit to Ps
        return descriptor.batchPlayObjects([fillColorObj, fillOpacityObj]);
        
    };

    /**
     * Set the opacity of the fill for all selected layers of the given document
     * If only changing the alpha, this has a slight savings over setFillColorCommand by only using one adapter call
     * 
     * @param {Document} document
     * @param {number} fillIndex index of the fill within the layer(s)
     * @param {number} opacity opacity (alpha) [0,1]
     * @return {Promise}
     */
    var setFillOpacityCommand = function (document, fillIndex, opacity) {
        // dispatch the change event    
        _fillChangeDispatch.call(this,
            document,
            fillIndex,
            {opacity: opacity},
            events.fills.FILL_OPACITY_CHANGED);
        
        // build the playObject
        var layerRef = layerLib.referenceBy.current,
            fillObj = layerLib.setFillOpacity(layerRef, opacity * 100);

        // submit to Ps
        return descriptor.playObject(fillObj);
        
    };

    /**
     * Add a new fill to the selected layers of the specified document.  color is optional.
     *
     * @param {Document} document
     * @param {?Color} color optional color of the fill to be added. Default black
     */
    var addFillCommand = function (document, color) {
        // build the playObject
        var contentLayerRef = contentLayerLib.referenceBy.current,
            fillObj = contentLayerLib.setShapeFillTypeSolidColor(contentLayerRef, color || {r: 0, g: 0, b: 0, a: 1});

        return descriptor.playObject(fillObj)
            .bind(this)
            .then(function (playResponse) {
                // dispatch information about the newly created stroke
                var payload = {
                        documentID: document.id,
                        layerIDs: _.pluck(document.getSelectedLayers(), "id"),
                        playResponse: playResponse
                    };
                this.dispatch(events.fills.FILL_ADDED, payload);
            });
    };

    var removeFillCommand = function (document) {
        return !!document;
    };


    // STROKE
    var toggleStrokeEnabled = {
        command: toggleStrokeEnabledCommand,
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

    var addStroke = {
        command: addStrokeCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    // FILL
    var toggleFillEnabled = {
        command: toggleFillEnabledCommand,
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

    var removeFill = {
        command: removeFillCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };


    exports.toggleStrokeEnabled = toggleStrokeEnabled;
    exports.setStrokeWidth = setStrokeWidth;
    exports.setStrokeColor = setStrokeColor;
    exports.addStroke = addStroke;

    exports.toggleFillEnabled = toggleFillEnabled;
    exports.setFillColor = setFillColor;
    exports.setFillOpacity = setFillOpacity;
    exports.addFill = addFill;
    exports.removeFill = removeFill;

});
