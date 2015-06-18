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
        mathUtil = require("js/util/math"),
        uiUtil = require("js/util/ui");

    // Used for debouncing the overlay drawing
    var DEBOUNCE_DELAY = 200;

    var SuperselectOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("document", "application", "ui")],

        /**
         * Flag to tell us whether to render leaf rectangles or super select rectangles
         * @type {boolean}
         */
        _leafBounds: false,

        /**
         * Keeps track of current mouse position so we can rerender the overlaid layers correctly
         * @type {Number}
         */
        _currentMouseX: null,

        /**
         * Keeps track of current mouse position so we can rerender the overlaid layers correctly
         * @type {Number}
         */
        _currentMouseY: null,

        /**
         * Keeps track of whether the mouse is down or up, used for marquee
         *
         * @type {boolean}
         */
        _currentMouseDown: null,

        /**
         * Keeps track of the marquee rectangle so it can be resized
         *
         * @type {<SVGElement>}
         */
        _marqueeRect: null,

        /**
         * Owner group for all the overlay svg elements
         *
         * @type {<SVGElement>}
         */
        _scrimGroup: null,

        /**
         * IDs of layers that are being highlighted by marquee select
         *
         * @type {Array.<number>}
         */
        _marqueeResult: null,

        /**
         * UI Scale for drawing strokes visible at all zoom levels
         *
         * @type {number}
         */
        _scale: null,

        /**
         * During certain drags, especially with Artboards, we get a lot of
         * UI updating events, document resizes etc. we debounce drawing functions
         * so our overlays don't play catch up
         *
         * @type {function}
         */
        _drawDebounced: null,

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                toolStore = flux.store("tool"),
                uiStore = flux.store("ui"),
                uiState = uiStore.getState(),
                modalState = toolStore.getModalToolState(),
                currentDocument = applicationStore.getCurrentDocument();

            return {
                document: currentDocument,
                marqueeEnabled: uiState.marqueeEnabled,
                marqueeStart: uiState.marqueeStart,
                modalState: modalState
            };
        },

        componentWillMount: function () {
            window.addEventListener("adapterFlagsChanged", this._handleExternalKeyEvent);
            this._drawDebounced = _.debounce(this.drawOverlay, DEBOUNCE_DELAY);
        },

        componentWillUnmount: function () {
            window.removeEventListener("adapterFlagsChanged", this._handleExternalKeyEvent);
            window.removeEventListener("mousemove", this.marqueeUpdater);
            window.removeEventListener("mouseup", this.mouseUpHandler);
            window.removeEventListener("mousedown", this.mouseDownHandler);
            OS.removeListener("externalMouseMove", this.mouseMoveHandler);
        },

        componentDidMount: function () {
            this._currentMouseX = null;
            this._currentMouseY = null;
            this._marqueeResult = [];

            if (!this.state.modalState) {
                this._drawDebounced();
            }
            
            // Marquee mouse handlers
            window.addEventListener("mousemove", this.marqueeUpdater);
            window.addEventListener("mouseup", this.mouseUpHandler);
            window.addEventListener("mousedown", this.mouseDownHandler);
            OS.addListener("externalMouseMove", this.mouseMoveHandler);
        },

        componentDidUpdate: function () {
            if (!this.state.modalState) {
                this._drawDebounced();
            }
        },

        /**
         * Attaches to mouse move events coming from Photoshop
         * so we can set highlights manually. We have to resort to this
         * because external mouse move events do not cause :hover states
         * in DOM elements
         *
         * @param {CustomEvent} event EXTERNAL_MOUSE_MOVE event coming from _spaces.OS
         */
        mouseMoveHandler: function (event) {
            if (this.isMounted()) {
                this._currentMouseX = event.location[0];
                this._currentMouseY = event.location[1];
                if (this.state.marqueeEnabled) {
                    this.updateMarqueeRect();
                }
                this.updateMouseOverHighlights();
            }
        },

        /**
         * Attaches to mouse move events on the window
         * to update the mouse position and the marquee
         *
         * @param {MouseEvent} event
         */
        marqueeUpdater: function (event) {
            if (this.isMounted()) {
                this._currentMouseX = event.x;
                this._currentMouseY = event.y;
                if (this.state.marqueeEnabled) {
                    this.updateMarqueeRect();
                }
            }
        },

        /**
         * Calls all helper functions to draw super-select overlay
         * Cleans it first
         */
        drawOverlay: function () {
            if (!this.isMounted()) {
                return;
            }

            this.getFlux().actions.tools.resetBorderPolicies();
                
            var currentDocument = this.state.document,
                svg = d3.select(React.findDOMNode(this));

            svg.selectAll(".superselect-bounds").remove();
            svg.selectAll(".superselect-marquee").remove();
            svg.selectAll(".artboard-adder").remove();

            if (!currentDocument) {
                return null;
            }

            this._scrimGroup = svg.insert("g", ".transform-control-group")
                .classed("superselect-bounds", true)
                .attr("transform", this.props.transformString);

            // Reason we calculate the scale here is to make sure things like strokewidth / rotate area
            // are not scaled with the SVG transform of the overlay
            var transformObj = d3.transform(this._scrimGroup.attr("transform")),
                layerTree = currentDocument.layers;

            this._scale = 1 / transformObj.scale[0];
            
            this.drawBoundRectangles(svg, layerTree);

            this._drawArtboardAdders(svg, layerTree);

            if (this.state.marqueeEnabled) {
                this.startSuperselectMarquee(svg);
            }
        },

        /**
         * Draws either superselectable or leaf layer bounding boxes
         * 
         * @param {SVGElement} svg SVG HTML element to draw in
         * @param {LayerTree} layerTree layerTree of the current document
         */
        drawBoundRectangles: function (svg, layerTree) {
            var indexOf = layerTree.indexOf.bind(layerTree),
                scale = this._scale,
                renderLayers;

            if (this._leafBounds) {
                renderLayers = layerTree.leaves.sortBy(indexOf);
                // Hide the parent layer bounds
                d3.select(".selection-parent-bounds")
                    .style("visibility", "hidden");
            } else {
                renderLayers = layerTree.selectable.reverse();
                // Show the parent layer bounds
                d3.select(".selection-parent-bounds")
                    .style("visibility", "visible");
            }

            renderLayers.forEach(function (layer) {
                var bounds = layerTree.childBounds(layer);
                    
                // Skip empty and selected bounds
                if (layer.selected || !bounds || bounds.empty) {
                    return;
                }

                // HACK: For some reason Photoshop's bounds seem to be shifted by ~1px to the
                // bottom-right. See https://github.com/adobe-photoshop/spaces-design/issues/866
                var offset = system.isMac ? 0 : scale;

                var boundRect = this._scrimGroup
                    .append("rect")
                    .attr("x", bounds.left + offset)
                    .attr("y", bounds.top + offset)
                    .attr("width", bounds.width)
                    .attr("height", bounds.height)
                    .attr("layer-id", layer.id)
                    .attr("id", "layer-" + layer.id)
                    .classed("layer-bounds", true);

                if (layer.isArtboard) {
                    var nameBounds = uiUtil.getNameBadgeBounds(bounds, scale),
                        namePointCoords = [
                            { x: nameBounds.left, y: nameBounds.top },
                            { x: nameBounds.right, y: nameBounds.top },
                            { x: nameBounds.right, y: nameBounds.bottom },
                            { x: nameBounds.left, y: nameBounds.bottom }
                        ],
                        namePoints = namePointCoords.map(function (coord) {
                            return coord.x + "," + coord.y;
                        }).join(" ");
                        
                    this._scrimGroup.append("polygon")
                        .attr("points", namePoints)
                        .attr("id", "name-badge-" + layer.id)
                        .attr("layer-id", layer.id)
                        .attr("x", nameBounds.left + offset)
                        .attr("y", nameBounds.top + offset)
                        .attr("width", nameBounds.width)
                        .attr("height", nameBounds.height)
                        .classed("artboard-name-rect", true)
                        .classed("layer-artboard-bounds", true);
                } else {
                    boundRect.classed("marqueeable", true);
                }
            }, this);

            var uiStore = this.getFlux().store("ui"),
                canvasCursor = uiStore.transformWindowToCanvas(this._currentMouseX, this._currentMouseY),
                topLayer = renderLayers.findLast(function (layer) {
                    var bounds = layerTree.childBounds(layer);
                    if (!bounds) {
                        return;
                    }

                    return !layer.isArtboard && !layer.selected && bounds.contains(canvasCursor.x, canvasCursor.y);
                }, this);

            if (topLayer) {
                var layerID = "#layer-" + topLayer.id;
                d3.select(layerID)
                    .classed("layer-bounds-hover", true)
                    .style("stroke-width", 1.0 * scale);
            }
        },

        /**
         * Starts drawing the superselect marquee at the given location
         *
         * @param {SVGElement} svg
         */
        startSuperselectMarquee: function (svg) {
            // Because we wait for React to tell us to start marquee, sometimes we may reach here
            // after mouse up has happened, so we have to check for it ourselves, and not even bother
            // to start marquee tracking
            if (!this._currentMouseDown) {
                return;
            }

            var rectX = this.state.marqueeStart.x,
                rectY = this.state.marqueeStart.y,
                rectW = this._currentMouseX - rectX,
                rectH = this._currentMouseY - rectY,
                group = svg.insert("g", ".transform-control-group")
                    .classed("superselect-marquee", true);
            
            if (rectW < 0) {
                rectX = rectX + rectW;
                rectW = -rectW;
            }

            if (rectH < 0) {
                rectY = rectY + rectH;
                rectH = -rectH;
            }

            // We store this in a component variable so we can update it
            this._marqueeRect = group.append("rect")
                .attr("x", rectX)
                .attr("y", rectY)
                .attr("width", rectW)
                .attr("height", rectH)
                .classed("superselect-marquee", true);

            this._marqueeResult = [];

            this.updateMarqueeRect();
        },

        /**
         * Calls the action and removes the listener so it's a one off listener
         *
         * @param {MouseEvent} event
         */
        mouseUpHandler: function (event) {
            if (!this.isMounted()) {
                return;
            }

            this._currentMouseDown = false;

            if (this._marqueeRect) {
                var superselect = this.getFlux().actions.superselect;
                superselect.marqueeSelect(this.state.document, this._marqueeResult, event.shiftKey);
                this._marqueeRect = null;
            }
        },

        /**
         * Sets the flag so we can start marquee once the Flux action is complete
         * if the flag is still set
         */
        mouseDownHandler: function () {
            this._currentMouseDown = true;
        },

        /**
         * Goes through all layer bounds and highlights the top one the cursor is on
         */
        updateMouseOverHighlights: function () {
            var marquee = this.state.marqueeEnabled,
                scale = this._scale,
                uiStore = this.getFlux().store("ui"),
                mouseX = this._currentMouseX,
                mouseY = this._currentMouseY,
                canvasMouse = uiStore.transformWindowToCanvas(mouseX, mouseY),
                highlightFound = false;

            // Yuck, we gotta traverse the list backwards, and D3 doesn't offer reverse iteration
            _.forEachRight(d3.selectAll(".layer-bounds")[0], function (element) {
                var layer = d3.select(element),
                    layerLeft = mathUtil.parseNumber(layer.attr("x")),
                    layerTop = mathUtil.parseNumber(layer.attr("y")),
                    layerRight = layerLeft + mathUtil.parseNumber(layer.attr("width")),
                    layerBottom = layerTop + mathUtil.parseNumber(layer.attr("height")),
                    intersects = layerLeft < canvasMouse.x && layerRight > canvasMouse.x &&
                        layerTop < canvasMouse.y && layerBottom > canvasMouse.y;

                if (!marquee && !highlightFound && intersects) {
                    layer.classed("layer-bounds-hover", true)
                        .style("stroke-width", 1.0 * scale);
                    highlightFound = true;
                } else {
                    layer.classed("layer-bounds-hover", true)
                        .style("stroke-width", 0.0);
                }
            });

            // Another yuck for artboard name badges
            _.forEachRight(d3.selectAll(".artboard-name-rect")[0], function (element) {
                var layer = d3.select(element),
                    layerID = layer.attr("layer-id"),
                    layerLeft = mathUtil.parseNumber(layer.attr("x")),
                    layerTop = mathUtil.parseNumber(layer.attr("y")),
                    layerRight = layerLeft + mathUtil.parseNumber(layer.attr("width")),
                    layerBottom = layerTop + mathUtil.parseNumber(layer.attr("height")),
                    intersects = layerLeft < canvasMouse.x && layerRight > canvasMouse.x &&
                        layerTop < canvasMouse.y && layerBottom > canvasMouse.y;

                if (!marquee && !highlightFound && intersects) {
                    d3.select("#layer-" + layerID)
                        .classed("layer-bounds-hover", true)
                        .style("stroke-width", 1.0 * scale);
                } else {
                    d3.select("#layer-" + layerID)
                        .classed("layer-bounds-hover", false)
                        .style("stroke-width", 0.0);
                }
            });
        },

        /**
         * Updates the marquee rectangle by changing size/location
         * and highlighting the correct layers
         */
        updateMarqueeRect: function () {
            if (!this._marqueeRect) {
                return;
            }

            var uiStore = this.getFlux().store("ui"),
                highlightedIDs = [],
                scale = this._scale,
                left = this.state.marqueeStart.x,
                top = this.state.marqueeStart.y,
                right = this._currentMouseX,
                bottom = this._currentMouseY,
                temp;

            if (left > right) {
                temp = left;
                left = right;
                right = temp;
            }

            if (top > bottom) {
                temp = top;
                top = bottom;
                bottom = temp;
            }

            var start = uiStore.transformWindowToCanvas(left, top),
                end = uiStore.transformWindowToCanvas(right, bottom);
                
            this._marqueeRect
                .attr("x", left)
                .attr("y", top)
                .attr("width", right - left)
                .attr("height", bottom - top);
            
            d3.selectAll(".marqueeable").each(function () {
                var layer = d3.select(this),
                    layerLeft = mathUtil.parseNumber(layer.attr("x")),
                    layerTop = mathUtil.parseNumber(layer.attr("y")),
                    layerRight = layerLeft + mathUtil.parseNumber(layer.attr("width")),
                    layerBottom = layerTop + mathUtil.parseNumber(layer.attr("height")),
                    intersects = layerLeft < end.x && layerRight > start.x &&
                        layerTop < end.y && layerBottom > start.y;

                if (intersects) {
                    layer.classed("marquee-hover", true)
                        .style("stroke-width", 1.0 * scale);
                    highlightedIDs.push(mathUtil.parseNumber(layer.attr("layer-id")));
                } else {
                    layer.classed("marquee-hover", false)
                        .style("stroke-width", 0.0);
                }
            });

            this._marqueeResult = highlightedIDs;
        },

        /**
         * Handles the cmd key press/depresses here to redraw overlay
         *
         * @private
         * @param {OSEvent} event
         */
        _handleExternalKeyEvent: function (event) {
            var modifiers = event.detail.modifiers,
                leafModifier = system.isMac ? modifiers.command : modifiers.control;

            if (leafModifier && !this._leafBounds) {
                this._leafBounds = true;
                this.drawOverlay();
            } else if (!leafModifier && this._leafBounds) {
                this._leafBounds = false;
                this.drawOverlay();
            }
        },

        /**
         * Calculates the new artboard bounds in the given direction
         *
         * @private
         * @param {Bounds} bounds Artboard bounds to be copied
         * @param {string} direction 
         * @return {Bounds}
         */
        _getNewArtboardBounds: function (bounds, direction) {
            var padding = 100,
                newBounds;

            switch (direction) {
                case "n":
                    newBounds = bounds.merge({
                        top: bounds.top - bounds.height - padding,
                        bottom: bounds.bottom - bounds.height - padding
                    });
                    break;
                case "s":
                    newBounds = bounds.merge({
                        top: bounds.top + bounds.height + padding,
                        bottom: bounds.bottom + bounds.height + padding
                    });
                    break;
                case "w":
                    newBounds = bounds.merge({
                        left: bounds.left - bounds.width - padding,
                        right: bounds.right - bounds.width - padding
                    });
                    break;
                case "e":
                    newBounds = bounds.merge({
                        left: bounds.left + bounds.width + padding,
                        right: bounds.right + bounds.width + padding
                    });
                    break;
                default:
                    throw new Error("Invalid direction passed to artboard bound calculation");
            }

            return newBounds;
        },

        /**
         * Checks to see if any other artboards intersect with an artboard that would be
         * drawn in that direction. If not, draws an adder
         *
         * @private
         * @param {SVGElement} svg
         * @param {Layer} artboard Currently selected artboard
         * @param {Immutable.List<Layer>} otherArtboards All other artboards in the document
         * @param {string} direction Direction to check for
         */
        _checkAndDrawArtboardAdder: function (svg, artboard, otherArtboards, direction) {
            var bounds = artboard.bounds,
                scale = this._scale,
                checkBounds = this._getNewArtboardBounds(bounds, direction),
                intersects = otherArtboards.some(function (artboard) {
                    return checkBounds.intersects(artboard.bounds);
                });

            if (intersects) {
                return;
            }

            var adderXCenter, adderYCenter,
                padding = 50 * scale,
                crosshairLength = 3.5 * scale,
                circleRadius = 13 * scale;

            switch (direction) {
                case "n":
                    adderXCenter = bounds.xCenter;
                    adderYCenter = bounds.top - padding;
                    break;
                case "s":
                    adderXCenter = bounds.xCenter;
                    adderYCenter = bounds.bottom + padding;
                    break;
                case "w":
                    adderXCenter = bounds.left - padding;
                    adderYCenter = bounds.yCenter;
                    break;
                case "e":
                    adderXCenter = bounds.right + padding;
                    adderYCenter = bounds.yCenter;
                    break;
            }

            var adder = this._scrimGroup.append("g")
                .classed("artboard-adder", true)
                .style("stroke-width", 1.0 * scale)
                .on("mousedown", function () {
                    d3.event.stopPropagation();
                })
                .on("mouseup", function () {
                    d3.event.stopPropagation();
                })
                .on("click", function () {
                    this.getFlux().actions.layers.createArtboard(checkBounds);
                    d3.event.stopPropagation();
                }.bind(this));

            // Vertical line
            adder.append("line")
                .attr("x1", adderXCenter)
                .attr("x2", adderXCenter)
                .attr("y1", adderYCenter - crosshairLength)
                .attr("y2", adderYCenter + crosshairLength);

            // Horizontal line
            adder.append("line")
                .attr("x1", adderXCenter - crosshairLength)
                .attr("x2", adderXCenter + crosshairLength)
                .attr("y1", adderYCenter)
                .attr("y2", adderYCenter);

            // Encompassing circle
            adder.append("circle")
                .attr("cx", adderXCenter)
                .attr("cy", adderYCenter)
                .attr("r", circleRadius);
        },

        /**
         * Draws artboard adders for the selected artboard if space is available
         *
         * @private
         * @param {SVGElement} svg 
         * @param {LayerTree} layerTree Layers of current document
         */
        _drawArtboardAdders: function (svg, layerTree) {
            var layers = layerTree.selected;

            // For now we draw only one artboard
            if (layers.size !== 1 || !layers.first().isArtboard) {
                return;
            }

            var currentArtboard = layers.first(),
                otherArtboards = layerTree.all.filter(function (layer) {
                    return layer.isArtboard && layer !== currentArtboard;
                });

            this._checkAndDrawArtboardAdder(svg, currentArtboard, otherArtboards, "n");
            this._checkAndDrawArtboardAdder(svg, currentArtboard, otherArtboards, "e");
            this._checkAndDrawArtboardAdder(svg, currentArtboard, otherArtboards, "s");
            this._checkAndDrawArtboardAdder(svg, currentArtboard, otherArtboards, "w");
        },

        render: function () {
            return (<g />);
        }
    });

    module.exports = SuperselectOverlay;
});
