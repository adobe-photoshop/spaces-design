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

    var SuperSelect = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("bounds", "layer", "application")],

         /**
         * Flag to tell us whether to render leaf rectangles or super select rectangles
         * @type {Boolean}
         */
        _leafBounds: false,

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();

            return {
                document: currentDocument
            };
        },

        componentDidMount: function () {
            this.drawBoundRectangles();
        },

        componentDidUpdate: function () {
            this.drawBoundRectangles();
        },

        /**
         * Draws either superselectable or leaf layer bounding boxes
         */
        drawBoundRectangles: function () {
            var currentDocument = this.state.document;

            if (!currentDocument) {
                return null;
            }

            var uiStore = this.getFlux().store("ui"),
                layerTree = currentDocument.layerTree,
                svg = d3.select(this.getDOMNode()),
                renderLayers;

            if (this._leafBounds) {
                renderLayers = _.sortBy(layerTree.getLeafLayers(), "index");
                renderLayers = layerTree.getSelectedLayers().concat(renderLayers);
            } else {
                renderLayers = _.sortBy(layerTree.getSelectableLayers(), "index");
            }
            
            svg.selectAll("*").remove();

            renderLayers.forEach(function (layer) {
                var bounds = layer.bounds;

                if (!bounds) {
                    return;
                }
                
                var pointCoords = [
                        uiStore.transformCanvasToWindow(bounds.left, bounds.top),
                        uiStore.transformCanvasToWindow(bounds.right, bounds.top),
                        uiStore.transformCanvasToWindow(bounds.right, bounds.bottom),
                        uiStore.transformCanvasToWindow(bounds.left, bounds.bottom)
                    ],
                    svgPoints = pointCoords.map(function (coord) { 
                        return coord.x + "," + coord.y;
                    }).join(" "),
                    boundRect = svg.append("polygon")
                        .attr("points", svgPoints)
                        .classed("layer-bounds", true);

                if (layer.selected) {
                    boundRect.classed("layer-bounds-selected", true);
                } else {
                    boundRect.classed("layer-bounds", true)
                        .on("mouseover", function () {
                            d3.select(this)
                                .classed("layer-bounds-hover", true);
                        })
                        .on("mouseout", function () {
                            d3.select(this)
                                .classed("layer-bounds-hover", false);
                        });
                }
            });
        },

        /**
         * Sets the leaf Bounds flag depending on whether cmd key press is changed since last move
         * And redraws the rectangles
         * @param  {SyntheticEvent} event
         */
        onMouseMove: function (event) {
            if (event.metaKey && !this._leafBounds) {
                this._leafBounds = true;
                this.drawBoundRectangles();
            } else if (!event.metaKey && this._leafBounds) {
                this._leafBounds = false;
                this.drawBoundRectangles();
            }
        },

        render: function () {
            return (
                <svg 
                    id="bounds" 
                    width="100%" 
                    height="100%"
                    onMouseMove={this.onMouseMove}>
                </svg>
            );
        }
    });

    module.exports = SuperSelect;
});
