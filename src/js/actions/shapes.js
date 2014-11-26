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
     * Toggles the enabled flag for all selected Layers on a given doc
     * 
     * @param {Document} document
     * @param {number} strokeIndex index of the stroke within the layer
     * @param {Stroke} stroke
     * @param {boolean} enabled
     * @return {Promise}
     */
    var toggleStrokeEnabledCommand = function (document, strokeIndex, stroke, enabled) {
        // dispatch the change event    
        _strokeChangeDispatch.call(this,
            document,
            strokeIndex,
            {enabled: enabled},
            events.strokes.STROKE_ENABLED_CHANGED);

        // TODO This uses the "current" reference.  need to investigate how it behaves with other refs
        var rgb = enabled ? stroke.color : null,
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
                        strokeStyleDescriptor: objUtil.getPath(playResponse, "to.value.strokeStyle")
                    };
                this.dispatch(events.strokes.STROKE_ADDED, payload);
            });
    };


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

    exports.toggleStrokeEnabled = toggleStrokeEnabled;
    exports.setStrokeWidth = setStrokeWidth;
    exports.setStrokeColor = setStrokeColor;
    exports.addStroke = addStroke;

});
