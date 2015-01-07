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

    var d3 = require("d3");

    /**
     * Creates the D3 model
     *
     * @param {Element} el svg element to draw in
     * @param {ReactComponent} parent Owner React component so we have access to provided functions
     * @param {object} state React component state
     */
    var TransformScrim = function (el, parent, state) {
        this._parent = parent;
        var svg = d3.select(el);

        svg.append("g")
            .classed("transform-control-group", true);

        svg.append("g")
            .classed("selection-bounds", true);
        
        this.update(el, state);
    };

    /**
     * Given an array of bounds, prepares data points for D3 to use on rendering
     *
     * @param {Array.<Bounds>} allBounds Array of bounds to map to data
     * @return {Array.<Array.<object>>} An array of arrays of points for each bounds
     */
    TransformScrim.prototype._buildBoundsData = function (allBounds) {
        return allBounds.map(function (bounds) {
            // Short circuit layers with empty bounds
            if (!bounds || (bounds.width === 0 && bounds.height === 0)) {
                return [];
            }

            return [
                {x: bounds.left, y: bounds.top, key: "nw"},
                {x: bounds.left + bounds.width / 2, y: bounds.top, key: "n"},
                {x: bounds.right, y: bounds.top, key: "ne"},
                {x: bounds.right, y: bounds.top + bounds.height / 2, key: "e"},
                {x: bounds.right, y: bounds.bottom, key: "se"},
                {x: bounds.left + bounds.width / 2, y: bounds.bottom, key: "s"},
                {x: bounds.left, y: bounds.bottom, key: "sw"},
                {x: bounds.left, y: bounds.top + bounds.height / 2, key: "w"}
            ];
        });
    };

    /**
     * Updates the D3 model
     *
     * @param {Element} el Owner SVG Element
     * @param {object} state React Component state
     */
    TransformScrim.prototype.update = function (el, state) {
        var scrim = d3.select(el);

        // We calculate the reverse scale here to draw the stroke width and rotate areas
        // at correct size no matter the zoom level
        var transformObj = d3.transform(d3.select(el).attr("transform"));
        this._scale = 1 / transformObj.scale[0];
        
        // Resets the transform of the anchors/bound
        scrim.selectAll(".transform-control-group")
            .attr("transform", null);

        scrim.selectAll(".anchor-points").remove();
        scrim.selectAll(".rotate-areas").remove();
        scrim.selectAll(".selection-bounds").remove();
        scrim.selectAll(".selection-parent-bounds").remove();
        
        if (!state.bounds || state.hidden) {
            return;
        }
        
        this._bounds = state.bounds;
        this._el = el;

        var data = this._buildBoundsData([this._bounds])[0],
            hiddenLayers = state.layers && state.layers.every(function (layer) {
                return !layer.visible;
            });

        // Don't draw parent Bounds while resizing / rotating
        if (state.parentBounds) {
            var parentData = this._buildBoundsData(state.parentBounds);
       
            this._drawParentBounds(parentData);
        }

        // Have to do them in this order so z-order is right
        if (!hiddenLayers) {
            this._drawRotationCorners(data);
        }

        this._drawSelectionBounds(data);
        
        if (!hiddenLayers) {
            this._drawCornerAnchors(data);
        }
    };

    /**
     * Removes the D3 model
     *
     * @param {Element} el Owner SVG element
     */
    TransformScrim.prototype.destroy = function (el) {
        d3.select(el).selectAll(".transform-control-group").remove();
    };

    /**
     * Resizing helper function, saves the initial bounds
     *
     * @private
     */
    TransformScrim.prototype._startResizing = function (d) {
        this._dragCorner = d.key;
        d3.select("#" + d.key + "-resize")
            .classed("anchor-dragging", true);
        this._initialBounds = this._bounds;
    };

    /**
     * Rotation helper function, we compute the center of the bounds here, and
     * the angle from the current anchor to center so calculating the offset is
     * easier.
     * 
     * @private
     * @param {object} d Data point that initiated rotate, we calculate initial angle using that
     */
    TransformScrim.prototype._startRotating = function (d) {
        d3.select(this._el).selectAll(".selection-parent-bounds").remove();
        d3.select("#" + d.key + "-resize")
            .classed("anchor-dragging", true);
        
        this._initialBounds = this._bounds;
        this._currentAngle = 0;
        this._initialAngle = Math.atan2(d.y - this._initialBounds.yCenter,
            d.x - this._initialBounds.xCenter) * 180 / Math.PI;
    };

    /**
     * Rotation helper function, calculate the new angle offset, and transforms the controls
     * to show user end result of rotation without applying it
     *
     * @private
     */
    TransformScrim.prototype._rotateBounds = function () {
        var inSteps = d3.event.sourceEvent.shiftKey,
            xDiff = d3.event.x - this._initialBounds.xCenter,
            yDiff = d3.event.y - this._initialBounds.yCenter,
            angleChange = Math.atan2(yDiff, xDiff) * 180 / Math.PI,
            // Add the change to last angle, and subtract from initial angle to find how much we're rotating
            degreeAngle = (this._currentAngle + angleChange - this._initialAngle) % 360;

        if (inSteps) {
            degreeAngle = Math.round(degreeAngle / 45) * 45;
        }

        // Get rid of -0 so transform renders correctly for 2PI
        degreeAngle = degreeAngle === -0 ? 0 : degreeAngle;

        this._currentAngle = degreeAngle;

        var transformString = "rotate(" +
                degreeAngle + " " +
                this._initialBounds.xCenter + "," +
                this._initialBounds.yCenter + ")";

        d3.select(this._el).selectAll(".transform-control-group")
            .attr("transform", transformString);
        
    };

    /**
     * Resize helper function, calculate the new bounds on drag resizing and updates local bound object
     *
     * @private
     * @param {object} d Data point drag was started on, used for it's key
     */
    TransformScrim.prototype._resizeBounds = function (d) {
        var proportional = d3.event.sourceEvent.shiftKey,
            mirrorOnEdge = d3.event.sourceEvent.altKey,
            sideResizing = false,
            difference = 0;

        // Reset the bounds
        var bounds = this._initialBounds;
        
        // Update the correct corner to the new mouse location
        switch (d.key) {
        case "nw":
            bounds = this._initialBounds.merge({
                left: d3.event.x,
                top: d3.event.y
            });
            break;
        case "n":
            sideResizing = true;
            bounds = this._initialBounds.set("top", d3.event.y);
            break;
        case "ne":
            bounds = this._initialBounds.merge({
                right: d3.event.x,
                top: d3.event.y
            });
            break;
        case "e":
            sideResizing = true;
            bounds = this._initialBounds.set("right", d3.event.x);
            break;
        case "se":
            bounds = this._initialBounds.merge({
                right: d3.event.x,
                bottom: d3.event.y
            });
            break;
        case "s":
            sideResizing = true;
            bounds = this._initialBounds.set("bottom", d3.event.y);
            break;
        case "sw":
            bounds = this._initialBounds.merge({
                left: d3.event.x,
                bottom: d3.event.y
            });
            break;
        case "w":
            sideResizing = true;
            bounds = this._initialBounds.set("left", d3.event.x);
            break;
        }
        
        if (proportional) {
            var nextWidth = bounds.width,
                nextHeight = bounds.height;

            if (sideResizing) {
                // For sides, we grow the two other sides equally keeping the ratio same
                var ratio = 0;

                switch (d.key) {
                case "n":
                case "s":
                    ratio = bounds.height / this._initialBounds.height;
                    nextWidth = this._initialBounds.width * ratio;
                    break;
                case "e":
                case "w":
                    ratio = bounds.width / this._initialBounds.width;
                    nextHeight = this._initialBounds.height * ratio;
                    break;
                }
            } else {
                // For corners, we find the smaller size and limit resizing to that
                var widthRatio = bounds.width / this._initialBounds.width,
                    heightRatio = bounds.height / this._initialBounds.height,
                    diagonal = this._initialBounds.width / this._initialBounds.height;

                // Using the signs of original ratios help us figure out four quadrant resizing
                if (heightRatio < widthRatio) {
                    nextWidth = Math.sign(heightRatio) *
                        Math.sign(widthRatio) *
                        bounds.height * diagonal;
                } else {
                    nextHeight = Math.sign(widthRatio) *
                        Math.sign(heightRatio) *
                        bounds.width / diagonal;
                }
            }

            // This allows us to offset for the corner we're resizing from
            switch (d.key) {
            case "nw":
                bounds = bounds.merge({
                    left: bounds.right - nextWidth,
                    top: bounds.bottom - nextHeight
                });
                break;
            case "n":
                difference = nextWidth - this._initialBounds.width;
                bounds = bounds.merge({
                    left: this._initialBounds.left - difference / 2,
                    right: this._initialBounds.right + difference / 2
                });
                break;
            case "ne":
                bounds = bounds.merge({
                    right: bounds.left + nextWidth,
                    top: bounds.bottom - nextHeight
                });
                break;
            case "e":
                difference = nextHeight - this._initialBounds.height;
                bounds = bounds.merge({
                    top: this._initialBounds.top - difference / 2,
                    bottom: this._initialBounds.bottom + difference / 2
                });
                break;
            case "se":
                bounds = bounds.merge({
                    right: bounds.left + nextWidth,
                    bottom: bounds.top + nextHeight
                });
                break;
            case "s":
                difference = nextWidth - this._initialBounds.width;
                bounds = bounds.merge({
                    left: this._initialBounds.left - difference / 2,
                    right: this._initialBounds.right + difference / 2
                });
                break;
            case "sw":
                bounds = bounds.merge({
                    left: bounds.right - nextWidth,
                    bottom: bounds.top + nextHeight
                });
                break;
            case "w":
                difference = nextHeight - this._initialBounds.height;
                bounds = bounds.merge({
                    top: this._initialBounds.top - difference / 2,
                    bottom: this._initialBounds.bottom + difference / 2
                });
                break;
            }
        }

        if (mirrorOnEdge) {
            // This allows us to offset for the corner we're resizing from
            switch (d.key) {
            case "n":
                difference = bounds.height - this._initialBounds.height;
                bounds = bounds.set("bottom", this._initialBounds.bottom + difference);
                break;
            case "e":
                difference = bounds.width - this._initialBounds.width;
                bounds = bounds.set("left", this._initialBounds.left - difference);
                break;
            case "s":
                difference = bounds.height - this._initialBounds.height;
                bounds = bounds.set("top", this._initialBounds.top - difference);
                break;
            case "w":
                difference = bounds.width - this._initialBounds.width;
                bounds = bounds.set("right", this._initialBounds.right + difference);
                break;
            }
        }

        this.update(this._el, {bounds: bounds});
    };

    /**
     * Rotation helper to clean up, also calls the apply function on parent
     *
     * @private
     */
    TransformScrim.prototype._finishRotating = function (d) {
        this._initialBounds = null;
        this._initialAngle = 0;

        d3.select("#" + d.key + "-resize")
            .classed("anchor-dragging", false);
        
        this._parent.rotateLayers(this._currentAngle);
        this._currentAngle = 0;
        this._dragCorner = null;
    };

    /**
     * Resize helper to clean up, also calls the apply function on parent
     *
     * @private
     */
    TransformScrim.prototype._finishResizing = function (d) {
        this._initialBounds = null;
        this._dragCorner = null;

        d3.select("#" + d.key + "-resize")
            .classed("anchor-dragging", false);
        
        this._parent.resizeLayers(this._bounds);
    };


    /**
     * Draws the rotation areas on four corners of the bounds
     * 
     * @private
     * @param {Array.<object>} data Data list containing corners
     */
    TransformScrim.prototype._drawRotationCorners = function (data) {
        var g = d3.select(this._el).selectAll(".transform-control-group"),
            anchor = g.selectAll(".rotate-anchor")
                // Attaches data to the rotation anchors
                .data(data, function (d) { return d.key; }),
            scale = this._scale;

        // Defines the rotation behavior
        var dragRotate = d3.behavior.drag()
            .origin(function (d) { return d; })
            .on("dragstart", this._startRotating.bind(this))
            .on("drag", this._rotateBounds.bind(this))
            .on("dragend", this._finishRotating.bind(this));

        // Defines the size variables for the SVG being drawn
        var innerRadius = 4,
            outerRadius = 16;

        // Defines a d3 arc object given the data object
        var makeArc = function (d) {
            // Calculate angle as quadrants, then multiply by 90 degrees
            // 0 is North, 1 is East etc.
            var startAngle, endAngle;

            switch (d.key) {
            case "nw":
                startAngle = 3;
                endAngle = 4;
                break;
            case "ne":
                startAngle = 0;
                endAngle = 1;
                break;
            case "se":
                startAngle = 1;
                endAngle = 2;
                break;
            case "sw":
                startAngle = 2;
                endAngle = 3;
                break;
            default:
                startAngle = 0;
                endAngle = 0;
            }

            startAngle = startAngle * Math.PI / 2;
            endAngle = endAngle * Math.PI / 2;

            var arcFn = d3.svg.arc()
                .innerRadius(innerRadius * scale)
                .outerRadius(outerRadius * scale)
                .startAngle(startAngle)
                .endAngle(endAngle);
            
            return arcFn(d);
        };


        // Dive into the anchor selector and for each point, append a SVG arc shape
        anchor.enter()
            .append("path")
            .classed("rotate-areas", true)
            .attr("d", function (d) { return makeArc(d); })
            .attr("id", function (d) { return d.key + "-rotate";})
            // Make sure arcs we drew are on four corners
            .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            })
            // Hover behavior
            .on("mouseover", function () {
                d3.select(this)
                    .classed("rotate-area-hover", true);
            })
            // Mouse out behavior
            .on("mouseout", function () {
                d3.select(this)
                    .classed("rotate-area-hover", false);
            })
            // Prevents mouse clicks from being sent down
            .on("mousedown", function () {
                d3.event.stopPropagation();
            })
            // Attach the drag behavior
            .call(dragRotate);
        
        // Gets us out of the anchor data set and lets d3 know it's ok to draw
        anchor.exit()
            .remove();
    };

    /**
     * Draws a different classed bounds around immediate parents of selected layers
     *
     * @private
     * @param {Immutable.List.<object>} data Data list containing corner points for each bound
     */
    TransformScrim.prototype._drawParentBounds = function (data) {
        var g = d3.select(this._el).selectAll(".transform-control-group"),
            bounds = g.selectAll(".parent-bounds")
                .data(data.toArray()),
            strokeWidth = 3.0;

        bounds.enter()
            .append("polygon")
                .attr("points", function (d) {
                    return d.map(function (p) {
                        return [p.x, p.y].join(",");
                    }).join(" ");
                })
                .classed("selection-parent-bounds", true)
                // We style the stroke width here so we can scale it correctly
                .style("stroke-width", strokeWidth * this._scale)
                // Lets pointer events fall through to other SVG shapes
                .style("pointer-events", "none");
                
        bounds.exit()
            .remove();
    };

    /**
     * Draws the bounds around the selection
     *
     * @private
     * @param {Array.<object>} data Data list containing corners
     */
    TransformScrim.prototype._drawSelectionBounds = function (data) {
        var g = d3.select(this._el).selectAll(".transform-control-group"),
            bounds = g.selectAll(".transform-bounds")
                .data([data]),
            strokeWidth = 1.5;

        // Maps all given points to a polygon anchor
        bounds.enter()
            .append("polygon")
                .attr("points", function (d) {
                    return d.map(function (p) {
                        return [p.x, p.y].join(",");
                    }).join(" ");
                })
                .classed("selection-bounds", true)
                // We style the stroke width here so we can scale it correctly
                .style("stroke-width", strokeWidth * this._scale)
                // Lets pointer events fall through to other SVG shapes
                .style("pointer-events", "none");

        bounds.exit()
            .remove();
    };

    /**
     * Draws the corner anchors
     *
     * @private
     * @param {Array.<object>} data Data list containing corners
     */
    TransformScrim.prototype._drawCornerAnchors = function (data) {
        var g = d3.select(this._el).selectAll(".transform-control-group"),
            anchor = g.selectAll(".transform-anchor")
                .data(data, function (d) { return d.key; }),
            scale = this._scale,
            dragCorner = this._dragCorner;

        // Define all size variables here
        var anchorRadius = 3.5,
            hoverRadius = 5,
            strokeWidth = 1.0;

        // Define the drag behavior here
        var dragResize = d3.behavior.drag()
            .origin(function (d) { return d; })
            .on("dragstart", this._startResizing.bind(this))
            .on("drag", this._resizeBounds.bind(this))
            .on("dragend", this._finishResizing.bind(this));
            
        anchor.enter()
            //Draw a rectangle for each data point
            .append("circle")
            .classed("anchor-points", true)
            .classed("anchor-dragging", function (d) { return d.key === dragCorner; })
            .attr("id", function (d) { return d.key + "-resize";})
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .attr("r", anchorRadius * scale)
            // Set the stroke width style here so we can scale
            .style("stroke-width", strokeWidth * scale)
            // Sets the HTML cursor for each anchor
            .style("cursor", function (d) { return d.key + "-resize"; })
            // Sets the class on mouse over
            .on("mouseover", function () {
                d3.select(this)
                    .attr("r", hoverRadius * scale)
                    .classed("anchor-hover", true);
            })
            // Resets the class on mouse over
            .on("mouseout", function () {
                d3.select(this)
                    .attr("r", anchorRadius * scale)
                    .classed("anchor-hover", false);
            })
            // Stops the mouse event from being sent to other SVG shapes
            .on("mousedown", function () {
                d3.event.stopPropagation();
            })
            // Define anchor behavior for drag
            .call(dragResize);
        
        anchor.exit()
            .remove();
    };
    
    /**
     * Current bounds drawn by D3
     *
     * @type {Bounds}
     */
    TransformScrim.prototype._bounds = null;

    /**
     * SVG Element D3 controls
     *
     * @type {Element}
     */
    TransformScrim.prototype._el = null;

    /**
     * Pointer back to scrim Component
     *
     * @type {object}
     */
    TransformScrim.prototype._parent = null;

    /**
     * Bounds at the start of a drag operation
     *
     * @type {Bounds}
     */
    TransformScrim.prototype._initialBounds = null;

    /**
     * Angle from center to the drag point at the beginning of rotate
     *
     * @type {number}
     */
    TransformScrim.prototype._initialAngle = 0;

    /**
     * Angle from center to the current drag point during drag rotate
     *
     * @type {number}
     */
    TransformScrim.prototype._currentAngle = 0;

    /**
     * Scaling to be applied to all stroke widths 
     * so SVG elements don't get drawn bigger as document zoom changes
     *
     * @type {number}
     */
    TransformScrim.prototype._scale = null;

    /**
     * Key of the corner being dragged
     *
     * @type {string}
     */
    TransformScrim.prototype._dragCorner = null;


    module.exports = TransformScrim;
});
