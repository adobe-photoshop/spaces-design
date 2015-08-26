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
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer");

    var layerActions = require("./layers"),
        events = require("../events"),
        locks = require("js/locks"),
        collection = require("js/util/collection"),
        locking = require("js/util/locking"),
        math = require("js/util/math"),
        strings = require("i18n!nls/strings"),
        layerActionsUtil = require("js/util/layeractions");

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
        var layerIDs = collection.pluck(layers, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                postscript: postscript,
                family: family,
                style: style
            };

        return this.dispatchAsync(events.document.TYPE_FACE_CHANGED, payload);
    };
    updatePostScript.reads = [];
    updatePostScript.writes = [locks.JS_DOC];
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
                }),
            updatePromise = this.transfer(updatePostScript, document, layers, postscript, family, style);

        return Promise.join(updatePromise, setFacePromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setPostScript.reads = [locks.JS_DOC];
    setPostScript.writes = [locks.PS_DOC, locks.JS_UI];
    setPostScript.transfers = [updatePostScript, layerActions.resetBounds];
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
    updateFace.reads = [];
    updateFace.writes = [locks.JS_DOC];
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
                }),
            updatePromise = this.transfer(updateFace, document, layers, family, style);

        return Promise.join(updatePromise, setFacePromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setFace.reads = [locks.JS_DOC];
    setFace.writes = [locks.JS_UI, locks.PS_DOC];
    setFace.transfers = [updateFace, layerActions.resetBounds];
    setFace.modal = true;

    /**
     * Update the type of the given layers in the given document. The alpha value of
     * the color is used to adjust the opacity of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {Color} color
     * @param {boolean=} optimisticHistory Whether this event will be included in our history model
     * @param {boolean=} options.coalesce Whether to coalesce this operation's history state
     * @param {boolean=} options.ignoreAlpha
     * @return {Promise}
     */
    var updateColor = function (document, layers, color, optimisticHistory, options) {
        var layerIDs = collection.pluck(layers, "id"),
            normalizedColor = null;

        if (color !== null) {
            normalizedColor = color.normalizeAlpha();
        }

        var payload = {
            documentID: document.id,
            layerIDs: layerIDs,
            color: normalizedColor,
            coalesce: options.coalesce,
            ignoreAlpha: options.ignoreAlpha
        };

        if (optimisticHistory) {
            return this.dispatchAsync(events.document.history.optimistic.TYPE_COLOR_CHANGED, payload);
        } else {
            return this.dispatchAsync(events.document.history.amendment.TYPE_COLOR_CHANGED, payload);
        }
    };
    updateColor.reads = [];
    updateColor.writes = [locks.JS_DOC];
    updateColor.modal = true;

    /**
     * Set the type of the given layers in the given document. The alpha value of
     * the color is used to adjust the opacity of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {Color} color
     * @param {boolean=} options.coalesce Whether to coalesce this operation's history state
     * @param {boolean=} options.ignoreAlpha Whether to ignore the alpha value of the
     *  given color and only update the opaque color value.
     * @return {Promise}
     */
    var setColor = function (document, layers, color, options) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            normalizedColor = color.normalizeAlpha(),
            opaqueColor = normalizedColor.opaque(),
            playObject = textLayerLib.setColor(layerRefs, opaqueColor),
            typeOptions = _.merge(options,
                _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_COLOR, options.coalesce));

        if (!options.ignoreAlpha) {
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
        
        var updatePromise = this.transfer(updateColor, document, layers, color, true, options),
            setColorPromise = layerActionsUtil.playSimpleLayerActions(document, layers, playObject, true, typeOptions);

        return Promise.join(updatePromise, setColorPromise);
    };
    setColor.reads = [locks.JS_DOC];
    setColor.writes = [locks.PS_DOC];
    setColor.transfers = [updateColor];
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
        var layerIDs = collection.pluck(layers, "id"),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                size: size
            };
    
        return this.dispatchAsync(events.document.TYPE_SIZE_CHANGED, payload);
    };

    updateSize.reads = [];
    updateSize.writes = [locks.JS_DOC];
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
                }),
            updatePromise = this.transfer(updateSize, document, layers, size);

        return Promise.join(updatePromise, setSizePromise,
            function () {
                return this.transfer(layerActions.resetBounds, document, layers);
            }.bind(this));
    };
    setSize.reads = [locks.JS_DOC];
    setSize.writes = [locks.JS_UI, locks.PS_DOC];
    setSize.transfers = [updateSize, layerActions.resetBounds];
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

    updateTracking.reads = [];
    updateTracking.writes = [locks.JS_DOC];
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
                }),
            updatePromise = this.transfer(updateTracking, document, layers, tracking);

        return Promise.join(updatePromise, setTrackingPromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setTracking.reads = [locks.JS_DOC];
    setTracking.writes = [locks.PS_DOC, locks.JS_UI];
    setTracking.transfers = [updateTracking, layerActions.resetBounds];
    setTracking.modal = true;

    /**
     * Update the leading value (aka line-spacing) of the given layers in the given document.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {number} leading The leading value in pixels, or if null then auto.
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
    updateLeading.reads = [];
    updateLeading.writes = [locks.JS_DOC];
    updateLeading.modal = true;

    /**
     * Set the leading value (aka line-spacing) of the given layers in the given document.
     * This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {number} leading The leading value in pixels, or if null then auto.
     * @return {Promise}
     */
    var setLeading = function (document, layers, leading) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            autoLeading = leading === -1;

        if (!autoLeading && leading < 0.1) {
            leading = 0.1;
        }

        var setLeadingPlayObject = textLayerLib.setLeading(layerRefs, autoLeading, leading, "px"),
            typeOptions = _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_LEADING),
            setLeadingPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false })
                .bind(this)
                .then(function () {
                    locking.playWithLockOverride(document, layers, setLeadingPlayObject, typeOptions);
                }),
            updatePromise = this.transfer(updateLeading, document, layers, leading);

        return Promise.join(updatePromise, setLeadingPromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setLeading.reads = [locks.JS_DOC];
    setLeading.writes = [locks.PS_DOC, locks.JS_UI];
    setLeading.transfers = [updateLeading, layerActions.resetBounds];
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
    updateAlignment.reads = [];
    updateAlignment.writes = [locks.JS_DOC];
    updateAlignment.modal = true;

    /**
     * Set the paragraph alignment of the given layers in the given document.
     * This triggers a layer bounds update.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {string} alignment The alignment kind
     * @param {object} options Batch play options
     * @return {Promise}
     */
    var setAlignment = function (document, layers, alignment, options) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray();

        var setAlignmentPlayObject = textLayerLib.setAlignment(layerRefs, alignment),
            typeOptions = _.merge(options,
                _getTypeOptions(document.id, strings.ACTIONS.SET_TYPE_ALIGNMENT)),
            setAlignmentPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false })
                .bind(this)
                .then(function () {
                    locking.playWithLockOverride(document, layers, setAlignmentPlayObject, typeOptions);
                }),
            transferPromise = this.transfer(updateAlignment, document, layers, alignment);

        return Promise.join(transferPromise, setAlignmentPromise,
                function () {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }.bind(this));
    };
    setAlignment.reads = [locks.JS_DOC];
    setAlignment.writes = [locks.PS_DOC, locks.JS_UI];
    setAlignment.transfers = [updateAlignment, layerActions.resetBounds];
    setAlignment.modal = true;

    /**
     * Update the given layer models with all the provided text properties.
     * TODO: Ideally, this would subsume all the other type update actions.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {object} properties May contain properties found in CharacterStyle and ParagraphStyle models
     * @return {Promise}
     */
    var updateProperties = function (document, layers, properties) {
        var payload = {
            documentID: document.id,
            layerIDs: collection.pluck(layers, "id"),
            properties: properties
        };

        return this.dispatchAsync(events.document.TYPE_PROPERTIES_CHANGED, payload);
    };
    updateProperties.reads = [];
    updateProperties.writes = [locks.JS_DOC];
    updateProperties.transfers = [];
    updateProperties.modal = true;

    /**
     * Duplicates the layer effects of the source layer on all the target layers
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} targetLayers
     * @param {Layer} source
     * @return {Promise}
     */
    var duplicateTextStyle = function (document, targetLayers, source) {
        var layerIDs = collection.pluck(targetLayers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            fontStore = this.flux.store("font"),
            typeObject = fontStore.getTypeObjectFromLayer(source),
            applyObj = textLayerLib.applyTextStyle(layerRefs, typeObject);

        return descriptor.playObject(applyObj)
            .bind(this)
            .then(function () {
                return this.transfer(layerActions.resetLayers, document, targetLayers);
            });
    };
    duplicateTextStyle.reads = [locks.JS_TYPE, locks.JS_DOC];
    duplicateTextStyle.writes = [locks.PS_DOC];
    duplicateTextStyle.transfers = [layerActions.resetLayers];
  
    /**
     * Applies the given text style to target layers
     *
     * @param {Document} document
     * @param {?Immutable.Iterable.<Layer>} targetLayers Default is selected layers
     * @param {object} style Style object
     * @param {object} options Batch play options
     * @return {Promise}
     */
    var applyTextStyle = function (document, targetLayers, style, options) {
        targetLayers = targetLayers || document.layers.selected;

        var layerIDs = collection.pluck(targetLayers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            applyObj = textLayerLib.applyTextStyle(layerRefs, style);

        this.dispatchAsync(events.style.HIDE_HUD);
        
        return descriptor.playObject(applyObj, options)
            .bind(this)
            .then(function () {
                return this.transfer(layerActions.resetLayers, document, targetLayers);
            });
    };
    applyTextStyle.reads = [locks.JS_DOC];
    applyTextStyle.writes = [locks.PS_DOC];
    applyTextStyle.transfers = [layerActions.resetLayers];

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
    exports.updateProperties = updateProperties;

    exports.duplicateTextStyle = duplicateTextStyle;
    exports.applyTextStyle = applyTextStyle;
});
