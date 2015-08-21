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

    var mathUtil = require("js/util/math");

    // Used for debouncing the overlay drawing
    var DEBOUNCE_DELAY = 200;

    var GuidesOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("document", "tool", "application", "ui")],

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
         * Debounced draw function, for performance
         * 
         * @type {function}
         */
        _drawDebounced: null,

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                toolStore = flux.store("tool"),
                modalState = toolStore.getModalToolState(),
                currentTool = toolStore.getCurrentTool(),
                currentDocument = applicationStore.getCurrentDocument();

            return {
                document: currentDocument,
                tool: currentTool,
                modalState: modalState
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
                currentTool = this.state.tool,
                svg = d3.select(React.findDOMNode(this));

            svg.selectAll(".guide-edges").remove();

            if (!currentDocument || this.state.modalState ||
                !currentDocument.guidesVisible ||
                !currentTool || currentTool.id !== "newSelect") {
                return null;
            }

            this._scrimGroup = svg.insert("g", ".transform-control-group")
                .classed("guide-edges", true);

            this.drawGuideEdges();
        },

        // Draws the guide edge areas
        drawGuideEdges: function () {
            var uiStore = this.getFlux().store("ui"),
                canvasBounds = uiStore.getCloakRect(),
                edgeThickness = 20, // How wide/tall the guide creation edges are
                canvasWidth = canvasBounds.right - canvasBounds.left,
                canvasHeight = canvasBounds.bottom - canvasBounds.top;

            // Top edge
            this._scrimGroup
                .append("rect")
                .attr("x", canvasBounds.left)
                .attr("y", canvasBounds.top)
                .attr("width", canvasWidth)
                .attr("height", edgeThickness)
                .attr("orientation", "horizontal")
                .classed("guide-edges", true);

            // Left edge
            this._scrimGroup
                .append("rect")
                .attr("x", canvasBounds.left)
                .attr("y", canvasBounds.top)
                .attr("width", edgeThickness)
                .attr("height", canvasHeight)
                .attr("orientation", "vertical")
                .classed("guide-edges", true);

            // Bottom edge
            this._scrimGroup
                .append("rect")
                .attr("x", canvasBounds.left)
                .attr("y", canvasBounds.bottom - edgeThickness)
                .attr("width", canvasWidth)
                .attr("height", edgeThickness)
                .attr("orientation", "horizontal")
                .classed("guide-edges", true);

            // Right edge
            this._scrimGroup
                .append("rect")
                .attr("x", canvasBounds.right - edgeThickness)
                .attr("y", canvasBounds.top)
                .attr("width", edgeThickness)
                .attr("height", canvasHeight)
                .attr("orientation", "vertical")
                .classed("guide-edges", true);
        },

        /**
         * Goes through all layer bounds and highlights the top one the cursor is on
         *
         * @private
         */
        updateMouseOverHighlights: function () {
            var mouseX = this._currentMouseX,
                mouseY = this._currentMouseY,
                highlightFound = false,
                self = this;

            d3.selectAll(".guide-edges").each(function () {
                var guide = d3.select(this),
                    guideLeft = mathUtil.parseNumber(guide.attr("x")),
                    guideTop = mathUtil.parseNumber(guide.attr("y")),
                    guideRight = guideLeft + mathUtil.parseNumber(guide.attr("width")),
                    guideBottom = guideTop + mathUtil.parseNumber(guide.attr("height")),
                    orientation = guide.attr("orientation"),
                    intersects = guideLeft < mouseX && guideRight > mouseX &&
                        guideTop < mouseY && guideBottom > mouseY;

                if (!highlightFound && intersects) {
                    guide.classed("guide-edges__hover", true)
                        .on("mousedown", function () {
                            d3.select(this)
                                .classed("guide-edges__hover", false);
                            
                            self.getFlux().actions.guides.createGuideAndTrack(
                                self.state.document, orientation, mouseX, mouseY
                            );

                            d3.event.stopPropagation();
                        });

                    highlightFound = true;
                } else {
                    guide.classed("guide-edges__hover", false);
                }
            });
        },

        render: function () {
            return (<g />);
        }
    });

    module.exports = GuidesOverlay;
});
