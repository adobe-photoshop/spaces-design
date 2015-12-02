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
        Immutable = require("immutable"),
        d3 = require("d3"),
        _ = require("lodash");

    // Used for debouncing the overlay drawing
    var DEBOUNCE_DELAY = 200;

    var ArtboardOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool", "document", "application", "ui")],

        /**
         * Owner group for all the overlay svg elements
         *
         * @type {SVGElement}
         */
        _scrimGroup: null,

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
                currentDocument = applicationStore.getCurrentDocument(),
                currentTool = toolStore.getCurrentTool();

            return {
                document: currentDocument,
                uiTransform: uiState.transformMatrix,
                modalState: modalState,
                tool: currentTool
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return (!Immutable.is(this.state.document, nextState.document) ||
                !_.isEqual(this.state.uiTransform, nextState.uiTransform) ||
                this.state.modalState !== nextState.modalState ||
                this.state.tool !== nextState.tool);
        },

        componentWillMount: function () {
            this._drawDebounced = _.debounce(this._drawOverlay, DEBOUNCE_DELAY);
        },

        componentDidMount: function () {
            this._drawDebounced();
        },

        componentDidUpdate: function () {
            this._drawDebounced();
        },

        /**
         * Helper to re-draw the overlay on re-renders
         *
         * @private
         */
        _drawOverlay: function () {
            if (!this.isMounted()) {
                return;
            }

            var currentDocument = this.state.document,
                toolIsSuperselect = this.state.tool && this.state.tool.id === "newSelect",
                svg = d3.select(React.findDOMNode(this));

            svg.selectAll(".artboard-adders").remove();
            
            if (!toolIsSuperselect || !currentDocument || this.state.modalState) {
                return null;
            }
            
            this._scrimGroup = svg.insert("g", ".transform-control-group")
                .classed("artboard-adders", true)
                .attr("transform", this.props.transformString);

            // Reason we calculate the scale here is to make sure things like strokewidth / rotate area
            // are not scaled with the SVG transform of the overlay
            var transformObj = d3.transform(this._scrimGroup.attr("transform")),
                layerTree = currentDocument.layers;

            this._scale = 1 / transformObj.scale[0];
            
            this._drawArtboardAdders(svg, layerTree);
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

            // For now we draw only adders for one visible artboard
            if (layers.size !== 1 || !layers.first().isArtboard || !layers.first().visible) {
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
                remToPx = this.getFlux().store("ui").remToPx,
                checkBounds = this._getNewArtboardBounds(bounds, direction),
                intersects = otherArtboards.some(function (artboard) {
                    return checkBounds.intersects(artboard.bounds);
                });

            if (intersects) {
                return;
            }

            var adderXCenter, adderYCenter,
                padding = remToPx(3.125) * scale,
                crosshairLength = remToPx(0.4375) * scale,
                circleRadius = remToPx(1.625) * scale;

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

        render: function () {
            return (<g />);
        }
    });

    module.exports = ArtboardOverlay;
});
