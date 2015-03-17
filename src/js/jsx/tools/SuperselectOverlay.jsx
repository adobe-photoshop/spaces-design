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
        d3 = require("d3");

    var system = require("js/util/system");

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

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                uiStore = flux.store("ui"),
                currentDocument = applicationStore.getCurrentDocument();

            return {
                document: currentDocument,
                marqueeEnabled: uiStore.marqueeEnabled(),
                marqueeStart: uiStore.marqueeStart()
            };
        },

        componentWillMount: function () {
            window.addEventListener("adapterFlagsChanged", this._handleExternalKeyEvent);
        },

        componentWillUnmount: function() {
            window.removeEventListener("adapterFlagsChanged", this._handleExternalKeyEvent);
        },

        componentDidMount: function () {
            this._currentMouseX = null;
            this._currentMouseY = null;
            this.drawOverlay();
        },

        componentDidUpdate: function () {
            this.drawOverlay();
        },

        clearOverlay: function () {
            var g = this.getDOMNode();
            d3.select(g).selectAll("*").remove();
        },

        /**
         * Attaches to mouse move events on the document rectangle
         * to update the mouse position and the marquee
         *
         * @param {SuperselectOverlay} component
         * @return {function()}
         */
        marqueeUpdater: function (component) {
            return function () {
                var position = d3.mouse(this);
                component._currentMouseX = position[0];
                component._currentMouseY = position[1];
                if (component.state.marqueeEnabled) {
                    component.updateMarqueeRect();
                }    
            };
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
            var transformObj = d3.transform(d3.select(this.getDOMNode().parentNode).attr("transform"));
                
            this._scale = 1 / transformObj.scale[0];

            var layerTree = currentDocument.layers;

            this.drawDocumentRectangle(svg, currentDocument.bounds);
            
            this.drawBoundRectangles(svg, layerTree);

            if (this.state.marqueeEnabled) {
                this.startSuperselectMarquee(svg);
            }
        },

        /**
         * Draws an invisible rectangle to catch all mouse move events
         *
         * @param {SVGElement} svg HTML element to draw in
         * @param {Bounds} bounds Document bounds
         */
        drawDocumentRectangle: function (svg, bounds) {
            this._scrimGroup = svg.insert("g", ".transform-control-group")
                .classed("superselect-bounds", true)
                .on("mousemove", this.marqueeUpdater(this));
            
            this._scrimGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", bounds.width)
                .attr("height", bounds.height)
                .style("fill-opacity", 0.0)
                .style("stroke-opacity", 0.0);
        },

        /**
         * Draws either superselectable or leaf layer bounding boxes
         * 
         * @param {SVGElement} svg SVG HTML element to draw in
         * @param {LayerTree} layerTree layerTree of the current document
         */
        drawBoundRectangles: function (svg, layerTree) {
            var indexOf = layerTree.indexOf.bind(layerTree),
                marquee = this.state.marqueeEnabled,
                scale = this._scale,
                renderLayers;

            if (this._leafBounds) {
                renderLayers = layerTree.leaves.sortBy(indexOf);
                // Hide the parent layer bounds
                d3.select(".selection-parent-bounds").
                    style("visibility", "hidden");
            } else {
                renderLayers = layerTree.selectable.sortBy(indexOf);
                // Show the parent layer bounds
                d3.select(".selection-parent-bounds").
                    style("visibility", "visible");
            }

            renderLayers.forEach(function (layer) {
                var bounds = layerTree.childBounds(layer);
                // Skip empty bounds
                if (!bounds) {
                    return;
                }

                var boundRect = this._scrimGroup.append("rect")
                        .attr("x", bounds.left)
                        .attr("y", bounds.top)
                        .attr("width", bounds.width)
                        .attr("height", bounds.height)
                        .attr("layer-id", layer.id)
                        .attr("id", "layer-" + layer.id)
                        .classed("layer-bounds", true);

                if (!marquee && !layer.selected) {
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
            // that is within the mouse cursor, and highlight/dehighlight it
            // If these were reset due to selection change/ redraw etc. we shouldn't be highlighting anything
            if (this._currentMouseX === null || this._currentMouseY === null) {
                return;
            }

            var topLayer = renderLayers.findLast(function (layer) {
                var bounds = layerTree.childBounds(layer);
                if (!bounds) {
                    return;
                }

                return !layer.selected && bounds.contains(this._currentMouseX, this._currentMouseY);
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
                .classed("superselect-marquee", true)
                .on("mousemove", this.marqueeUpdater(this));

            this._marqueeResult = null;

            // We send the action on mouseup event
            window.addEventListener("mouseup", this.marqueeMouseUpHandler);

            this.updateMarqueeRect();
        },

        /**
         * Calls the action and removes the listener so it's a one off listener
         *
         * @param {MouseEvent} event
         */
        marqueeMouseUpHandler: function (event) {
            if (this.state.marqueeEnabled) {
                var superselect = this.getFlux().actions.superselect;
                superselect.marqueeSelect(this.state.document, this._marqueeResult, event.shiftKey);
            }
            window.removeEventListener("mouseup", this.marqueeMouseUpHandler);
        },

        /**
         * Updates the marquee rectangle by changing size/location
         * and highlighting the correct layers
         */
        updateMarqueeRect: function () {
            if (!this._marqueeRect) {
                return;
            }

            var highlightedIDs = [],
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

            this._marqueeRect
                .attr("x", left)
                .attr("y", top)
                .attr("width", right - left)
                .attr("height", bottom - top);
            
            d3.selectAll(".layer-bounds").each(function() {
                var layer = d3.select(this),
                    layerLeft = parseInt(layer.attr("x")),
                    layerTop = parseInt(layer.attr("y")),
                    layerRight = layerLeft + parseInt(layer.attr("width")),
                    layerBottom = layerTop + parseInt(layer.attr("height")),
                    intersects = layerLeft < right && layerRight > left &&
                        layerTop < bottom && layerBottom > top;

                if (intersects) {
                    layer.classed("marquee-hover", true)
                        .style("stroke-width", 1.0 * scale);
                    highlightedIDs.push(parseInt(layer.attr("layer-id")));
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

        render: function () {
            return (<g />);
        }
    });

    module.exports = SuperselectOverlay;
});
