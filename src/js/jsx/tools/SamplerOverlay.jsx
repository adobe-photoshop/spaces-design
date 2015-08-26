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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        d3 = require("d3"),
        _ = require("lodash");

    var OS = require("adapter/os");

    var system = require("js/util/system"),
        mathUtil = require("js/util/math");

    // Used for debouncing the overlay drawing
    var DEBOUNCE_DELAY = 200;

    var SamplerOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool", "document", "application", "ui", "modifier", "style")],

        /**
         * Keeps track of current mouse position so we can rerender the overlaid layers correctly
         * @type {number}
         */
        _currentMouseX: null,

        /**
         * Keeps track of current mouse position so we can rerender the overlaid layers correctly
         * @type {number}
         */
        _currentMouseY: null,

        /**
         * Owner group for all the overlay svg elements
         *
         * @type {SVGElement}
         */
        _scrimGroup: null,

        /**
         * Owner group for the HUD elements
         *
         * @type {SVGElement}
         */
        _hudGroup: null,

        /**
         * UI Scale for drawing strokes visible at all zoom levels
         *
         * @type {number}
         */
        _scale: null,

        /**
         * Debounced draw function, for performance
         * 
         * @type {function}
         */
        _drawDebounced: null,

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                toolStore = flux.store("tool"),
                styleStore = flux.store("style"),
                modifierStore = flux.store("modifier"),
                modalState = toolStore.getModalToolState(),
                currentDocument = applicationStore.getCurrentDocument(),
                sampleTypes = styleStore.getHUDStyles(),
                samplePoint = styleStore.getSamplePoint(),
                modifiers = modifierStore.getState();

            return {
                document: currentDocument,
                modalState: modalState,
                modifiers: modifiers,
                sampleTypes: sampleTypes,
                samplePoint: samplePoint
            };
        },

        componentWillMount: function () {
            this._drawDebounced = _.debounce(this.drawOverlay, DEBOUNCE_DELAY);
        },

        componentWillUnmount: function () {
            OS.removeListener("externalMouseMove", this.mouseMoveHandler);
        },

        componentDidMount: function () {
            this._currentMouseX = null;
            this._currentMouseY = null;
            
            this._drawDebounced();
            
            // Marquee mouse handlers
            OS.addListener("externalMouseMove", this.mouseMoveHandler);
        },

        componentDidUpdate: function () {
            // Redraw immediately when we're in a modal state
            if (this.state.modalState) {
                this.drawOverlay();
            } else {
                this._drawDebounced();
            }
        },

        /**
         * Attaches to mouse move events coming from Photoshop
         * so we can set highlights manually. We have to resort to this
         * because external mouse move events do not cause :hover states
         * in DOM elements
         *
         * @private
         * @param {CustomEvent} event EXTERNAL_MOUSE_MOVE event coming from _spaces.OS
         */
        mouseMoveHandler: function (event) {
            if (this.isMounted()) {
                this._currentMouseX = event.location[0];
                this._currentMouseY = event.location[1];
                
                this.updateMouseOverHighlights();
            }
        },

        /**
         * Calls all helper functions to draw sampler overlay
         * Cleans it first
         * @private
         */
        drawOverlay: function () {
            if (!this.isMounted()) {
                return;
            }

            var currentDocument = this.state.document,
                svg = d3.select(React.findDOMNode(this));

            svg.selectAll(".sampler-bounds-group").remove();
            svg.selectAll(".sampler-hud").remove();

            if (!currentDocument || this.state.modalState) {
                return null;
            }

            this._scrimGroup = svg.insert("g", ".transform-control-group")
                .classed("sampler-bounds-group", true)
                .attr("transform", this.props.transformString);

            this._hudGroup = svg.insert("g", ".hud-group")
                .classed("sampler-hud", true);

            // Reason we calculate the scale here is to make sure things like strokewidth / rotate area
            // are not scaled with the SVG transform of the overlay
            var transformObj = d3.transform(this._scrimGroup.attr("transform")),
                layerTree = currentDocument.layers;

            this._scale = 1 / transformObj.scale[0];
            
            this.drawBoundRectangles(layerTree);
            this.drawSelectionBounds(layerTree);
            this.drawSamplerHUD();
        },

        /**
         * Draws a magenta border around selection, subject to change
         *
         * @private
         * @param {LayerStructure} layerTree
         */
        drawSelectionBounds: function (layerTree) {
            var scale = this._scale,
                bounds = layerTree.selectedAreaBounds;

            // Skip empty bounds
            if (!bounds || bounds.empty) {
                return;
            }

            // HACK: For some reason Photoshop's bounds seem to be shifted by ~1px to the
            // bottom-right. See https://github.com/adobe-photoshop/spaces-design/issues/866
            var offset = system.isMac ? 0 : scale;
                
            this._scrimGroup
                .append("rect")
                .attr("x", bounds.left + offset)
                .attr("y", bounds.top + offset)
                .attr("width", bounds.width)
                .attr("height", bounds.height)
                .classed("sampler-selection", true)
                .style("stroke-width", 1.0 * scale);
        },

        /**
         * Draws the highlightable leaf layer boxes
         *
         * @private
         * @param {LayerStructure} layerTree layerTree of the current document
         */
        drawBoundRectangles: function (layerTree) {
            var indexOf = layerTree.indexOf.bind(layerTree),
                scale = this._scale,
                renderLayers = layerTree.leaves
                    .filterNot(function (layer) {
                        return layerTree.hasInvisibleAncestor(layer);
                    })
                    .sortBy(indexOf);

            renderLayers.forEach(function (layer) {
                var bounds = layerTree.childBounds(layer);
                    
                // Skip empty bounds
                if (!bounds || bounds.empty) {
                    return;
                }

                // HACK: For some reason Photoshop's bounds seem to be shifted by ~1px to the
                // bottom-right. See https://github.com/adobe-photoshop/spaces-design/issues/866
                var offset = system.isMac ? 0 : scale;

                this._scrimGroup
                    .append("rect")
                    .attr("x", bounds.left + offset)
                    .attr("y", bounds.top + offset)
                    .attr("width", bounds.width)
                    .attr("height", bounds.height)
                    .attr("layer-id", layer.id)
                    .attr("layer-selected", layer.selected)
                    .attr("id", "layer-" + layer.id)
                    .classed("sampler-bounds", true);
            }, this);

            this.updateMouseOverHighlights();
        },

        /**
         * Draws sampler HUD if there is one available from the store
         *
         * @return {[type]} [description]
         */
        drawSamplerHUD: function () {
            if (!this.state.sampleTypes || !this.state.samplePoint) {
                return;
            }

            var samples = _.filter(this.state.sampleTypes, "value"),
                mouseX = this.state.samplePoint.x,
                mouseY = this.state.samplePoint.y;
            
            if (samples.length === 0) {
                return;
            }

            // Constants
            // TODO: Do we need to hook up sampleSize to the app rem size for different screens?
            // Values all based on the single sampleSize variable
            var sampleSize = 24,
                rectWidth = (sampleSize * samples.length) + (sampleSize / 3),
                rectHeight = Math.round(sampleSize * 1.25),
                rectTLXOffset = -rectWidth / 2,
                rectTLYOffset = -sampleSize - 16,
                rectRound = sampleSize / 6;

            var rectTLX = Math.round(mouseX + rectTLXOffset),
                rectTLY = Math.round(mouseY + rectTLYOffset);
            
            // added 2 more points above the arrow to deal with half-pixel rendering a small line between hud and arrow
            var trianglePoints = [
                { x: mouseX - sampleSize * 0.20833, y: mouseY - sampleSize * 0.4166666667 },
                { x: mouseX - sampleSize * 0.20833, y: mouseY - sampleSize * 0.5 },
                { x: mouseX - sampleSize * 0.20833, y: mouseY - sampleSize * 0.5 },
                { x: mouseX + sampleSize * 0.20833, y: mouseY - sampleSize * 0.4166666667 },
                { x: mouseX, y: mouseY - 5 }
            ];

            var lineFunction = d3.svg.line()
                .x(function (d) { return d.x; })
                .y(function (d) { return d.y; })
                .interpolate("linear");

            // Draw the frame
            // A rounded rectangle
            this._hudGroup
                .append("rect")
                .attr("x", rectTLX)
                .attr("y", rectTLY)
                .attr("width", rectWidth)
                .attr("height", rectHeight)
                .attr("rx", rectRound)
                .attr("ry", rectRound)
                .classed("sampler-hud", true)
                .classed("sampler-hud-outline", true)
                .on("click", function () {
                    d3.event.stopPropagation();
                });

            // Small triangle at the base
            this._hudGroup
                .append("path")
                .attr("d", lineFunction(trianglePoints))
                .classed("sampler-hud", true)
                .classed("sampler-hud-outline", true);

            // Draw each sample square
            this._drawSampleHUDObjects(rectTLX, rectTLY, sampleSize, samples);
        },
        
        /**
         * Draws the clickable icons on the sampler HUD
         *
         * @private
         * @param {number} left Left coordinates of the HUD
         * @param {number} top Top coordinates of the HUD
         * @param {number} size Icon size
         * @param {Array.<object>} samples Description of attributes that can be styled
         */
        _drawSampleHUDObjects: function (left, top, size, samples) {
            var fluxActions = this.getFlux().actions,
                iconSize = Math.round(size * 0.58333333333333),
                iconOffset = Math.round(size / 3);

            samples.forEach(function (sample, index) {
                var iconLeft = left + index * size + iconOffset,
                    iconTop = top + iconOffset;

                if (sample.type === "fillColor") {
                    var fillColor = sample.value ? sample.value.toTinyColor().toRgbString() : "#000000",
                        fillOpacity = sample.value ? 1.0 : 0.0;
                    // background of fill 
                    this._hudGroup
                        .append("use")
                        .attr("xlink:href", "img/ico-sampler-fill-swatch-bg.svg#sampler-fill-swatch-bg")
                        .attr("x", iconLeft)
                        .attr("y", iconTop)
                        .attr("width", iconSize)
                        .attr("height", iconSize);
                    
                    // fill color
                    this._hudGroup
                        .append("use")
                        .attr("xlink:href", "img/ico-sampler-fill-swatch.svg#sampler-fill-swatch")
                        .attr("x", iconLeft)
                        .attr("y", iconTop)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .attr("fill", fillColor)
                        .attr("opacity", fillOpacity)
                        .on("click", function () {
                            // Apply the color to selected layers
                            fluxActions.sampler.applyColor(this.state.document, null, sample.value);
                            d3.event.stopPropagation();
                        }.bind(this));
                } else if (sample.type === "stroke") {
                    var stroke = sample.value,
                        strokeColor = (stroke && stroke.color) ? stroke.color.toTinyColor().toRgbString() : "#000000",
                        strokeOpacity = (stroke && stroke.color && stroke.enabled) ? 1.0 : 0.0;
                    
                    // background of stroke 
                    this._hudGroup
                        .append("use")
                        .attr("xlink:href", "img/ico-sampler-stroke-swatch-bg.svg#sampler-stroke-swatch-bg")
                        .attr("x", iconLeft)
                        .attr("y", iconTop)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .on("click", function () {
                            // Apply the color to selected layers
                            fluxActions.sampler.applyColor(this.state.document, null, sample.value);
                            d3.event.stopPropagation();
                        }.bind(this));
                    
                    // stroke color        
                    this._hudGroup
                        .append("use")
                        .attr("xlink:href", "img/ico-sampler-stroke-swatch.svg#sampler-stroke-swatch")
                        .attr("x", iconLeft)
                        .attr("y", iconTop)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .attr("fill", strokeColor)
                        .attr("opacity", strokeOpacity)
                        .on("click", function () {
                            // Apply the color to selected layers
                            fluxActions.sampler.applyStroke(this.state.document, null, stroke);
                            d3.event.stopPropagation();
                        }.bind(this));
                } else if (sample.type === "typeStyle") {
                    this._hudGroup
                        .append("use")
                        .attr("xlink:href", "img/ico-sampler-charStyle.svg")
                        .attr("x", iconLeft)
                        .attr("y", iconTop)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .classed("sampler-hud", true)
                        .classed("sampler-hud-icon-disabled", !sample.value)
                        .on("click", function () {
                            if (sample.value) {
                                // Apply the type style to selected layers
                                fluxActions.type.applyTextStyle(this.state.document, null, sample.value);
                            }
                            d3.event.stopPropagation();
                        }.bind(this));
                } else if (sample.type === "layerEffects") {
                    // background rectangle for the icon so it's clickable easier
                    this._hudGroup
                        .append("rect")
                        .attr("x", iconLeft)
                        .attr("y", iconTop)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .classed("sampler-hud-background", true)
                        .classed("sampler-hud-icon-disabled", !sample.value)
                        .on("click", function () {
                            fluxActions.layerEffects.duplicateLayerEffects(this.state.document, null, sample.value);
                            d3.event.stopPropagation();
                        }.bind(this));

                    // fx icon
                    this._hudGroup
                        .append("use")
                        .attr("xlink:href", "img/ico-sampler-layerStyle.svg#sampler-layerStyle")
                        .attr("x", iconLeft)
                        .attr("y", iconTop)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .classed("sampler-hud", true)
                        .classed("sampler-hud-icon-disabled", !sample.value)
                        .on("click", function () {
                            fluxActions.layerEffects.duplicateLayerEffects(this.state.document, null, sample.value);
                            d3.event.stopPropagation();
                        }.bind(this));
                } else if (sample.type === "graphic") {
                    this._hudGroup
                        .append("use")
                        .attr("xlink:href", "img/ico-sampler-graphics.svg")
                        .attr("x", iconLeft)
                        .attr("y", iconTop)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .classed("sampler-hud", true)
                        .classed("sampler-hud-icon-disabled", !sample.value)
                        .on("click", function () {
                            fluxActions.sampler.replaceGraphic(this.state.document, null, sample.value);
                            d3.event.stopPropagation();
                        }.bind(this));
                }
            }, this);
        },

        /**
         * Goes through all layer bounds and highlights the top one the cursor is on
         *
         * @private
         */
        updateMouseOverHighlights: function () {
            if (!this.state.document) {
                return;
            }

            var scale = this._scale,
                layerTree = this.state.document.layers,
                uiStore = this.getFlux().store("ui"),
                mouseX = this._currentMouseX,
                mouseY = this._currentMouseY,
                canvasMouse = uiStore.transformWindowToCanvas(mouseX, mouseY),
                highlightFound = false;

            // Yuck, we gotta traverse the list backwards, and D3 doesn't offer reverse iteration
            _.forEachRight(d3.selectAll(".sampler-bounds")[0], function (element) {
                var layer = d3.select(element),
                    layerID = mathUtil.parseNumber(layer.attr("layer-id")),
                    layerSelected = layer.attr("layer-selected") === "true",
                    layerModel = layerTree.byID(layerID);

                // Sometimes, the DOM elements may be out of date, and be of different documents
                if (!layerModel) {
                    return;
                }

                var visibleBounds = layerTree.boundsWithinArtboard(layerModel),
                    intersects = visibleBounds &&
                        visibleBounds.left <= canvasMouse.x && visibleBounds.right >= canvasMouse.x &&
                        visibleBounds.top <= canvasMouse.y && visibleBounds.bottom >= canvasMouse.y;

                if (!highlightFound && intersects) {
                    if (!layerSelected) {
                        layer.classed("sampler-bounds-hover", true)
                            .style("stroke-width", 1.0 * scale);
                    }
                    highlightFound = true;
                } else {
                    layer.classed("sampler-bounds-hover", true)
                        .style("stroke-width", 0.0);
                }
            });
        },

        render: function () {
            return (<g />);
        }
    });

    module.exports = SamplerOverlay;
});
