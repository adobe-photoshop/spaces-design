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

    var util = require("adapter/util"),
        descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool"),
        Color = require("js/models/color"),
        Tool = require("js/models/tool");

    /**
     * Layers can be moved using type tool by holding down cmd
     * We need to reset the bounds correctly during this
     */
    var _moveHandler,
        _typeChangedHandler;

    /**
     * @implements {Tool}
     * @constructor
     */
    var TypeTool = function () {
        var resetObj = toolLib.resetTypeTool("left", "Myriad Pro", 16, [0, 0, 0]),
            firstLaunch = true;
            
        var selectHandler = function () {
            // If this is set, means we didn't get to deselect the tool last time
            if (_moveHandler) {
                descriptor.removeListener("move", _moveHandler);
            }
            if (_typeChangedHandler) {
                descriptor.removeListener("updateTextProperties", _typeChangedHandler);
            }

            _moveHandler = function () {
                var documentStore = this.flux.store("application"),
                    currentDocument = documentStore.getCurrentDocument();

                this.flux.actions.layers.resetBounds(currentDocument, currentDocument.layers.allSelected);
            }.bind(this);
            
            descriptor.addListener("move", _moveHandler);

            _typeChangedHandler = function (event) {
                var documentStore = this.flux.store("application"),
                    currentDocument = documentStore.getCurrentDocument(),
                    layers = currentDocument.layers.allSelected,
                    layersAllHaveType = layers.every(function (layer) {
                        return layer.text !== null;
                    });

                if (layersAllHaveType) {
                    if (event.sizeAssigned) {
                        this.flux.actions.type.updateSize(currentDocument, layers, event.size);
                    } else {
                        this.flux.actions.type.updateSize(currentDocument, layers, null);
                    }

                    if (event.fontNameAssigned) {
                        this.flux.actions.type.updatePostScript(currentDocument, layers, event.fontName);
                    } else {
                        this.flux.actions.type.updatePostScript(currentDocument, layers, null);
                    }

                    if (event.colorAssigned) {
                        var color = Color.fromPhotoshopColorObj(event.color, 100);
                        this.flux.actions.type.updateColor(currentDocument, layers, color);
                    } else {
                        this.flux.actions.type.updateColor(currentDocument, layers, null);
                    }

                    if (event.trackingAssigned) {
                        this.flux.actions.type.updateTracking(currentDocument, layers, event.tracking);
                    } else {
                        this.flux.actions.type.updateTracking(currentDocument, layers, null);
                    }

                    if (event.alignAssigned) {
                        this.flux.actions.type.updateAlignment(currentDocument, layers, event.align);
                    } else {
                        this.flux.actions.type.updateAlignment(currentDocument, layers, null);
                    }

                    // set leading to null if autoleading is true
                    if (event.autoLeadingAssigned && event.autoLeading) {
                        this.flux.actions.type.updateLeading(currentDocument, layers, null);
                    } else {
                        if (event.leadingAssigned) {
                            this.flux.actions.type.updateLeading(currentDocument, layers, event.leading);
                        } else {
                            this.flux.actions.type.updateLeading(currentDocument, layers, undefined);
                        }
                    }
                }
            }.bind(this);

            descriptor.addListener("updateTextProperties", _typeChangedHandler);
            if (firstLaunch) {
                firstLaunch = false;
                return descriptor.batchPlayObjects([resetObj]);
            }
        };

        var deselectHandler = function () {
            descriptor.removeListener("move", _moveHandler);
            descriptor.removeListener("updateTextProperties", _typeChangedHandler);

            var documentStore = this.flux.store("application"),
                currentDocument = documentStore.getCurrentDocument(),
                layers = currentDocument.layers.allSelected,
                layersAllHaveType = layers.every(function (layer) {
                    return layer.text !== null;
                });

            if (layersAllHaveType) {
                this.flux.actions.layers.resetLayers(currentDocument, layers);
            }
            
            _moveHandler = null;
            _typeChangedHandler = null;
        };

        Tool.call(this, "typeCreateOrEdit", "Type", "typeCreateOrEditTool", selectHandler, deselectHandler);

        this.activationKey = "t";
    };
    util.inherits(TypeTool, Tool);

    module.exports = TypeTool;
});
