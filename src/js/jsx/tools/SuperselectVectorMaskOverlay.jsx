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
        ReactDOM = require("react-dom"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        d3 = require("d3");

    var SuperselectVectorMaskOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool", "application", "document", "ui")],

        /**
         * Owner group for the vector mask HUD elements
         *
         * @type {SVGElement}
         */
        _vectorMaskHudGroup: null,

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                toolStore = flux.store("tool"),
                modalState = toolStore.getModalToolState(),
                currentDocument = applicationStore.getCurrentDocument(),
                vectorMaskMode = toolStore.getVectorMode();

            return {
                document: currentDocument,
                modalState: modalState,
                vectorMaskMode: vectorMaskMode
            };
        },

        componentDidUpdate: function (prevProps, prevState) {
            if (this.state.vectorMaskMode ||
                this.state.vectorMaskMode !== prevState.vectorMaskMode) {
                this.drawOverlay();
            }
        },

        /**
         * Calls all helper functions to draw super-select vector mask overlay
         * Cleans it first
         */
        drawOverlay: function () {
            if (!this.isMounted()) {
                return;
            }

            var currentDocument = this.state.document,
                svg = d3.select(ReactDOM.findDOMNode(this));
            svg.selectAll(".superselect-vector-mask-bounds").remove();
            svg.selectAll(".vector-mask-hud").remove();

            if (!currentDocument || this.state.modalState) {
                return;
            }
            var currentLayer = currentDocument.layers.selected.first();
                
            if (currentLayer && currentLayer.vectorMaskEmpty && this.state.vectorMaskMode) {
                this._vectorMaskHudGroup = svg.insert("g", ".hud-group")
                    .classed("vector-mask-hud", true);
                this._drawVectorMaskHUDObjects();
            }
        },

        /**
         * Draws a preview of the vector mask that will be drawn
         * 
         * @param {SVGElement} svg SVG HTML element to draw in
         * @param {LayerTree} layerTree layerTree of the current document
         * @param {string=} type the kind of vector mask previewed, "rect", "ellipse", or else hide the preview
         */
        drawMaskPreview: function (svg, layerTree, type) {
            var topAncestor = layerTree.topAncestor(layerTree.selected.first()),
                boundsAB = topAncestor.isArtboard ?
                    topAncestor.bounds :
                    { "left": 0, "top": 0 },
                bounds = layerTree.relativeChildBounds(layerTree.selected.first());
            
            svg.selectAll("g#maskPreview").remove();
            
            if (type) {
                // Skip empty bounds
                if (!bounds || bounds.empty) {
                    return;
                }

                svg.insert("g", ":first-child")
                    .attr("id", "maskPreview")
                    .classed("superselect-vector-mask-bounds", true)
                    .attr("transform", this.props.transformString);

                if (type === "ellipse") {
                    svg.select("g#maskPreview").append("defs")
                        .append("mask")
                        .attr("id", "Mask");

                    var oval = bounds.height > bounds.width ? bounds.width : bounds.height,
                        mask = svg.select("mask");

                    mask.append("rect")
                        .attr("x", bounds.left + boundsAB.left)
                        .attr("y", bounds.top + boundsAB.top)
                        .attr("width", bounds.width)
                        .attr("height", bounds.height)
                        .attr("fill", "black");

                    mask.append("circle")
                        .attr("cx", bounds.left + boundsAB.left + bounds.width / 2)
                        .attr("cy", bounds.top + boundsAB.top + bounds.height / 2)
                        .attr("r", oval / 2)
                        .attr("fill", "rgb(127, 127, 127)");

                    svg.select("g#maskPreview").append("rect")
                        .attr("x", bounds.left + boundsAB.left)
                        .attr("y", bounds.top + boundsAB.top)
                        .attr("width", bounds.width)
                        .attr("height", bounds.height)
                        .attr("fill", "#3691ff")
                        .attr("mask", "url(#Mask)");
                } else if (type === "rect") {
                    svg.select("g#maskPreview").append("rect")
                        .attr("x", bounds.left + boundsAB.left)
                        .attr("y", bounds.top + boundsAB.top)
                        .attr("width", bounds.width)
                        .attr("height", bounds.height)
                        .attr("fill", "#3691ff")
                        .attr("opacity", 0.5);
                }
            }
        },

        /**
         * Draws the clickable icons on the vector Mask HUD
         *
         * @private
         */
        _drawVectorMaskHUDObjects: function () {
            var flux = this.getFlux(),
                panelStore = flux.store("panel"),
                cloakRect = panelStore.getCloakRect();
            
            var layerTree = this.state.document.layers;
    
            var fluxActions = flux.actions,
                toolStore = flux.store("tool"),
                remToPx = flux.store("ui").remToPx,
                numIcons = 3;

            var sampleSize = remToPx(2.4),
                iconSize = Math.round(sampleSize),
                iconOffset = Math.round(sampleSize / 1.5),
                rectWidth = (sampleSize * numIcons) + (iconOffset * 5),
                rectHeight = sampleSize + iconOffset * 2,
                left = (cloakRect.left + cloakRect.right) / 2 - (rectWidth / 2),
                top = (cloakRect.top + cloakRect.bottom) / 2 - (rectHeight / 2),
                iconLeft = left + iconOffset,
                iconTop = top + iconOffset,
                rectRound = remToPx(1);

            var rectTLX = Math.round(left),
                rectTLY = Math.round(top);
            
            // Draw the frame
            // A rounded rectangle
            this._vectorMaskHudGroup
                .append("rect")
                .attr("x", rectTLX)
                .attr("y", rectTLY)
                .attr("width", rectWidth)
                .attr("height", rectHeight)
                .attr("rx", rectRound)
                .attr("ry", rectRound)
                .classed("vector-mask-hud", true)
                .classed("vector-mask-hud-outline", true)
                .on("click", function () {
                    d3.event.stopPropagation();
                });
 
            // ellipse
            // 
            this._vectorMaskHudGroup
                .append("use")
                .attr("xlink:href", "img/ico-maskmode-ellipse.svg#maskmode-ellipse")
                .attr("x", iconLeft)
                .attr("y", iconTop)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .on("mouseover", function () {
                    // Apply a temp mask on hover
                    this.drawMaskPreview(this._vectorMaskHudGroup, layerTree, "ellipse");
                    d3.event.stopPropagation();
                }.bind(this))
                .on("mouseout", function () {
                    // Remove the temp mask on hover
                    this.drawMaskPreview(this._vectorMaskHudGroup, layerTree, false);
                    d3.event.stopPropagation();
                }.bind(this))
                .on("click", function () {
                    fluxActions.mask.applyEllipse();
                    d3.event.stopPropagation();
                }.bind(this));
            
            iconLeft = iconLeft + iconOffset * 1.5 + sampleSize;

            // rect
            this._vectorMaskHudGroup
                .append("use")
                .attr("xlink:href", "img/ico-maskmode-rectangle.svg#maskmode-rectangle")
                .attr("x", iconLeft)
                .attr("y", iconTop)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .classed("sampler-hud", true)
                .on("mouseover", function () {
                    // Apply a temp mask on hover
                    this.drawMaskPreview(this._vectorMaskHudGroup, layerTree, "rect");
                    d3.event.stopPropagation();
                }.bind(this))
                .on("mouseout", function () {
                    // Remove the temp mask on hover
                    this.drawMaskPreview(this._vectorMaskHudGroup, layerTree, false);
                    d3.event.stopPropagation();
                }.bind(this))
                .on("click", function () {
                    fluxActions.mask.applyRectangle();
                    d3.event.stopPropagation();
                }.bind(this));

            iconLeft = iconLeft + iconOffset * 1.5 + sampleSize;

            // pen
            this._vectorMaskHudGroup
                .append("use")
                .attr("xlink:href", "img/ico-maskmode-pen.svg#maskmode-pen")
                .attr("x", iconLeft)
                .attr("y", iconTop)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .on("click", function () {
                    fluxActions.tools.select(toolStore.getToolByID("pen"));
                    d3.event.stopPropagation();
                }.bind(this));
        },

        render: function () {
            return (<g />);
        }
    });

    module.exports = SuperselectVectorMaskOverlay;
});
