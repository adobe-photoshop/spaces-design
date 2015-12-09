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

    var textLayerLib = require("adapter").lib.textLayer,
        descriptor = require("adapter").ps.descriptor,
        documentLib = require("adapter").lib.document,
        layerLib = require("adapter").lib.layer,
        appLib = require("adapter").lib.application;

    var layerActions = require("./layers"),
        historyActions = require("./history"),
        events = require("../events"),
        locks = require("js/locks"),
        collection = require("js/util/collection"),
        locking = require("js/util/locking"),
        math = require("js/util/math"),
        nls = require("js/util/nls"),
        layerActionsUtil = require("js/util/layeractions"),
        synchronization = require("js/util/synchronization");

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
     * @param {boolean} modal is the app in a modal state
     * @param {boolean=} coalesce Whether to coalesce this operations history state
     * @param {object=} options Inherited into the type options returned, if present
     * @return {object} options
     */
    var _getTypeOptions = function (documentID, name, modal, coalesce, options) {
        var typeOptions = {
            paintOptions: {
                immediateUpdate: true,
                quality: "draft"
            },
            canExecuteWhileModal: true,
            ignoreTargetWhenModal: true
        };

        if (!modal) {
            typeOptions.historyStateInfo = {
                name: name,
                target: documentLib.referenceBy.id(documentID),
                coalesce: !!coalesce,
                suppressHistoryStateNotification: !!coalesce
            };
        }

        return _.merge({}, options, typeOptions);
    };

    /**
     * Based on the modal tool state, return the appropriate history options
     * to be supplied to the dispatch.
     * If we're in a modal state, then we do not create history states for these
     * type property updates
     *
     * @return {object}
     */
    var _getTypeHistoryOptions = function () {
        var modal = this.flux.stores.tool.getModalToolState();

        return {
            newState: !modal,
            ignore: !!modal
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
            historyOptions = _getTypeHistoryOptions.call(this),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                postscript: postscript,
                family: family,
                style: style,
                history: historyOptions
            };

        return this.dispatchAsync(events.document.history.TYPE_FACE_CHANGED, payload);
    };
    updatePostScript.action = {
        reads: [],
        writes: [locks.JS_DOC],
        modal: true
    };

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
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            modal = this.flux.store("tool").getModalToolState();

        var setFacePlayObject = textLayerLib.setPostScript(layerRefs, postscript),
            typeOptions = _getTypeOptions(document.id, nls.localize("strings.ACTIONS.SET_TYPE_FACE"), modal),
            setFacePromise = locking.playWithLockOverride(document, layers, setFacePlayObject, typeOptions),
            updatePromise = this.transfer(updatePostScript, document, layers, postscript, family, style);

        return Promise.join(updatePromise, setFacePromise)
            .bind(this)
            .then(function () {
                if (!modal) {
                    var anylayerTextWarning = layers.some(function (layer) {
                        return layer.textWarningLevel > 0;
                    });
                    if (anylayerTextWarning) {
                        return this.transfer(layerActions.resetLayers, document, layers, true);
                    } else {
                        return this.transfer(layerActions.resetBounds, document, layers);
                    }
                }
            });
    };
    setPostScript.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [updatePostScript, layerActions.resetBounds, layerActions.resetLayers],
        modal: true
    };

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
            historyOptions = _getTypeHistoryOptions.call(this),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                family: family,
                style: style,
                history: historyOptions
            };

        return this.dispatchAsync(events.document.history.TYPE_FACE_CHANGED, payload);
    };
    updateFace.action = {
        reads: [],
        writes: [locks.JS_DOC],
        modal: true
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
    var setFace = function (document, layers, family, style) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            modal = this.flux.store("tool").getModalToolState();

        var setFacePlayObject = textLayerLib.setFace(layerRefs, family, style),
            typeOptions = _getTypeOptions(document.id, nls.localize("strings.ACTIONS.SET_TYPE_FACE"), modal),
            setFacePromise = locking.playWithLockOverride(document, layers, setFacePlayObject, typeOptions),
            updatePromise = this.transfer(updateFace, document, layers, family, style);

        return Promise.join(updatePromise, setFacePromise)
            .bind(this)
            .then(function () {
                if (!modal) {
                    var anylayerTextWarning = layers.some(function (layer) {
                        return layer.textWarningLevel > 0;
                    });
                    if (anylayerTextWarning) {
                        return this.transfer(layerActions.resetLayers, document, layers, true);
                    } else {
                        return this.transfer(layerActions.resetBounds, document, layers);
                    }
                }
            });
    };
    setFace.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [updateFace, layerActions.resetBounds, layerActions.resetLayers],
        modal: true
    };

    /**
     * Update the type of the given layers in the given document. The alpha value of
     * the color is used to adjust the opacity of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {Color} color
     * @param {object} options
     * @param {boolean=} options.coalesce Whether to coalesce this operation's history state
     * @param {boolean=} options.ignoreAlpha
     * @return {Promise}
     */
    var updateColor = function (document, layers, color, options) {
        var layerIDs = collection.pluck(layers, "id"),
            normalizedColor = (color !== null) ? color.normalizeAlpha() : null,
            historyOptions = _getTypeHistoryOptions.call(this),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                color: normalizedColor,
                coalesce: options.coalesce,
                ignoreAlpha: options.ignoreAlpha,
                history: historyOptions
            };

        return this.dispatchAsync(events.document.history.TYPE_COLOR_CHANGED, payload);
    };
    updateColor.action = {
        reads: [],
        writes: [locks.JS_DOC],
        modal: true
    };

    /**
     * Set the type of the given layers in the given document. The alpha value of
     * the color is used to adjust the opacity of the given layers.
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layers>} layers
     * @param {Color} color
     * @param {object} options
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
            modal = this.flux.store("tool").getModalToolState(),
            typeOptions = _getTypeOptions(document.id, nls.localize("strings.ACTIONS.SET_TYPE_COLOR"),
                modal, options.coalesce, options);

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
        
        var updatePromise = this.transfer(updateColor, document, layers, color, options),
            setColorPromise = layerActionsUtil.playSimpleLayerActions(document, layers, playObject, true, typeOptions);

        return Promise.join(updatePromise, setColorPromise)
            .bind(this)
            .then(function () {
                if (!modal) {
                    var anylayerTextWarning = layers.some(function (layer) {
                        return layer.textWarningLevel > 0;
                    });
                    if (anylayerTextWarning) {
                        return this.transfer(layerActions.resetLayers, document, layers, true);
                    }
                }
            });
    };
    setColor.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [updateColor, layerActions.resetLayers],
        modal: true
    };

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
            historyOptions = _getTypeHistoryOptions.call(this),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                size: size,
                history: historyOptions
            };
    
        return this.dispatchAsync(events.document.history.TYPE_SIZE_CHANGED, payload);
    };
    updateSize.action = {
        reads: [],
        writes: [locks.JS_DOC],
        modal: true
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
    var setSize = function (document, layers, size) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            modal = this.flux.store("tool").getModalToolState();

        // Ensure that size does not exceed PS font size bounds
        size = math.clamp(size, PS_MIN_FONT_SIZE, PS_MAX_FONT_SIZE);

        var setSizePlayObject = textLayerLib.setSize(layerRefs, size, "px"),
            typeOptions = _getTypeOptions(document.id, nls.localize("strings.ACTIONS.SET_TYPE_SIZE"), modal),
            setSizePromise = locking.playWithLockOverride(document, layers, setSizePlayObject, typeOptions),
            updatePromise = this.transfer(updateSize, document, layers, size);

        return Promise.join(updatePromise, setSizePromise)
            .bind(this)
            .then(function () {
                if (!modal) {
                    var anylayerTextWarning = layers.some(function (layer) {
                        return layer.textWarningLevel > 0;
                    });
                    if (anylayerTextWarning) {
                        return this.transfer(layerActions.resetLayers, document, layers, true);
                    } else {
                        return this.transfer(layerActions.resetBounds, document, layers);
                    }
                }
            });
    };
    setSize.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [updateSize, layerActions.resetBounds, layerActions.resetLayers],
        modal: true
    };
    
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
            historyOptions = _getTypeHistoryOptions.call(this),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                tracking: tracking,
                history: historyOptions
            };

        return this.dispatchAsync(events.document.history.TYPE_TRACKING_CHANGED, payload);
    };

    updateTracking.action = {
        reads: [],
        writes: [locks.JS_DOC],
        modal: true
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
    var setTracking = function (document, layers, tracking) {
        var layerIDs = collection.pluck(layers, "id"),
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            modal = this.flux.store("tool").getModalToolState(),
            psTracking = tracking / 1000; // PS expects tracking values that are 1/1000 what is shown in the UI

        var setTrackingPlayObject = textLayerLib.setTracking(layerRefs, psTracking),
            typeOptions = _getTypeOptions(document.id, nls.localize("strings.ACTIONS.SET_TYPE_TRACKING"), modal),
            setTrackingPromise = locking.playWithLockOverride(document, layers, setTrackingPlayObject, typeOptions),
            updatePromise = this.transfer(updateTracking, document, layers, tracking);

        return Promise.join(updatePromise, setTrackingPromise)
            .bind(this)
            .then(function () {
                if (!modal) {
                    var anylayerTextWarning = layers.some(function (layer) {
                        return layer.textWarningLevel > 0;
                    });
                    if (anylayerTextWarning) {
                        return this.transfer(layerActions.resetLayers, document, layers, true);
                    } else {
                        return this.transfer(layerActions.resetBounds, document, layers);
                    }
                }
            });
    };
    setTracking.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [updateTracking, layerActions.resetBounds, layerActions.resetLayers],
        modal: true
    };

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
            historyOptions = _getTypeHistoryOptions.call(this),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                leading: leading,
                history: historyOptions
            };

        return this.dispatchAsync(events.document.history.TYPE_LEADING_CHANGED, payload);
    };
    updateLeading.action = {
        reads: [],
        writes: [locks.JS_DOC],
        modal: true
    };

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
            modal = this.flux.store("tool").getModalToolState(),
            autoLeading = leading === -1;

        if (!autoLeading && leading < 0.1) {
            leading = 0.1;
        }

        var setLeadingPlayObject = textLayerLib.setLeading(layerRefs, autoLeading, leading, "px"),
            typeOptions = _getTypeOptions(document.id, nls.localize("strings.ACTIONS.SET_TYPE_LEADING"), modal),
            setLeadingPromise = locking.playWithLockOverride(document, layers, setLeadingPlayObject, typeOptions),
            updatePromise = this.transfer(updateLeading, document, layers, leading);

        return Promise.join(updatePromise, setLeadingPromise).bind(this).then(function () {
            if (!modal) {
                var anylayerTextWarning = layers.some(function (layer) {
                    return layer.textWarningLevel > 0;
                });
                if (anylayerTextWarning) {
                    return this.transfer(layerActions.resetLayers, document, layers, true);
                } else {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }
            }
        });
    };
    setLeading.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [updateLeading, layerActions.resetBounds, layerActions.resetLayers],
        modal: true
    };

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
            historyOptions = _getTypeHistoryOptions.call(this),
            payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                alignment: alignment,
                history: historyOptions
            };

        return this.dispatchAsync(events.document.history.TYPE_ALIGNMENT_CHANGED, payload);
    };
    updateAlignment.action = {
        reads: [],
        writes: [locks.JS_DOC],
        modal: true
    };

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
            layerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            modal = this.flux.store("tool").getModalToolState();

        var setAlignmentPlayObject = textLayerLib.setAlignment(layerRefs, alignment),
            typeOptions = _getTypeOptions(document.id, nls.localize("strings.ACTIONS.SET_TYPE_ALIGNMENT"),
                modal, false, options),
            setAlignmentPromise = locking.playWithLockOverride(document, layers, setAlignmentPlayObject, typeOptions),
            transferPromise = this.transfer(updateAlignment, document, layers, alignment);

        return Promise.join(transferPromise, setAlignmentPromise).bind(this).then(function () {
            if (!modal) {
                var anylayerTextWarning = layers.some(function (layer) {
                    return layer.textWarningLevel > 0;
                });
                if (anylayerTextWarning) {
                    return this.transfer(layerActions.resetLayers, document, layers, true);
                } else {
                    return this.transfer(layerActions.resetBounds, document, layers);
                }
            }
        });
    };
    setAlignment.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [updateAlignment, layerActions.resetBounds, layerActions.resetLayers],
        modal: true
    };

    /**
     * Update the given layer models with all the provided text properties.
     * TODO: Ideally, this would subsume all the other type update actions.
     * Note: this is action does NOT update history
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     * @param {object} properties May contain properties found in CharacterStyle and ParagraphStyle models
     * @return {Promise}
     */
    var updateProperties = function (document, layers, properties) {
        var historyOptions = _getTypeHistoryOptions.call(this),
            payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                properties: properties,
                history: historyOptions
            };

        // The selection change may not yet have completed before the first
        // updateTextProperties event arrives. Hence, we ensure that the text
        // layer is initialized before proceeding.
        return this.transfer(layerActions.initializeLayers, document, layers)
            .bind(this)
            .then(function () {
                this.dispatch(events.document.history.TYPE_PROPERTIES_CHANGED, payload);
            });
    };
    updateProperties.action = {
        reads: [],
        writes: [locks.JS_DOC],
        transfers: [layerActions.initializeLayers],
        modal: true
    };

    /**
     * Applies the given text style to target layers
     *
     * @param {Document} document
     * @param {?Immutable.Iterable.<Layer>} targetLayers Default is selected layers
     * @param {object} style Style object
     * @param {object} actionOptions Batch play options
     * @param {object} options 
     * @param {boolean} options.ignoreAlpha
     * @return {Promise}
     */
    var applyTextStyle = function (document, targetLayers, style, actionOptions, options) {
        actionOptions = _.merge({}, actionOptions);
        options = _.merge({ ignoreAlpha: true }, options);
        targetLayers = targetLayers || document.layers.selected;

        var layerIDs = collection.pluck(targetLayers, "id"),
            textLayerRefs = layerIDs.map(textLayerLib.referenceBy.id).toArray(),
            applyObjects = [],
            modal = this.flux.store("tool").getModalToolState(),
            typeOptions = _getTypeOptions(document.id, nls.localize("strings.ACTIONS.APPLY_TEXT_STYLE"),
                modal, actionOptions.coalesce, actionOptions);

        applyObjects.push(textLayerLib.applyTextStyle(textLayerRefs, style));

        if (style.textAlignment) {
            var alignObj = textLayerLib.setAlignment(textLayerRefs, style.textAlignment);

            applyObjects.push(alignObj);
        }
        
        if (!options.ignoreAlpha && style.color) {
            var normalizedColor = style.color.value.normalizeAlpha(),
                opacity = Math.round(normalizedColor.opacity),
                layerRefs = layerIDs.map(layerLib.referenceBy.id).toArray(),
                opacityPlayObject = layerLib.setOpacity(layerRefs, opacity);
        
            applyObjects.push(opacityPlayObject);
        }
        
        this.dispatchAsync(events.style.HIDE_HUD);
        
        var playPromise = layerActionsUtil.playSimpleLayerActions(document, targetLayers,
                applyObjects, true, typeOptions),
            historyPromise = this.transfer(historyActions.newHistoryState, document.id,
                nls.localize("strings.ACTIONS.APPLY_TEXT_STYLE"));

        return Promise.join(playPromise, historyPromise)
            .bind(this)
            .then(function () {
                return this.transfer(layerActions.resetLayers, document, targetLayers);
            });
    };
    applyTextStyle.action = {
        reads: [locks.JS_DOC],
        writes: [locks.PS_DOC],
        transfers: [historyActions.newHistoryState, layerActions.resetLayers]
    };

    /**
     * Initialize the list of installed fonts from Photoshop.
     *
     * @private
     * @param {boolean=} force If true, re-initialize if necessary.
     * @return {Promise}
     */
    var initFontList = function (force) {
        var fontStore = this.flux.store("font"),
            fontState = fontStore.getState(),
            initialized = fontState.initialized;

        if (initialized && !force) {
            return Promise.resolve();
        }

        // Determine whether to use native or English-only font names
        var englishFontNamesPromise;
        if (fontState.initialized) {
            englishFontNamesPromise = Promise.resolve(fontState.englishFontNames);
        } else {
            englishFontNamesPromise = descriptor.getProperty("application", "typePreferences")
                .get("showEnglishFontNames");
        }

        return englishFontNamesPromise
            .bind(this)
            .then(function (englishFontNames) {
                var fontListPlayObject = appLib.getFontList(englishFontNames);

                return descriptor.playObject(fontListPlayObject)
                    .get("fontList")
                    .bind(this)
                    .then(function (payload) {
                        payload.englishFontNames = englishFontNames;

                        this.dispatch(events.font.INIT_FONTS, payload);
                    });
            })
            .then(function () {
                var resetPromises = this.flux.store("application")
                    .getOpenDocuments()
                    .filter(function (document) {
                        // Skip uninitialized documents
                        return document.layers;
                    })
                    .map(function (document) {
                        var layers = document.layers.all,
                            typeLayers = layers.filter(function (layer) {
                                return layer.isText;
                            });

                        // Fully update selected layers; only update non-lazy properties for unselected layers.
                        return this.transfer(layerActions.resetLayers, document, typeLayers, true, true);
                    }, this)
                    .toArray();

                return Promise.all(resetPromises);
            });
    };
    initFontList.action = {
        reads: [locks.PS_APP],
        writes: [locks.JS_TYPE],
        transfers: [layerActions.resetLayers],
        modal: true
    };

    /**
     * If the font list has already been initialized, re-initialize it in
     * order to pick up added or removed fonts.
     *
     * @private
     */
    var _fontListChangedHandler;

    /**
     * Listen for font-list changes.
     *
     * @return {Promise}
     */
    var beforeStartup = function () {
        _fontListChangedHandler = synchronization.debounce(function () {
            var fontStore = this.flux.store("font"),
                fontState = fontStore.getState(),
                initialized = fontState.initialized;

            if (initialized) {
                return this.whenIdle("type.initFontList", true);
            } else {
                return Promise.resolve();
            }
        }, this, 500);

        descriptor.addListener("fontListChanged", _fontListChangedHandler);

        return Promise.resolve();
    };
    beforeStartup.action = {
        reads: [],
        writes: [],
        modal: []
    };

    /**
     * Initialize the font list when idle.
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        this.whenIdle("type.initFontList");

        return Promise.resolve();
    };
    afterStartup.action = {
        reads: [],
        writes: [],
        modal: []
    };

    /**
     * Remove font-list change listener.
     *
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("fontListChanged", _fontListChangedHandler);
        _fontListChangedHandler = null;

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: [],
        modal: []
    };

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

    exports.applyTextStyle = applyTextStyle;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;
});
