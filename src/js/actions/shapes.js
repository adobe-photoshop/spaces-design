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
        Immutable = require("immutable"),
        _ = require("lodash");

    var descriptor = require("adapter/ps/descriptor"),
        layerLib = require("adapter/lib/layer"),
        pathLib = require("adapter/lib/path"),
        documentLib = require("adapter/lib/document"),
        contentLayerLib = require("adapter/lib/contentLayer");

    var events = require("../events"),
        locks = require("js/locks"),
        layerActions = require("./layers"),
        collection = require("js/util/collection"),
        layerActionsUtil = require("js/util/layeractions"),
        strings = require("i18n!nls/strings");

    /**
     * Merges shape specific options into given options
     * play/batchPlay options that allow the canvas to be continually updated, 
     * and history state to be consolidated 
     *
     * @private
     * @param {object} options
     * @param {object} documentRef  a reference to the document 
     * @param {string} name localized name to put into the history state
     * @return {object} options
     */
    var _mergeOptions = function (options, documentRef, name) {
        options = options || {
            coalesce: false
        };

        return _.merge(options, {
            paintOptions: {
                immediateUpdate: true,
                quality: "draft"
            },
            historyStateInfo: {
                name: name,
                target: documentRef,
                coalesce: !!options.coalesce,
                suppressHistoryStateNotification: !!options.coalesce
            }
        });
    };

    /**
     * Helper function to generically dispatch strokes update events
     *
     * @private
     * @param {Document} document active Document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {object} strokeProperties a pseudo stroke object containing only new props
     * @param {string} eventName name of the event to emit afterwards
     * @param {boolean=} coalesce optionally include this in the payload to drive history coalescing
     * @return Promise
     */
    var _strokeChangeDispatch = function (document, layers, strokeProperties, eventName, coalesce) {
        var payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                strokeProperties: strokeProperties,
                coalesce: coalesce
            };

        return this.dispatchAsync(eventName, payload);
    };

    /**
     * Helper function to generically dispatch fills update events
     *
     * @private
     * @param {Document} document active Document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {object} fillProperties a pseudo fill object containing only new props
     * @param {string} eventName name of the event to emit afterwards
     * @param {boolean=} coalesce optionally include this in the payload to drive history coalescing
     * @return Promise
     */
    var _fillChangeDispatch = function (document, layers, fillProperties, eventName, coalesce) {
        // TODO layers param needs to be made fa real
        var payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers, "id"),
                fillProperties: fillProperties,
                coalesce: coalesce
            };

        return this.dispatchAsync(eventName, payload);
    };

    /**
     * Test the given layers for the existence of a stroke
     *
     * @private
     * @param {Immutable.Iterable.<Layer>} layers set of layers to test
     *
     * @return {boolean} true if all strokes exist
     */
    var _allStrokesExist = function (layers) {
        return layers.every(function (layer) {
            return layer.stroke;
        });
    };

    /**
     * Make a batch call to photoshop to get the Stroke Style information for the specified layers
     * Use the results to build a payload of strokes to add at the specified index
     *
     * @private
     * @param {Document} document
     * @param {Immutable.Iterable.<Layer>} layers
     *
     * @return {Promise} Promise of the initial batch call to photoshop
     */
    var _refreshStrokes = function (document, layers) {
        var layerIDs = collection.pluck(layers, "id"),
            refs = layerLib.referenceBy.id(layerIDs.toArray());

        return descriptor.batchMultiGetProperties(refs._ref, ["AGMStrokeStyleInfo"])
            .bind(this)
            .then(function (batchGetResponse) {
                if (!batchGetResponse || batchGetResponse.length !== layers.size) {
                    throw new Error("Bad response from photoshop for AGMStrokeStyleInfo batchGet");
                }
                var payload = {
                    documentID: document.id,
                    layerIDs: layerIDs,
                    strokeStyleDescriptor: Immutable.List(_.pluck(batchGetResponse, "AGMStrokeStyleInfo"))
                };
                this.dispatch(events.document.history.nonOptimistic.STROKE_ADDED, payload);
            });
    };

    /**
     * Sets the stroke properties of given layers identical to the given stroke
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {Stroke} stroke Stroke properties to apply
     * @param {boolean=} options.enabled Default true
     * @return {Promise}
     */
    var setStroke = function (document, layers, stroke, options) {
        // if enabled is not provided, assume it is true
        // derive the type of event to be dispatched based on this parameter's existence
        var eventName;

        if (options.enabled === undefined || options.enabled === null) {
            options.enabled = true;
            eventName = events.document.history.optimistic.STROKE_CHANGED;
        } else {
            eventName = events.document.STROKE_ENABLED_CHANGED;
        }

        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setStroke(layerRef, stroke),
            strokeJSObj = stroke.toJS(),
            documentRef = documentLib.referenceBy.id(document.id);

        options = _mergeOptions(options, documentRef, strings.ACTIONS.SET_STROKE);

        if (_allStrokesExist(layers)) {
            // toJS gets rid of color so we re-insert it here
            strokeJSObj.color = stroke.color.normalizeAlpha();
            strokeJSObj.opacity = strokeJSObj.color.a;

            // optimistically dispatch the change event    
            var dispatchPromise = _strokeChangeDispatch.call(this,
                document,
                layers,
                strokeJSObj,
                eventName);

            var strokePromise = layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options);

            // after both, if enabled has potentially changed, transfer to resetBounds
            return Promise.join(dispatchPromise,
                    strokePromise,
                    function () {
                        return this.transfer(layerActions.resetBounds, document, layers);
                    }.bind(this));
        } else {
            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options)
                .bind(this)
                .then(function () {
                    // upon completion, fetch the stroke info for all layers
                    return _refreshStrokes.call(this, document, layers);
                });
        }
    };
    setStroke.reads = [];
    setStroke.writes = [locks.PS_DOC, locks.JS_DOC];
    setStroke.transfers = [layerActions.resetBounds];

    /**
     * Sets the enabled flag for all selected Layers on a given doc.
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {Color} color color of the strokes, since photoshop does not provide a way to simply enable a stroke
     * @param {boolean=} options.enabled
     * @return {Promise}
     */
    var setStrokeEnabled = function (document, layers, color, options) {
        // TODO is it reasonable to not require a color, but instead to derive it here based on the selected layers?
        // the only problem with that is having to define a default color here if none can be derived
        return setStrokeColor.call(this, document, layers, color, options);
    };
    setStrokeEnabled.reads = [];
    setStrokeEnabled.writes = [locks.PS_DOC, locks.JS_DOC];
    setStrokeEnabled.transfers = [layerActions.resetBounds];

    /**
     * Set the color of the stroke for the given layers of the given document
     * If there are selected layers that do not currently have a stroke, then a subsequent call
     * will be made to fetch the stroke style for each layer, and the result will be used to update the stroke store.
     * This is necessary because photoshop does not report the width in the first response
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {Color} color
     * @param {boolean=} option.enabled optional enabled flag, default=true.
     *                                  If supplied, causes a resetBounds afterwards
     * @param {boolean=} options.coalesce Whether to coalesce this operation's history state
     * @param {boolean=} options.ignoreAlpha Whether to ignore the alpha value of the
     *  supplied color and only update the opaque color.
     * @return {Promise}
     */
    var setStrokeColor = function (document, layers, color, options) {
        // if a color is provided, adjust the alpha to one that can be represented as a fraction of 255
        color = color ? color.normalizeAlpha() : null;

        // if enabled is not provided, assume it is true
        // derive the type of event to be dispatched based on this parameter's existence
        var eventName,
            enabledChanging;
        if (options.enabled === undefined || options.enabled === null) {
            options.enabled = true;
            eventName = events.document.history.optimistic.STROKE_COLOR_CHANGED;
        } else {
            eventName = events.document.STROKE_ENABLED_CHANGED;
            enabledChanging = true;
        }

        // remove the alpha component based on ignoreAlpha param
        var psColor = color.toJS();
        if (options.ignoreAlpha) {
            delete psColor.a;
        }

        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setStrokeFillTypeSolidColor(layerRef, options.enabled ? psColor : null),
            documentRef = documentLib.referenceBy.id(document.id);

        options = _mergeOptions(options, documentRef, strings.ACTIONS.SET_STROKE_COLOR);

        if (_allStrokesExist(layers)) {
            // optimistically dispatch the change event    
            var dispatchPromise = _strokeChangeDispatch.call(this,
                document,
                layers,
                { enabled: options.enabled, color: color, ignoreAlpha: options.ignoreAlpha },
                eventName,
                options.coalesce);

            var colorPromise = layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options);

            // after both, if enabled has potentially changed, transfer to resetBounds
            return Promise.join(dispatchPromise,
                    colorPromise,
                    function () {
                        if (enabledChanging) {
                            return this.transfer(layerActions.resetBounds, document, layers);
                        }
                    }.bind(this));
        } else {
            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options)
                .bind(this)
                .then(function () {
                    // upon completion, fetch the stroke info for all layers
                    _refreshStrokes.call(this, document, layers);
                });
        }
    };
    setStrokeColor.reads = [];
    setStrokeColor.writes = [locks.PS_DOC, locks.JS_DOC];
    setStrokeColor.transfers = [layerActions.resetBounds];

    /**
     * Set the alignment of the stroke for all selected layers of the given document.
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {string} alignmentType type as inside,outside, or center
     * @param {object} options
     * @return {Promise}
     */
    var setStrokeAlignment = function (document, layers, alignmentType, options) {
        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setStrokeAlignment(layerRef, alignmentType),
            documentRef = documentLib.referenceBy.id(document.id);

        options = _mergeOptions(options, documentRef, strings.ACTIONS.SET_STROKE_ALIGNMENT);

        if (_allStrokesExist(layers)) {
            // optimistically dispatch the change event    
            var dispatchPromise = _strokeChangeDispatch.call(this,
                    document,
                    layers,
                    { alignment: alignmentType, enabled: true },
                    events.document.STROKE_ALIGNMENT_CHANGED);

            var alignmentPromise = layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options);

            return Promise.join(dispatchPromise,
                alignmentPromise,
                    function () {
                        return this.transfer(layerActions.resetBounds, document, layers);
                    }.bind(this));
        } else {
            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options)
                .bind(this)
                .then(function () {
                    // upon completion, fetch the stroke info for all layers
                    _refreshStrokes.call(this, document, layers);
                });
        }
    };
    setStrokeAlignment.reads = [];
    setStrokeAlignment.writes = [locks.PS_DOC, locks.JS_DOC];
    setStrokeAlignment.transfers = [layerActions.resetBounds];

    /**
     * Set the opacity of the stroke for all selected layers of the given document.
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} opacity opacity as a percentage [0,100]
     * @param {boolean=} options.coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var setStrokeOpacity = function (document, layers, opacity, options) {
        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setStrokeOpacity(layerRef, opacity),
            documentRef = documentLib.referenceBy.id(document.id);

        options = _mergeOptions(options, documentRef, strings.ACTIONS.SET_STROKE_OPACITY);

        if (_allStrokesExist(layers)) {
            // optimistically dispatch the change event    
            var dispatchPromise = _strokeChangeDispatch.call(this,
                document,
                layers,
                { opacity: opacity, enabled: true },
                events.document.history.optimistic.STROKE_OPACITY_CHANGED,
                options.coalesce);

            var opacityPromise = layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options);

            return Promise.join(dispatchPromise, opacityPromise);
        } else {
            // There is an existing photoshop bug that clobbers color when setting opacity
            // on a set of layers that inclues "no stroke" layers.  SO this works as well as it can
            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options)
                .bind(this)
                .then(function () {
                    // upon completion, fetch the stroke info for all layers
                    _refreshStrokes.call(this, document, layers);
                });
        }
    };
    setStrokeOpacity.reads = [locks.PS_DOC, locks.JS_DOC];
    setStrokeOpacity.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the size of the stroke for all selected layers of the given document
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {number} width stroke width, in pixels
     * @param {object} options
     * @return {Promise}
     */
    var setStrokeWidth = function (document, layers, width, options) {
        var layerRef = contentLayerLib.referenceBy.current,
            strokeObj = contentLayerLib.setShapeStrokeWidth(layerRef, width),
            documentRef = documentLib.referenceBy.id(document.id);

        options = _mergeOptions(options, documentRef, strings.ACTIONS.SET_STROKE_WIDTH);

        if (_allStrokesExist(layers)) {
            // dispatch the change event    
            var dispatchPromise = _strokeChangeDispatch.call(this,
                document,
                layers,
                { width: width, enabled: true },
                events.document.STROKE_WIDTH_CHANGED);

            var widthPromise = layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options);

            return Promise.join(dispatchPromise,
                    widthPromise,
                    function () {
                        return this.transfer(layerActions.resetBounds, document, layers);
                    }.bind(this));
        } else {
            return layerActionsUtil.playSimpleLayerActions(document, layers, strokeObj, true, options)
                .bind(this)
                .then(function () {
                    // upon completion, fetch the stroke info for all layers
                    _refreshStrokes.call(this, document, layers);
                });
        }
    };
    setStrokeWidth.reads = [];
    setStrokeWidth.writes = [locks.PS_DOC, locks.JS_DOC];
    setStrokeWidth.transfers = [layerActions.resetBounds];

    /**
     * Set the enabled flag for the given fill of all selected Layers on a given doc
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {Color} color
     * @param {boolean=} options.enabled
     * @return {Promise}
     */
    var setFillEnabled = function (document, layers, color, options) {
        options = _.merge(options, {
            coalesce: false,
            ignoreAlpha: false
        });

        return setFillColor.call(this, document, layers, color, options);
    };
    setFillEnabled.reads = [locks.PS_DOC, locks.JS_DOC];
    setFillEnabled.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the color of the fill for all selected layers of the given document
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers list of layers being updating
     * @param {Color} color
     * @param {boolean=} options.coalesce Whether to coalesce this operation's history state
     * @param {boolean=} options.enabled optional enabled flag, default=true
     * @param {boolean=} options.ignoreAlpha Whether to ignore the alpha value of the
     *  supplied color and only update the opaque color.
     * @return {Promise}
     */
    var setFillColor = function (document, layers, color, options) {
        // if a color is provided, adjust the alpha to one that can be represented as a fraction of 255
        color = color ? color.normalizeAlpha() : null;
        // if enabled is not provided, assume it is true
        options.enabled = (options.enabled === undefined) ? true : options.enabled;

        // dispatch the change event    
        var dispatchPromise = _fillChangeDispatch.call(this,
            document,
            layers,
            { color: color, enabled: options.enabled, ignoreAlpha: options.ignoreAlpha },
            events.document.history.optimistic.FILL_COLOR_CHANGED,
            options.coalesce);

        // build the playObject
        var contentLayerRef = contentLayerLib.referenceBy.current,
            layerRef = layerLib.referenceBy.current,
            fillColorObj = contentLayerLib.setShapeFillTypeSolidColor(contentLayerRef, options.enabled ? color : null),
            documentRef = documentLib.referenceBy.id(document.id);
            
        options = _mergeOptions(options, documentRef, strings.ACTIONS.SET_FILL_COLOR);

        // submit to Ps
        var colorPromise;
        if (options.enabled && !options.ignoreAlpha) {
            var fillOpacityObj = layerLib.setFillOpacity(layerRef, color.opacity);
            colorPromise = layerActionsUtil.playSimpleLayerActions(document, layers, [fillColorObj, fillOpacityObj],
                true, options);
        } else {
            colorPromise = layerActionsUtil.playSimpleLayerActions(document, layers, fillColorObj, true, options);
        }

        return Promise.join(dispatchPromise, colorPromise);
    };
    setFillColor.reads = [locks.PS_DOC, locks.JS_DOC];
    setFillColor.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Set the opacity of the fill for all selected layers of the given document
     * If only changing the alpha, this has a slight savings over setFillColorCommand by only using one adapter call
     * 
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers
     * @param {number} opacity Opacity percentage [0,100]
     * @param {boolean=} options.coalesce Whether to coalesce this operation's history state
     * @return {Promise}
     */
    var setFillOpacity = function (document, layers, opacity, options) {
        // dispatch the change event
        var documentRef = documentLib.referenceBy.id(document.id);
        
        options = _mergeOptions(options, documentRef, strings.ACTIONS.SET_FILL_OPACITY);
            
        // build the playObject
        var dispatchPromise = _fillChangeDispatch.call(this,
                document,
                layers,
                { opacity: opacity, enabled: true },
                events.document.history.optimistic.FILL_OPACITY_CHANGED,
                !!options.coalesce),
            layerRef = layerLib.referenceBy.current,
            fillObj = layerLib.setFillOpacity(layerRef, opacity),
            opacityPromise = layerActionsUtil.playSimpleLayerActions(document, layers, fillObj, true, options);

        return Promise.join(dispatchPromise, opacityPromise);
    };
    setFillOpacity.reads = [locks.PS_DOC, locks.JS_DOC];
    setFillOpacity.writes = [locks.PS_DOC, locks.JS_DOC];

    /**
     * Call the adapter and then transfer to another action to reset layers as necessary
     *
     * If multiple layers are being combined, then the first layer is replaced by fresh 
     * data from photoshop (fetched via index), and the subsumed layers are deleted from the model
     *
     * If there is only one layer, it is simply reset afterwards
     *
     * @private
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers 
     * @param {PlayObject} playObject
     * @return {Promise}
     */
    var _playCombine = function (document, layers, playObject) {
        var deleteLayersPromise;

        if (layers.isEmpty()) {
            return Promise.resolve();
        } else if (layers.size > 1) {
            var payload = {
                documentID: document.id,
                layerIDs: collection.pluck(layers.butLast(), "id")
            };

            deleteLayersPromise = this.dispatchAsync(events.document.DELETE_LAYERS_NO_HISTORY, payload);
        } else {
            deleteLayersPromise = Promise.resolve();
        }

        var options = {
                historyStateInfo: {
                    name: strings.ACTIONS.COMBINE_SHAPES,
                    target: documentLib.referenceBy.id(document.id)
                }
            },
            playPromise = descriptor.playObject(playObject, options);

        return Promise.join(deleteLayersPromise, playPromise)
            .bind(this)
            .then(function () {
                if (layers.size > 1) {
                    // The "highest" layer wins but the resultant layer is shifted down 
                    // by the number of "losing" layers
                    // Important note: the resultant layer has a NEW LAYER ID
                    var winningLayerIndex = document.layers.indexOf(layers.last()),
                        adjustedLayerIndex = winningLayerIndex - layers.size + 1;

                    return this.transfer(layerActions.resetLayersByIndex, document, adjustedLayerIndex);
                } else {
                    return this.transfer(layerActions.resetLayers, document, layers);
                }
            })
            .then(function () {
                // wrap up this operation with a history changing event
                return this.dispatchAsync(events.document.history.nonOptimistic.COMBINE_SHAPES,
                    { documentID: document.id });
            });
    };

    /**
     * Combine paths using UNION operation
     *
     * @param {?Document=} document Default is current document
     * @param {?Immutable.List.<Layer>} layers Default is selected layers
     * @return {Promise}
     */
    var combineUnion = function (document, layers) {
        var appStore = this.flux.store("application");

        document = document || appStore.getCurrentDocument();
        layers = layers || document ? document.layers.selected : null;

        if (!document || !layers || layers.isEmpty()) {
            return Promise.resolve();
        } else if (layers.size === 1) {
            return _playCombine.call(this, document, layers, pathLib.combinePathsUnion());
        } else {
            return _playCombine.call(this, document, layers, pathLib.combineLayersUnion());
        }
    };
    combineUnion.reads = [];
    combineUnion.writes = [locks.PS_DOC, locks.JS_DOC];
    combineUnion.transfers = [layerActions.resetLayers, layerActions.resetLayersByIndex];

    /**
     * Combine paths using SUBTRACT operation
     *
     * @param {?Document} document Default is current document
     * @param {?Immutable.List.<Layer>} layers Default is selected layers
     * @return {Promise}
     */
    var combineSubtract = function (document, layers) {
        var appStore = this.flux.store("application");

        document = document || appStore.getCurrentDocument();
        layers = layers || document ? document.layers.selected : null;

        if (!document || !layers || layers.isEmpty()) {
            return Promise.resolve();
        } else if (layers.size === 1) {
            return _playCombine.call(this, document, layers, pathLib.combinePathsSubtract());
        } else {
            return _playCombine.call(this, document, layers, pathLib.combineLayersSubtract());
        }
    };
    combineSubtract.reads = [];
    combineSubtract.writes = [locks.PS_DOC, locks.JS_DOC];
    combineSubtract.transfers = [layerActions.resetLayers, layerActions.resetLayersByIndex];

    /**
     * Combine paths using INTERSECT operation
     *
     * @param {?Document} document Default is current document
     * @param {?Immutable.List.<Layer>} layers Default is selected layers
     * @return {Promise}
     */
    var combineIntersect = function (document, layers) {
        var appStore = this.flux.store("application");

        document = document || appStore.getCurrentDocument();
        layers = layers || document ? document.layers.selected : null;

        if (!document || !layers || layers.isEmpty()) {
            return Promise.resolve();
        } else if (layers.size === 1) {
            return _playCombine.call(this, document, layers, pathLib.combinePathsIntersect());
        } else {
            return _playCombine.call(this, document, layers, pathLib.combineLayersIntersect());
        }
    };
    combineIntersect.reads = [];
    combineIntersect.writes = [locks.PS_DOC, locks.JS_DOC];
    combineIntersect.transfers = [layerActions.resetLayers, layerActions.resetLayersByIndex];

    /**
     * Combine paths using DIFFERENCE operation
     *
     * @param {?Document} document Default is current document
     * @param {?Immutable.List.<Layer>} layers Default is selected layers
     * @return {Promise}
     */
    var combineDifference = function (document, layers) {
        var appStore = this.flux.store("application");

        document = document || appStore.getCurrentDocument();
        layers = layers || document ? document.layers.selected : null;

        if (!document || !layers || layers.isEmpty()) {
            return Promise.resolve();
        } else if (layers.size === 1) {
            return _playCombine.call(this, document, layers, pathLib.combinePathsDifference());
        } else {
            return _playCombine.call(this, document, layers, pathLib.combineLayersDifference());
        }
    };
    combineDifference.reads = [];
    combineDifference.writes = [locks.PS_DOC, locks.JS_DOC];
    combineDifference.transfers = [layerActions.resetLayers, layerActions.resetLayersByIndex];

    exports.setStrokeEnabled = setStrokeEnabled;
    exports.setStrokeWidth = setStrokeWidth;
    exports.setStrokeColor = setStrokeColor;
    exports.setStrokeOpacity = setStrokeOpacity;
    exports.setStrokeAlignment = setStrokeAlignment;
    exports.setStroke = setStroke;

    exports.setFillEnabled = setFillEnabled;
    exports.setFillColor = setFillColor;
    exports.setFillOpacity = setFillOpacity;

    exports.combineUnion = combineUnion;
    exports.combineSubtract = combineSubtract;
    exports.combineIntersect = combineIntersect;
    exports.combineDifference = combineDifference;
});
