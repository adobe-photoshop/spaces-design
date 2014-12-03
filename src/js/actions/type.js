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

    var Promise = require("bluebird"),
        _ = require("lodash");

    var textLayerLib = require("adapter/lib/textLayer"),
        descriptor = require("adapter/ps/descriptor"),
        documentActions = require("./documents"),
        layerActions = require("./layers"),
        events = require("../events"),
        locks = require("js/locks");

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
                this.dispatch(events.type.INIT_FONTS, result.value);
            });
    };

    /**
     * Set the type face (in terms of a type family and type style) of the given
     * layers in the given document. This causes a layer bounds update.
     *
     * @param {Document} document
     * @param {Array.<Layers>} layers
     * @param {string} family The type face family name, e.g., "Helvetica Neue"
     * @param {string} style The type face style name, e.g., "Oblique"
     * @return {Promise}
     */
    var setFaceCommand = function (document, layers, family, style) {
        var payload = {
            documentID: document.id,
            layerIDs: _.pluck(layers, "id"),
            family: family,
            style: style
        };
        this.dispatch(events.type.FACE_CHANGED, payload);

        var layerRefs = layers.map(function (layer) {
            return textLayerLib.referenceBy.id(layer.id);
        });

        var setTextPlayObject = textLayerLib.setFace(layerRefs, family, style);
        return descriptor.playObject(setTextPlayObject)
            .bind(this)
            .then(function () {
                // FIXME: This is ONLY to update the layer bounds. Ideally there
                // would be a lighter-weight action for this.
                return this.transfer(documentActions.updateDocument, document.id);
            });
    };

    /**
     * Set the type of the given layers in the given document. The alpha value of
     * the color is used to adjust the opacity of the given layers.
     *
     * @param {Document} document
     * @param {Array.<Layers>} layers
     * @param {Color} color
     * @return {Promise}
     */
    var setColorCommand = function (document, layers, color) {
        var payload = {
            documentID: document.id,
            layerIDs: _.pluck(layers, "id"),
            color: color
        };
        this.dispatch(events.type.COLOR_CHANGED, payload);

        var layerRefs = layers.map(function (layer) {
            return textLayerLib.referenceBy.id(layer.id);
        });

        var setColorPlayObject = textLayerLib.setColor(layerRefs, color),
            setColorPromise = descriptor.playObject(setColorPlayObject);

        var opacity = Math.round(color.a * 100),
            opacityPromise = this.transfer(layerActions.setOpacity, document, layers, opacity);

        return Promise.join(setColorPromise, opacityPromise);
    };

    /**
     * Set the type size of the given layers in the given document. This causes
     * a layer bounds update.
     *
     * @param {Document} document
     * @param {Array.<Layers>} layers
     * @param {number} size The type size in pixels, e.g., 72
     * @return {Promise}
     */
    var setSizeCommand = function (document, layers, size) {
        var payload = {
            documentID: document.id,
            layerIDs: _.pluck(layers, "id"),
            size: size
        };
        this.dispatch(events.type.SIZE_CHANGED, payload);

        var layerRefs = layers.map(function (layer) {
            return textLayerLib.referenceBy.id(layer.id);
        });

        var setSizePlayObject = textLayerLib.setSize(layerRefs, size, "px");
        return descriptor.playObject(setSizePlayObject)
            .bind(this)
            .then(function () {
                // FIXME: See note in setFaceCommand
                return this.transfer(documentActions.updateDocument, document.id);
            });
    };

    /**
     * Initialize the list of system fonts.
     * 
     * @return {Promise}
     */
    var onStartupCommand = function () {
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
    var onStartup = {
        command: onStartupCommand,
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
    exports.onStartup = onStartup;
    exports.onReset = onReset;
});
