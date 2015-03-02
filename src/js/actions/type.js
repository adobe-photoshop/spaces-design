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

    var Promise = require("bluebird");

    var textLayerLib = require("adapter/lib/textLayer"),
        descriptor = require("adapter/ps/descriptor"),
        layerActions = require("./layers"),
        events = require("../events"),
        locks = require("js/locks"),
        collection = require("js/util/collection"),
        locking = require("js/util/locking");

    /**
     * play/batchPlay options that allow the canvas to be continually updated.
     *
     * @private
     * @type {object}
     */
    var _paintOptions = {
        paintOptions: {
            immediateUpdate: true,
            quality: "draft"
        }
    };

    /**
     * Fetch the the list of installed fonts from Photoshop.
     *
     * @private
     * @return {Promise}
     */
    var _initFonts = function () {
        return descriptor.getProperty("application", "fontList")
            .bind(this)
            .then(function (result) {
                this.dispatch(events.font.INIT_FONTS, result.value);
            });
    };

    /**
     * Set the type face (in terms of a type family and type style) of the given
     * layers in the given document. This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {string} family The type face family name, e.g., "Helvetica Neue"
     * @param {string} style The type face style name, e.g., "Oblique"
     * @return {Promise}
     */
    var setFaceCommand = function (document, layers, family, style) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var setFacePlayObject = textLayerLib.setFace(layerRefs, family, style),
            setFacePromise = locking.playWithLockOverride(document, layers, setFacePlayObject)
                .bind(this)
                .then(function () {
                    return this.transfer(layerActions.resetLayers, document, layers);
                });

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            family: family,
            style: style
        };

        var dispatchPromise = this.dispatchAsync(events.document.TYPE_FACE_CHANGED, payload);

        return Promise.join(dispatchPromise, setFacePromise);
    };

    /**
     * Set the type of the given layers in the given document. The alpha value of
     * the color is used to adjust the opacity of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {Color} color
     * @param {boolean=} ignoreAlpha Whether to ignore the alpha value of the
     *  given color and only update the opaque color value.
     * @return {Promise}
     */
    var setColorCommand = function (document, layers, color, ignoreAlpha) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var normalizedColor = color.normalizeAlpha(),
            opaqueColor = normalizedColor.opaque(),
            setColorPlayObject = textLayerLib.setColor(layerRefs, opaqueColor),
            setColorPromise = locking.playWithLockOverride(document, layers, setColorPlayObject, _paintOptions),
            joinedPromise;

        if (ignoreAlpha) {
            joinedPromise = setColorPromise;
        } else {
            var opacity = Math.round(normalizedColor.opacity),
                opacityPromise = this.transfer(layerActions.setOpacity, document, layers, opacity);

            joinedPromise = Promise.join(setColorPromise, opacityPromise);
        }

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            color: normalizedColor
        };

        var dispatchPromise = this.dispatchAsync(events.document.TYPE_COLOR_CHANGED, payload);

        return Promise.join(dispatchPromise, joinedPromise);
    };

    /**
     * Set the type size of the given layers in the given document. This triggers
     * a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {number} size The type size in pixels, e.g., 72
     * @return {Promise}
     */
    var setSizeCommand = function (document, layers, size) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var setSizePlayObject = textLayerLib.setSize(layerRefs, size, "px"),
            setSizePromise = locking.playWithLockOverride(document, layers, setSizePlayObject)
                .bind(this)
                .then(function () {
                    return this.transfer(layerActions.resetLayers, document, layers);
                });

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            size: size
        };

        var dispatchPromise = this.dispatchAsync(events.document.TYPE_SIZE_CHANGED, payload);

        return Promise.join(dispatchPromise, setSizePromise);
    };

    /**
     * Set the tracking value (aka letter-spacing) of the given layers in the given document.
     * This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {number} tracking The tracking value
     * @return {Promise}
     */
    var setTrackingCommand = function (document, layers, tracking) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var setTrackingPlayObject = textLayerLib.setTracking(layerRefs, tracking),
            setTrackingPromise = locking.playWithLockOverride(document, layers, setTrackingPlayObject)
                .bind(this)
                .then(function () {
                    return this.transfer(layerActions.resetLayers, document, layers);
                });

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            tracking: tracking
        };

        var dispatchPromise = this.dispatchAsync(events.document.TYPE_TRACKING_CHANGED, payload);

        return Promise.join(dispatchPromise, setTrackingPromise);
    };

    /**
     * Set the leading value (aka line-spacing) of the given layers in the given document.
     * This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {?number} leading The leading value in pixels, or if null then auto.
     * @return {Promise}
     */
    var setLeadingCommand = function (document, layers, leading) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            autoLeading = leading === null;

        var setLeadingPlayObject = textLayerLib.setLeading(layerRefs, autoLeading, leading, "px"),
            setLeadingPromise = locking.playWithLockOverride(document, layers, setLeadingPlayObject)
                .bind(this)
                .then(function () {
                    return this.transfer(layerActions.resetLayers, document, layers);
                });

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            leading: leading
        };

        var dispatchPromise = this.dispatchAsync(events.document.TYPE_LEADING_CHANGED, payload);

        return Promise.join(dispatchPromise, setLeadingPromise);
    };

    /**
     * Set the paragraph alignment of the given layers in the given document.
     * This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {string} alignment The alignment kind
     * @return {Promise}
     */
    var setAlignmentCommand = function (document, layers, alignment) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var setAlignmentPlayObject = textLayerLib.setAlignment(layerRefs, alignment),
            setAlignmentPromise = locking.playWithLockOverride(document, layers, setAlignmentPlayObject)
                .bind(this)
                .then(function () {
                    return this.transfer(layerActions.resetLayers, document, layers);
                });

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            alignment: alignment
        };

        var dispatchPromise = this.dispatchAsync(events.document.TYPE_ALIGNMENT_CHANGED, payload);

        return Promise.join(dispatchPromise, setAlignmentPromise);
    };

    /**
     * Initialize the list of system fonts.
     * 
     * @return {Promise}
     */
    var afterStartupCommand = function () {
        return _initFonts.call(this);
    };

    /**
     * Reset the list of system fonts.
     * 
     * @return {Promise}
     */
    var onResetCommand = function () {
        return _initFonts.call(this);
    };

    /**
     * @type {Action}
     */
    var setFace = {
        command: setFaceCommand,
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * @type {Action}
     */
    var setColor = {
        command: setColorCommand,
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * @type {Action}
     */
    var setSize = {
        command: setSizeCommand,
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * @type {Action}
     */
    var setTracking = {
        command: setTrackingCommand,
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * @type {Action}
     */
    var setLeading = {
        command: setLeadingCommand,
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * @type {Action}
     */
    var setAlignment = {
        command: setAlignmentCommand,
        reads: [],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    /**
     * @type {Action}
     */
    var afterStartup = {
        command: afterStartupCommand,
        reads: [locks.PS_APP],
        writes: [locks.JS_TYPE]
    };

    /**
     * @type {Action}
     */
    var onReset = {
        command: onResetCommand,
        reads: [locks.PS_APP],
        writes: [locks.JS_TYPE]
    };

    exports.setFace = setFace;
    exports.setColor = setColor;
    exports.setSize = setSize;
    exports.setTracking = setTracking;
    exports.setLeading = setLeading;
    exports.setAlignment = setAlignment;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;
});
