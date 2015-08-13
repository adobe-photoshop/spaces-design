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
        CCLibraries = require("file://shared/libs/cc-libraries-api.min.js");

    var layerLib = require("adapter/lib/layer"),
        libraryLib = require("adapter/lib/libraries"),
        documentLib = require("adapter/lib/document"),
        adapterOS = require("adapter/os");

    var uiUtil = require("js/util/ui"),
        events = require("../events"),
        locks = require("js/locks"),
        layerFXActions = require("./layereffects"),
        layerActions = require("./layers"),
        typeActions = require("./type"),
        shapeActions = require("./shapes"),
        layerActionsUtil = require("js/util/layeractions"),
        strings = require("i18n!nls/strings");

    /**
     * Gets the color of the source layer, or color at the pixel
     * if sourceLayer is not applicable
     *
     * @private
     * @param {Document} doc
     * @param {Layer} sourceLayer
     * @param {number} x
     * @param {number} y
     * @return {Promise.<Array.<Color?>>} Either an array with fill and stroke colors of a shape layer
     *                                           or type color of a type layer and null
     *                                           or the pixel color at the x,y location and null
     */
    var _getSourceColor = function (doc, sourceLayer, x, y) {
        if (!sourceLayer) {
            return Promise.resolve([null, null]);
        }
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerKinds = sourceLayer.layerKinds,
            color = [null, null];

        switch (sourceLayer.kind) {
            case layerKinds.VECTOR:
                color[0] = sourceLayer.fills.first() ? sourceLayer.fills.first().color : null;
                color[1] = sourceLayer.strokes.first() ? sourceLayer.strokes.first().color : null;

                return Promise.resolve(color);
            case layerKinds.TEXT:
                color[0] = sourceLayer.text.characterStyle.color;
                color[0] = color[0] ? color[0].setOpacity(sourceLayer.opacity) : null;

                return Promise.resolve(color);
            default:
                return uiUtil.colorAtPoint(doc.id, coords.x, coords.y, sourceLayer.opacity)
                    .then(function (color) {
                        return [color, null];
                    });
        }
    };

    /**
     * Given the source layer, and all selected layers (targets), calculates which buttons
     * should be visible in the sampler HUD, alongside their colors
     *
     * @param {Document} doc Owner document
     * @param {Layer} source Layer that's being sampled from
     * @param {number} x
     * @param {number} y
     *
     * @return {Promise.<Array.<object>>} Possible sample types
     */
    var _calculateSampleTypes = function (doc, source, x, y) {
        var selectedLayers = doc.layers.selected,
            result = [];

        if (selectedLayers.isEmpty() || !source) {
            return Promise.resolve(result);
        }

        return _getSourceColor.call(this, doc, source, x, y)
            .bind(this)
            .then(function (sourceColors) {
                var typeStyle = null,
                    graphic = null;
                
                // Primary color is always visible, if null, it'll be disabled
                result.push({
                    type: "fillColor",
                    value: sourceColors[0]
                });
                
                // Secondary color only shows up when a shape layer is being sampled
                if (sourceColors[1]) {
                    result.push({
                        type: "strokeColor",
                        value: sourceColors[1]
                    });
                }

                // If source is text and all targets are text, this button will be enabled
                var allTextLayers = selectedLayers.every(function (layer) {
                    return layer.isTextLayer();
                });

                if (source.isTextLayer() && allTextLayers) {
                    var fontStore = this.flux.store("font");

                    typeStyle = fontStore.getTypeObjectFromLayer(source);
                }

                result.push({
                    type: "typeStyle",
                    value: typeStyle
                });

                // If source has no effects, it clears out target
                result.push({
                    type: "layerEffects",
                    value: {
                        innerShadows: source.innerShadows,
                        dropShadows: source.dropShadows
                    }
                });

                // If source is a smart object, and all targets are smart object
                // graphic sampling will be available
                var allSmartObjectLayers = selectedLayers.every(function (layer) {
                    return layer.kind === layer.layerKinds.SMARTOBJECT;
                });

                if (source.kind === source.layerKinds.SMARTOBJECT && allSmartObjectLayers) {
                    graphic = source;
                }

                result.push({
                    type: "graphic",
                    value: graphic
                });

                return result;
            });
    };

    /**
     * Applies the primary property of the layer to
     * the selected layers.
     *
     * Primary properties are:
     * Shape layers: Fill color
     * Pixel layers / smart objects: Pixel color value
     * Type layers: Type color
     *
     * If any of the selected layers are a group, they're skipped (may change)
     *
     * @private
     * @param {Document} doc Selected layers of this document will be sampled into
     * @param {Layer} sourceLayer Layer to be sampled
     * @return {Promise}
     */
    var _sampleLayerPrimary = function (doc, sourceLayer, x, y) {
        if (!sourceLayer) {
            return Promise.resolve();
        }

        return _getSourceColor.call(this, doc, sourceLayer, x, y)
            .bind(this)
            .then(function (sourceColors) {
                if (!sourceColors[0]) {
                    return Promise.resolve();
                }

                return this.transfer(applyColor, doc, null, sourceColors[0]);
            });
    };

    var applyColor = function (doc, layers, color) {
        var targetLayers = layers || doc.layers.selected;

        this.dispatch(events.style.HIDE_HUD);

        if (targetLayers.isEmpty()) {
            return Promise.resolve();
        }
        
        var shapeLayers = Immutable.List(),
            textLayers = Immutable.List();

        targetLayers.forEach(function (layer) {
            if (layer.kind === layer.layerKinds.VECTOR) {
                shapeLayers = shapeLayers.push(layer);
            } else if (layer.kind === layer.layerKinds.TEXT) {
                textLayers = textLayers.push(layer);
            }
        });

        var shapePromise = shapeLayers.isEmpty() ? Promise.resolve() :
                this.transfer(shapeActions.setFillColor, doc, shapeLayers, 0, color, false),
            textPromise = textLayers.isEmpty() ? Promise.resolve() :
                this.transfer(typeActions.setColor, doc, textLayers, color, false, false);

        return Promise.join(shapePromise, textPromise);
    };
    applyColor.reads = [locks.JS_DOC];
    applyColor.writes = [];
    applyColor.transfers = [shapeActions.setFillColor, typeActions.setColor];

    /**
     * Applies the secondary property of the layer to
     * the selected layers.
     *
     * Secondary properties are (as applicable):
     * Shape layers: Effects
     * Pixel layers / smart objects: Effects
     * Type layers: Type style / effects
     *
     * If any of the selected layers are a group, they're skipped (may change)
     *
     * @private
     * @param {Document} doc Selected layers of this document will be sampled into
     * @param {Layer} sourceLayer Layer to be sampled
     * @return {Promise}
     */
    var _sampleLayerSecondary = function (doc, sourceLayer) {
        var selectedLayers = doc.layers.selected;

        if (selectedLayers.isEmpty() || !sourceLayer) {
            return Promise.resolve();
        }
        
        return this.transfer(layerFXActions.duplicateLayerEffects, doc, selectedLayers, sourceLayer);
    };

    /**
     * Process a single click from the sampler tool.
     * Based on the clicked leaf layer type, will sample the property from it
     * 
     * @private
     * @param {Document} doc Document model
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise}
     */
    var click = function (doc, x, y, secondary) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerTree = doc.layers;
        
        return uiUtil.hitTestLayers(doc.id, coords.x, coords.y)
            .bind(this)
            .then(function (hitLayerIDs) {
                var hitLayerMap = new Set(hitLayerIDs.toJS()),
                    clickedLeafLayers = layerTree.leaves.filter(function (layer) {
                        return hitLayerMap.has(layer.id);
                    }),
                    topLayer = clickedLeafLayers.last();

                if (secondary) {
                    return _sampleLayerSecondary.call(this, doc, topLayer);
                } else {
                    return _sampleLayerPrimary.call(this, doc, topLayer, x, y);
                }
            });
    };
    click.reads = [locks.PS_DOC, locks.JS_UI];
    click.writes = [];
    click.transfers = [
        layerFXActions.duplicateLayerEffects,
        shapeActions.setFillColor,
        typeActions.setColor, applyColor
    ];

    /**
     * Emits an event to pop up a HUD for the clicked on layer
     * based on both source and target layers
     *
     * @param {Document} doc Document model
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise}
     */
    var showHUD = function (doc, x, y) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerTree = doc.layers;

        return uiUtil.hitTestLayers(doc.id, coords.x, coords.y)
            .bind(this)
            .then(function (hitLayerIDs) {
                var hitLayerMap = new Set(hitLayerIDs.toJS()),
                    clickedLeafLayers = layerTree.leaves.filter(function (layer) {
                        return hitLayerMap.has(layer.id);
                    }),
                    topLayer = clickedLeafLayers.last();

                return topLayer;
            })
            .then(function (source) {
                return _calculateSampleTypes.call(this, doc, source, x, y);
            })
            .then(function (sampleTypes) {
                var payload = {
                    document: doc,
                    sampleTypes: sampleTypes,
                    x: x,
                    y: y
                };

                return this.dispatchAsync(events.style.SHOW_HUD, payload);
            });
    };
    showHUD.reads = [locks.PS_DOC, locks.JS_UI];
    showHUD.writes = [locks.JS_UI];

    /**
     * Emits an event to hide sampler HUD
     *
     * @return {Promise}
     */
    var hideHUD = function () {
        return this.dispatchAsync(events.style.HIDE_HUD);
    };
    hideHUD.reads = [];
    hideHUD.writes = [locks.JS_UI];
    
    /**
     * Saves the currently selected layer's style in the style store clipboard
     *
     * @param {Document?} document Default is active document
     * @param {Layer?} source Layer to copy style of, default is selected layer
     *
     * @return {Promise}
     */
    var copyLayerStyle = function (document, source) {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.layers.selected;

        document = document || currentDocument;
        source = source || document ? selectedLayers.first() : null;

        if (!source) {
            return Promise.resolve();
        }

        var fillColor = null,
            strokeColor = null,
            typeStyle = null;

        switch (source.kind) {
        case source.layerKinds.VECTOR:
            fillColor = source.fills.first() ? source.fills.first().color : null;
            strokeColor = source.strokes.first() ? source.strokes.first().color : null;

            break;
        case source.layerKinds.TEXT:
            var fontStore = this.flux.store("font");

            fillColor = source.text.characterStyle.color;
            fillColor = fillColor ? fillColor.setOpacity(source.opacity) : null;
            typeStyle = fontStore.getTypeObjectFromLayer(source);

            break;
        }
        
        var payload = {
            style: {
                effects: {
                    innerShadows: source.innerShadows,
                    dropShadows: source.dropShadows
                },
                fillColor: fillColor,
                strokeColor: strokeColor,
                typeStyle: typeStyle
            }
        };

        return this.dispatchAsync(events.style.COPY_STYLE, payload);
    };
    copyLayerStyle.reads = [locks.JS_DOC, locks.JS_APP];
    copyLayerStyle.writes = [locks.JS_STYLE];

    /**
     * Applies the saved layer style to the given layers
     * Fill color applies to text color and vica versa
     * Layer effects are sent across
     * Stroke color is ignored by type layers
     *
     * @param {Document?} document Default is active document
     * @param {Immutable.Iterable.<Layer>?} targetLayers Default is selected layers
     *
     * @return {Promise}
     */
    var pasteLayerStyle = function (document, targetLayers) {
        var applicationStore = this.flux.store("application"),
            currentDocument = applicationStore.getCurrentDocument(),
            selectedLayers = currentDocument.layers.selected;

        document = document || currentDocument;
        targetLayers = targetLayers || document ? selectedLayers : null;

        if (!targetLayers) {
            return Promise.resolve();
        }
        
        var styleStore = this.flux.store("style"),
            style = styleStore.getClipboardStyle(),
            shapeLayers = Immutable.List(),
            textLayers = Immutable.List();

        targetLayers.forEach(function (layer) {
            if (layer.kind === layer.layerKinds.VECTOR) {
                shapeLayers = shapeLayers.push(layer);
            } else if (layer.kind === layer.layerKinds.TEXT) {
                textLayers = textLayers.push(layer);
            }
        });

        var shapeFillPromise = (!style.fillColor || shapeLayers.isEmpty()) ? Promise.resolve() :
                this.transfer(shapeActions.setFillColor, document, shapeLayers, 0, style.fillColor, false),
            shapeStrokePromise = (!style.strokeColor || shapeLayers.isEmpty()) ? Promise.resolve() :
                this.transfer(shapeActions.setStrokeColor, document, shapeLayers, 0, style.strokeColor, false),
            textColorPromise = (!style.fillColor || textLayers.isEmpty()) ? Promise.resolve() :
                this.transfer(typeActions.setColor, document, textLayers, style.fillColor, false, false),
            textStylePromise = (!style.typeStyle || textLayers.isEmpty()) ? Promise.resolve() :
                this.transfer(typeActions.applyTextStyle, document, textLayers, style.typeStyle),
            effectsPromise = !style.effects ? Promise.resolve() :
                this.transfer(layerFXActions.duplicateLayerEffects, document, targetLayers, style.effects);

        return Promise.join(shapeFillPromise, shapeStrokePromise, textColorPromise, textStylePromise, effectsPromise);
    };
    pasteLayerStyle.reads = [locks.JS_DOC, locks.JS_STYLE, locks.JS_APP];
    pasteLayerStyle.writes = [];
    pasteLayerStyle.transfers = [shapeActions.setFillColor, shapeActions.setStrokeColor,
        typeActions.setColor, typeActions.applyTextStyle, layerFXActions.duplicateLayerEffects];

    /**
     * Builds the layerActions object for sampling:
     * a) Exporting the source into a local file / path for replacing
     * b) Replacing all the targets with the source graphic
     * c) Post action to embed them back (only if source is embedded)
     *
     * @param {Document} document
     * @param {Layer} source Must be a smart object layer
     * @param {Immutable.Iterable.<Layer>} targets Must be all smart object layers
     *
     * @return {Immutable.List.<{layer: Layer, playObject: PlayObject | Array.<PlayObject>}>} List
     *                                         ready to pass into layerActionsUtil.playLayerActions
     */
    var _getGraphicSampleActions = function (document, source, targets, sourcePath) {
        var soTypes = source.smartObjectTypes,
            sourceType = source.smartObjectType(),
            postActionObj = null,
            resultActions = [];

        // a) Pre action to export the source if needed
        // We export only if it's embedded
        // For linked smart objects, we'll use the file path
        // For cloud linked smart objects, export promise will provide the replace path
        if (sourceType === soTypes.EMBEDDED) {
            // If source is embedded, we have to embed our targets after replacing
            postActionObj = layerLib.embedLinked();
        
            resultActions.push({
                layer: source,
                playObject: layerLib.exportContents(sourcePath)
            });
        }

        // b) Replace all targets based on target and source type
        if (sourceType !== soTypes.CLOUD_LINKED) {
            // For non cloud SO, it's almost same, except for the Embed action defined in postActionObj
            targets.forEach(function (target) {
                var targetType = target.smartObjectType(),
                    playObjects = [];

                switch (targetType) {
                case soTypes.EMBEDDED:
                case soTypes.LOCAL_LINKED:
                    playObjects.push(layerLib.replaceContents(sourcePath));
                    break;
                case soTypes.CLOUD_LINKED:
                    playObjects.push(layerLib.relinkToFile(sourcePath));
                    break;
                }

                // ESOs auto embed themselves
                if (postActionObj && targetType !== soTypes.EMBEDDED) {
                    playObjects.push(postActionObj);
                }

                resultActions.push({
                    layer: target,
                    playObject: playObjects
                });
            });
        } else {
            // However, for cloud SOs, we use createElement, and let Photoshop deal with relinking
            targets.forEach(function (target) {
                var targetType = target.smartObjectType(),
                reference = source.smartObject.link.elementReference,
                    element = CCLibraries.resolveElementReference(reference),
                    playObjects = [];
                    
                // PS does not allow CLSO to link to another CLSO, so we embed it first as a work around
                if (targetType === soTypes.CLOUD_LINKED) {
                    playObjects.push(layerLib.embedLinked());
                }

                playObjects.push(libraryLib.createElement(document.id, target.id, element, sourcePath));

                if (postActionObj) {
                    playObjects.push(postActionObj);
                }

                resultActions.push({
                    layer: target,
                    playObject: playObjects
                });
            });
        }

        return Immutable.List(resultActions);
    };

    /**
     * Gets the path to the given smart object layer, creating one if necessary
     *
     * @private
     * @param {Document} document Owner document
     * @param {Layer} source Smart object layer
     * @return {Promise.<string>} [description]
     */
    var _getSourcePath = function (document, source) {
        var sourceType = source.smartObjectType();

        switch (sourceType) {
        case source.smartObjectTypes.EMBEDDED:
            var filename = source.smartObject.fileReference;

            return adapterOS.getTempFilename(filename)
                .then(function (pathObj) {
                    return pathObj.path;
                });
        case source.smartObjectTypes.LOCAL_LINKED:
            return Promise.resolve(source.smartObject.link._path);
        case source.smartObjectTypes.CLOUD_LINKED:
            var reference = source.smartObject.link.elementReference,
                element = CCLibraries.resolveElementReference(reference),
                representation = element.getPrimaryRepresentation();

            return Promise.fromNode(function (cb) {
                representation.getContentPath(cb);
            }).then(function (path) {
                return path;
            });
        }
    };

    /**
     * Replaces the graphic of target smart object layers
     * with the graphic of the source smart object layer,
     * casting the smart object type correctly to the source type
     *
     * @param {Document} document [description]
     * @param {Immutable.List.<Layer>} targets Layers to change graphic of
     * @param {Layer} source Smart object layer that the graphic will be taken out of
     *
     * @return {Promise}
     */
    var replaceGraphic = function (document, targets, source) {
        targets = targets || document.layers.selected;

        this.dispatch(events.style.HIDE_HUD);

        var sourceType = source.smartObjectType();

        if (sourceType === null) {
            return Promise.resolve();
        }

        return _getSourcePath(document, source)
            .bind(this)
            .then(function (path) {
                var documentRef = documentLib.referenceBy.id(document.id),
                    options = {
                        paintOptions: {
                            immediateUpdate: true,
                            quality: "draft"
                        },
                        historyStateInfo: {
                            name: strings.ACTIONS.SAMPLE_GRAPHICS,
                            target: documentRef,
                            coalesce: false,
                            suppressHistoryStateNotification: false
                        }
                    },
                    replaceActions = _getGraphicSampleActions(document, source, targets, path);

                return layerActionsUtil.playLayerActions(document, replaceActions, true, options);
            })
            .then(function () {
                return this.transfer(layerActions.resetLayers, document, targets);
            });
    };
    replaceGraphic.reads = [locks.JS_DOC];
    replaceGraphic.writes = [locks.PS_DOC, locks.JS_DOC];
    replaceGraphic.transfers = [layerActions.resetLayers];

    exports.click = click;
    exports.showHUD = showHUD;
    exports.hideHUD = hideHUD;

    exports.applyColor = applyColor;
    exports.copyLayerStyle = copyLayerStyle;
    exports.pasteLayerStyle = pasteLayerStyle;
    exports.replaceGraphic = replaceGraphic;
});
