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
        OS = require("adapter/os"),
        d3 = require("d3"),
        _ = require("lodash");

    var SuperselectOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("bounds", "layer", "application")],

         /**
         * Flag to tell us whether to render leaf rectangles or super select rectangles
         * @type {Boolean}
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

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();

            return {
                document: currentDocument
            };
        },

        componentWillMount: function () {
            this._currentMouseX = 0;
            this._currentMouseY = 0;
        },

        componentDidMount: function () {
            this.drawOverlay();
        },

        componentDidUpdate: function () {
            this.drawOverlay();
        },

        /**
         * Calls all helper functions to draw super-select overlay
         * Cleans it first
         */
        drawOverlay: function () {
            var currentDocument = this.state.document,
                svg = d3.select(this.getDOMNode());

            svg.selectAll("*").remove();
           
            if (!currentDocument) {
                return null;
            }

            // Reason we calculate the scale here is to make sure things like strokewidth / rotate area
            // are not scaled with the SVG transform of the overlay
            var transformObj = d3.transform(d3.select(this.getDOMNode().parentNode).attr("transform")),
                scale = 1 / transformObj.scale[0];

            var layerTree = currentDocument.layerTree;
            
            this.drawBoundRectangles(svg, layerTree, scale);
        },

        /**
         * Draws either superselectable or leaf layer bounding boxes
         * 
         * @param  {SVGElement} svg       SVG HTML element to draw in
         * @param  {LayerTree} layerTree layerTree of the current document
         */
        drawBoundRectangles: function (svg, layerTree, scale) {
            var renderLayers;

            if (this._leafBounds) {
                renderLayers = _.sortBy(layerTree.getLeafLayers(), "index");
                // Hide the parent layer bounds
                d3.select(".selection-parent-bounds").
                    style("visibility", "hidden");
            } else {
                renderLayers = _.sortBy(layerTree.getSelectableLayers(), "index");
                // Show the parent layer bounds
                d3.select(".selection-parent-bounds").
                    style("visibility", "visible");
            }

            // This way we can update current mouse position on canvas world
            var mouseCapture = function (mouse) {
                return function() {
                    var position = d3.mouse(this);
                    mouse._currentMouseX = position[0];
                    mouse._currentMouseY = position[1];
                };
            };
            
            var group = svg.insert("g", ".transform-control-group")
                .classed("superselect-bounds", true)
                .on("mousemove", mouseCapture(this));
            
            renderLayers.forEach(function (layer) {
                var bounds = layer.bounds,
                    pointCoords = [
                        {x: bounds.left, y: bounds.top},
                        {x: bounds.right, y: bounds.top},
                        {x: bounds.right, y: bounds.bottom},
                        {x: bounds.left, y: bounds.bottom}
                    ],
                    svgPoints = pointCoords.map(function (coord) { 
                        return coord.x + "," + coord.y;
                    }).join(" "),
                    boundRect = group.append("polygon")
                        .attr("points", svgPoints)
                        .attr("id", "layer-" + layer.id)
                        .classed("layer-bounds", true);

                if (!layer.selected) {
                    boundRect.on("mouseover", function () {
                        d3.select(this)
                            .classed("layer-bounds-hover", true)
                            .style("stroke-width", 1.0 * scale);
                    })
                    .on("mouseout", function () {
                        d3.select(this)
                            .classed("layer-bounds-hover", false)
                            .style("stroke-width", 0.0);
                    });
                }
            }, this);

            // After rendering everything, we select the top most bound
            // that is within the mouse curosr, and highlight/dehighlight it
            var mouseX = this._currentMouseX,
                mouseY = this._currentMouseY,
                topLayer = _.findLast(renderLayers, function (layer) {
                var bounds = layer.bounds;
                return (mouseX >= bounds.left && mouseX <= bounds.right &&
                   mouseY >= bounds.top && mouseY <= bounds.bottom);
            });

            if (topLayer) {
                var layerID = "#layer-" + topLayer.id;
                d3.select(layerID)
                    .classed("layer-bounds-hover", true)
                    .style("stroke-width", 1.0 * scale);
            }
        },

        /**
         * Handles the cmd key press/depresses here to redraw overlay
         *
         * @param  {OSEvent} event
         */
        handleExternalKeyEvent: function (event) {
            if (event.eventKind === OS.eventKind.FLAGS_CHANGED) {
                if (event.modifiers >= OS.eventModifiers.COMMAND && !this._leafBounds) {
                    this._leafBounds = true;
                    this.drawOverlay();
                } else if (event.modifiers < OS.eventModifiers.COMMAND && this._leafBounds) {
                    this._leafBounds = false;
                    this.drawOverlay();
                }
            } 
        },

        render: function () {
            return (<g />);
        }
    });

    module.exports = SuperselectOverlay;
});
