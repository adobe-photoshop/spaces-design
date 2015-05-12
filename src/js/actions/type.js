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
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer");

    var layerActions = require("./layers"),
        events = require("../events"),
        locks = require("js/locks"),
        collection = require("js/util/collection"),
        locking = require("js/util/locking"),
        math = require("js/util/math"),
        strings = require("i18n!nls/strings");

    /**
     * Minimum and maximum Photoshop-supported font sizes
     * 
     * @const
     * @type {number} 
     */
    var PS_MIN_FONT_SIZE = 0.04,
        PS_MAX_FONT_SIZE = 5400;

    /**
     * play/batchPlay options that allow the canvas to be continually updated, 
     * and history state to be consolidated 
     *
     * @private
     * @param {number} documentID
     * @param {string} name localized name to put into the history state
     * @param {boolean=} coalesce Whether to coalesce this operations history state
     * @return {object} options
     */
    var _getTypeOptions = function (documentID, name, coalesce) {
        return {
            paintOptions: {
                immediateUpdate: true,
                quality: "draft"
            },
            historyStateInfo: {
                name: name,
                target: documentLib.referenceBy.id(documentID),
                coalesce: !!coalesce,
                suppressHistoryStateNotification: !!coalesce
            },
            canExecuteWhileModal: true,
            ignoreTargetWhenModal: true
        };
    };

    /**
     * Update the post script (in terms of a type family and type style) of the given
     * layers in the given document.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {string} postscript Post script name of the described typeface
     * @param {string} family The type face family name, e.g., "Helvetica Neue"
     * @param {string} style The type face style name, e.g., "Oblique"
     * @return {Promise}
     */
    var updatePostScript = function (document, layers, postscript, family, style) {
        var layerIDs = collection.pluck(layers, "id");

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            postscript: postscript,
            family: family,
            style: style
        };

        return this.dispatchAsync(events.document.TYPE_FACE_CHANGED, payload);
    };
    updatePostScript.reads = [locks.JS_APP, locks.JS_TOOL];
    updatePostScript.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    updatePostScript.modal = true;

    /**
     * Set the post script (in terms of a type family and type style) of the given
     * layers in the given document. This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {string} postscript Post script name of the described typeface
     * @param {string} family The type face family name, e.g., "Helvetica Neue"
     * @param {string} style The type face style name, e.g., "Oblique"
     * @return {Promise}
     */
    var setPostScript = function (document, layers, postscript, family, style) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var setFacePlayObject = textLayerLib.setPostScript(layerRefs, postscript),
            typeOptions = _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_FACE),
            setFacePromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false })
                .bind(this)
                .then(function () {
                    locking.playWithLockOverride(document, layers, setFacePlayObject, typeOptions);
                });

        var dispatchPromise = updatePostScript.call(this, document, layers, postscript, family, style);

        return Promise.join(dispatchPromise,
                setFacePromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setPostScript.reads = [locks.JS_APP, locks.JS_TOOL];
    setPostScript.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    setPostScript.modal = true;

    /**
     * Update the type face (in terms of a type family and type style) of the given
     * layers in the given document. 
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {string} family The type face family name, e.g., "Helvetica Neue"
     * @param {string} style The type face style name, e.g., "Oblique"
     * @return {Promise}
     */
    var updateFace = function (document, layers, family, style) {
        var layerIDs = collection.pluck(layers, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                family: family,
                style: style
            };

        return this.dispatchAsync(events.document.TYPE_FACE_CHANGED, payload);
    };
    updateFace.reads = [locks.JS_APP, locks.JS_TOOL];
    updateFace.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    updateFace.modal = true;

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
    var setFace = function (document, layers, family, style) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var setFacePlayObject = textLayerLib.setFace(layerRefs, family, style),
            typeOptions = _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_FACE),
            setFacePromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false })
                .bind(this)
                .then(function () {
                    locking.playWithLockOverride(document, layers, setFacePlayObject, typeOptions);
                });

        var dispatchPromise = updateFace.call(this, document, layers, family, style);

        return Promise.join(dispatchPromise,
                setFacePromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setFace.reads = [locks.JS_APP, locks.JS_TOOL];
    setFace.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    setFace.modal = true;

    /**
     * Update the type of the given layers in the given document. The alpha value of
     * the color is used to adjust the opacity of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {Color} color
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var updateColor = function (document, layers, color, coalesce) {
        var layerIDs = collection.pluck(layers, "id"),
            normalizedColor = null;
        if (color !== null) {
            normalizedColor = color.normalizeAlpha();
        }
        var payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                color: normalizedColor,
                calesce: coalesce
            };
        return this.dispatchAsync(events.document.history.optimistic.TYPE_COLOR_CHANGED, payload);
    };
    updateColor.reads = [];
    updateColor.writes = [locks.PS_DOC, locks.JS_DOC];
    updateColor.modal = true;

    /**
     * Set the type of the given layers in the given document. The alpha value of
     * the color is used to adjust the opacity of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {Color} color
     * @param {boolean=} coalesce Whether to coalesce this operation's history state
     * @param {boolean=} ignoreAlpha Whether to ignore the alpha value of the
     *  given color and only update the opaque color value.
     * @return {Promise}
     */
    var setColor = function (document, layers, color, coalesce, ignoreAlpha) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            normalizedColor = color.normalizeAlpha(),
            opaqueColor = normalizedColor.opaque(),
            playObject = textLayerLib.setColor(layerRefs, opaqueColor),
            typeOptions = _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_COLOR, coalesce);

        if (!ignoreAlpha) {
            var opacity = Math.round(normalizedColor.opacity),
                setOpacityPlayObjects = layers.map(function (layer) {
                    var layerRef = [
                        documentLib.referenceBy.id(document.id),
                        layerLib.referenceBy.id(layer.id)
                    ];

                    return layerLib.setOpacity(layerRef, opacity);
                }).toArray();

            playObject = [playObject].concat(setOpacityPlayObjects);
        }

        var setColorPromise = locking.playWithLockOverride(document, layers, playObject, typeOptions),
            dispatchPromise = updateColor.call(this, document, layers, color, coalesce, ignoreAlpha);

        return Promise.join(dispatchPromise, setColorPromise);
    };
    setColor.reads = [];
    setColor.writes = [locks.PS_DOC, locks.JS_DOC];
    setColor.modal = true;

    /**
     * Update our type size to reflect the type size of the given layers in the given document.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {number} size The type size in pixels, e.g., 72
     * @return {Promise}
     */
    var updateSize = function (document, layers, size) {
        var layerIDs = collection.pluck(layers, "id");

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            size: size
        };
    
        return this.dispatchAsync(events.document.TYPE_SIZE_CHANGED, payload);
    };

    updateSize.reads = [];
    updateSize.writes = [locks.PS_DOC, locks.JS_DOC];
    updateSize.modal = true;
    /**
     * Set the type size of the given layers in the given document. This triggers
     * a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {number} size The type size in pixels, e.g., 72
     * @return {Promise}
     */
    var setSize = function (document, layers, size) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        // Ensure that size does not exceed PS font size bounds
        size = math.clamp(size, PS_MIN_FONT_SIZE, PS_MAX_FONT_SIZE);

        var setSizePlayObject = textLayerLib.setSize(layerRefs, size, "px"),
            typeOptions = _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_SIZE),
            setSizePromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false })
                .bind(this)
                .then(function () {
                    locking.playWithLockOverride(document, layers, setSizePlayObject, typeOptions);
                });

        

        var dispatchPromise = updateSize.call(this, document, layers, size);

        return Promise.join(dispatchPromise,
                setSizePromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setSize.reads = [locks.JS_APP, locks.JS_TOOL];
    setSize.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    setSize.modal = true;
    
    /**
     * Update the tracking value (aka letter-spacing) of the given layers in the given document.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {number} tracking The tracking value
     * @return {Promise}
     */
    var updateTracking = function (document, layers, tracking) {
        var layerIDs = collection.pluck(layers, "id"),
            payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            tracking: tracking
        };

        return this.dispatchAsync(events.document.TYPE_TRACKING_CHANGED, payload);
    };

    updateTracking.reads = [locks.JS_APP, locks.JS_TOOL];
    updateTracking.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    updateTracking.modal = true;

    /**
     * Set the tracking value (aka letter-spacing) of the given layers in the given document.
     * This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {number} tracking The tracking value
     * @return {Promise}
     */
    var setTracking = function (document, layers, tracking) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            psTracking = tracking / 1000; // PS expects tracking values that are 1/1000 what is shown in the UI

        var setTrackingPlayObject = textLayerLib.setTracking(layerRefs, psTracking),
            typeOptions = _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_TRACKING),
            setTrackingPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false })
                .bind(this)
                .then(function () {
                    locking.playWithLockOverride(document, layers, setTrackingPlayObject, typeOptions);
                });

        var dispatchPromise = updateTracking.call(this, document, layers, tracking);

        return Promise.join(dispatchPromise,
            setTrackingPromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setTracking.reads = [locks.JS_APP, locks.JS_TOOL];
    setTracking.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    setTracking.modal = true;

    /**
     * Update the leading value (aka line-spacing) of the given layers in the given document.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {?number} leading The leading value in pixels, or if null then auto.
     * @return {Promise}
     */
    var updateLeading = function (document, layers, leading) {
        var layerIDs = collection.pluck(layers, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                leading: leading
            };
        return this.dispatchAsync(events.document.TYPE_LEADING_CHANGED, payload);
    };
    updateLeading.reads = [locks.JS_APP, locks.JS_TOOL];
    updateLeading.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    updateLeading.modal = true;

    /**
     * Set the leading value (aka line-spacing) of the given layers in the given document.
     * This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {?number} leading The leading value in pixels, or if null then auto.
     * @return {Promise}
     */
    var setLeading = function (document, layers, leading) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            autoLeading = leading === null;

        var setLeadingPlayObject = textLayerLib.setLeading(layerRefs, autoLeading, leading, "px"),
            typeOptions = _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_LEADING),
            setLeadingPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false })
                .bind(this)
                .then(function () {
                    locking.playWithLockOverride(document, layers, setLeadingPlayObject, typeOptions);
                });

        var dispatchPromise = updateLeading.call(this, document, layers, leading);

        return Promise.join(dispatchPromise,
            setLeadingPromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setLeading.reads = [locks.JS_APP, locks.JS_TOOL];
    setLeading.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    setLeading.modal = true;

    /**
     * Update the paragraph alignment of the given layers in the given document.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {string} alignment The alignment kind
     * @return {Promise}
     */
    var updateAlignment = function (document, layers, alignment) {
        var layerIDs = collection.pluck(layers, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                alignment: alignment
            };
        return this.dispatchAsync(events.document.TYPE_ALIGNMENT_CHANGED, payload);
    };
    updateAlignment.reads = [locks.JS_APP, locks.JS_TOOL];
    updateAlignment.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    updateAlignment.modal = true;

    /**
     * Set the paragraph alignment of the given layers in the given document.
     * This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {string} alignment The alignment kind
     * @return {Promise}
     */
    var setAlignment = function (document, layers, alignment) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var setAlignmentPlayObject = textLayerLib.setAlignment(layerRefs, alignment),
            typeOptions = _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_ALIGNMENT),
            setAlignmentPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false })
                .bind(this)
                .then(function () {
                    locking.playWithLockOverride(document, layers, setAlignmentPlayObject, typeOptions);
                });

  
        var dispatchPromise = updateAlignment.call(this, document, layers, alignment);

        return Promise.join(dispatchPromise,
            setAlignmentPromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setAlignment.reads = [locks.JS_APP, locks.JS_TOOL];
    setAlignment.writes = [locks.PS_DOC, locks.JS_DOC, locks.PS_APP, locks.JS_POLICY];
    setAlignment.modal = true;

    /**
     * Initialize the list of installed fonts from Photoshop.
     *
     * @private
     * @return {Promise}
     */
    var initFontList = function () {
        return descriptor.getProperty("application", "fontList")
            .bind(this)
            .then(this.dispatch.bind(this, events.font.INIT_FONTS));
    };
    initFontList.reads = [locks.PS_APP];
    initFontList.writes = [locks.JS_TYPE];
    initFontList.modal = true;

    exports.setPostScript = setPostScript;
    exports.updatePostScript = updatePostScript;
    exports.setFace = setFace;
    exports.updateFace = updateFace;
    exports.setColor = setColor;
    exports.updateColor = updateColor;
    exports.setSize = setSize;
    exports.updateSize = updateSize;
    exports.setTracking = setTracking;
    exports.updateTracking = updateTracking;
    exports.setLeading = setLeading;
    exports.updateLeading = updateLeading;
    exports.setAlignment = setAlignment;
    exports.initFontList = initFontList;
    exports.updateAlignment = updateAlignment;
});
