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

define(function (require, exports, module) {
    "use strict";

    var Immutable = require("immutable");

    var util = require("adapter/util"),
        descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool");

    var Color = require("js/models/color"),
        Tool = require("js/models/tool"),
        shortcuts = require("js/util/shortcuts"),
        log = require("js/util/log");

    /**
     * Layers can be moved using type tool by holding down cmd
     * We need to reset the bounds correctly during this
     */
    var _moveHandler,
        _typeChangedHandler,
        _layerCreatedHandler,
        _layerDeletedHandler;

    /**
     * The createdTextLayer event results in an addLayers action which may or
     * may not replace an empty layer. Whether or not it does is recorded in
     * this variable. If we later receive a deletedTextLayer event, we will
     * only call removeLayer to undo the previous layer addition if there was
     * no replacement. Otherwise, if there was some replacement, we call
     * updateDocument instead becuase it's too hard to figure out what the new
     * correct layer state is.
     *
     * @private
     * @type {boolean}
     */
    var _layersReplaced = false;

    /**
     * Extract style properties from modal text events.
     *
     * @private
     * @param {object} event
     * @return {?object}
     */
    var _getPropertiesFromEvent = function (event) {
        var style = event.currentTextStyle;
        if (!style) {
            return null;
        }

        return {
            textSize: style.hasOwnProperty("size") ? style.size : null,
            postScriptName: style.hasOwnProperty("fontName") ? style.fontName : null,
            color: style.hasOwnProperty("color") ? Color.fromPhotoshopColorObj(style.color, 100) : null,
            tracking: style.hasOwnProperty("tracking") ? style.tracking : null,
            alignment: style.hasOwnProperty("align") ? style.align._value : null,
            leading: style.autoLeading ? -1 : (style.hasOwnProperty("leading") ? style.leading : null)
        };
    };

    /**
     * @implements {Tool}
     * @constructor
     */
    var TypeTool = function () {
        var firstLaunch = true;
            
        var selectHandler = function () {
            // If this is set, means we didn't get to deselect the tool last time
            if (_moveHandler) {
                descriptor.removeListener("move", _moveHandler);
            }
            if (_typeChangedHandler) {
                descriptor.removeListener("updateTextProperties", _typeChangedHandler);
            }
            if (_layerCreatedHandler) {
                descriptor.removeListener("createTextLayer", _layerCreatedHandler);
            }

            _moveHandler = function () {
                var documentStore = this.flux.store("application"),
                    currentDocument = documentStore.getCurrentDocument();

                this.flux.actions.layers.resetBounds(currentDocument, currentDocument.layers.allSelected);
            }.bind(this);
            
            descriptor.addListener("move", _moveHandler);

            _typeChangedHandler = TypeTool.updateTextPropertiesHandler.bind(this);

            descriptor.addListener("updateTextProperties", _typeChangedHandler);

            _layerCreatedHandler = function (event) {
                var applicationStore = this.flux.store("application"),
                    document = applicationStore.getCurrentDocument();

                if (!document) {
                    log.error("Unexpected createTextLayer event: no active document");
                    return;
                }

                var layerID = event.layerID,
                    currentLayer = document.layers.byID(layerID);

                if (currentLayer) {
                    log.warn("Unexpected createTextLayer event for layer " + layerID);
                    this.flux.actions.layers.resetLayers(document, currentLayer);
                } else {
                    _layersReplaced = false;

                    this.flux.actions.layers.addLayers(document, layerID, true)
                        .bind(this)
                        .then(function (layersReplaced) {
                            _layersReplaced = layersReplaced;

                            var properties = _getPropertiesFromEvent(event);
                            if (!properties) {
                                return;
                            }

                            var documentStore = this.flux.store("document"),
                                nextDocument = documentStore.getDocument(document.id),
                                layer = nextDocument.layers.byID(layerID),
                                layers = Immutable.List.of(layer);

                            this.flux.actions.type.updatePropertiesThrottled(document, layers, properties);
                        });
                }
            }.bind(this);
            
            descriptor.addListener("createTextLayer", _layerCreatedHandler);

            _layerDeletedHandler = function (event) {
                var documentStore = this.flux.store("application"),
                    document = documentStore.getCurrentDocument();

                if (!document) {
                    log.error("Unexpected deleteTextLayer event: no active document");
                    return;
                }

                var layerID = event.layerID,
                    layer = document.layers.byID(layerID);

                if (layer) {
                    if (_layersReplaced) {
                        // See comment above at the _layersReplaced declaration
                        this.flux.actions.documents.updateDocument();
                    } else {
                        this.flux.actions.layers.removeLayers(document, layer, true);
                    }
                } else {
                    log.warn("Unexpected deleteTextLayer event for layer " + layerID);
                }
            }.bind(this);
            
            descriptor.addListener("deleteTextLayer", _layerDeletedHandler);

            if (firstLaunch) {
                firstLaunch = false;

                return descriptor.playObject(toolLib.resetTypeTool("left", "Myriad Pro", 16, [0, 0, 0]));
            }
        };

        var deselectHandler = function () {
            descriptor.removeListener("move", _moveHandler);
            descriptor.removeListener("updateTextProperties", _typeChangedHandler);
            descriptor.removeListener("createTextLayer", _layerCreatedHandler);
            descriptor.removeListener("deleteTextLayer", _layerDeletedHandler);
            
            _moveHandler = null;
            _typeChangedHandler = null;
        };

        Tool.call(this, "typeCreateOrEdit", "Type", "typeCreateOrEditTool", selectHandler, deselectHandler);

        this.activationKey = shortcuts.GLOBAL.TOOLS.TYPE;
    };
    util.inherits(TypeTool, Tool);

    /**
     * Handles updateTextProperties events, which are emitted during the type modal
     * tool state to indicate the text properties of the current text selection or
     * cursor position.
     *
     * @static
     * @param {object} event
     */
    TypeTool.updateTextPropertiesHandler = function (event) {
        var documentStore = this.flux.store("application"),
            currentDocument = documentStore.getCurrentDocument(),
            layers = currentDocument.layers.allSelected,
            typeLayers = layers.filter(function (layer) {
                return layer.kind === layer.layerKinds.TEXT;
            });

        if (typeLayers.isEmpty()) {
            return;
        }

        var properties = _getPropertiesFromEvent(event);
        this.flux.actions.type.updatePropertiesThrottled(currentDocument, typeLayers, properties);
    };

    module.exports = TypeTool;
});
