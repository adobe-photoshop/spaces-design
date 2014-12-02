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

    var Bounds = require("js/models/bounds");

    /**
     * Creates the D3 model
     *
     * @param  {Element} el svg element to draw in
     * @param  {ReactComponent} parent Owner React component so we have access to provided functions
     * @param  {Object} state React component state
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
     * @param  {Array.<Bounds>} allBounds Array of bounds to map to data
     *
     * @return {Array.<Array.<Object>>} An array of arrays of points for each bounds
     */
    TransformScrim.prototype._buildBoundsData = function (allBounds) {
        return allBounds.map(function (bounds) {
            return bounds ? [
                {x: bounds.left, y: bounds.top, key: "nw"},
                {x: bounds.right, y: bounds.top, key: "ne"},
                {x: bounds.right, y: bounds.bottom, key: "se"},
                {x: bounds.left, y: bounds.bottom, key: "sw"}
            ] : [];
        });
    };

    /**
     * Updates the D3 model
     *
     * @param  {Element} el Owner SVG Element
     * @param  {Object} state React Component state
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
        
        // Copy our current bound object so we don't change the original
        this._bounds = new Bounds(state.bounds);
        this._el = el;

        var data = this._buildBoundsData([this._bounds])[0];

        // Don't draw parent Bounds while resizing / rotating
        if (state.parentBounds) {
            var parentData = this._buildBoundsData(state.parentBounds);
       
            this._drawParentBounds(parentData);
        }

        this._drawRotationCorners(data);
        this._drawSelectionBounds(data);
        this._drawCornerAnchors(data);
    };

    /**
     * Removes the D3 model
     *
     * @param  {Element} el Owner SVG element
     */
    TransformScrim.prototype.destroy = function (el) {
        d3.select(el).selectAll(".transform-control-group").remove();
    };

    /**
     * Resizing helper function, saves the initial bounds
     * @private
     */
    TransformScrim.prototype._startResizing = function () {
        this._initialBounds = new Bounds(this._bounds);
    };

    /**
     * Rotation helper function, we compute the center of the bounds here, and the angle from the current
     * anchor to center so calculating the offset is easier
     * @private
     * @param  {Object} d Data point that initiated rotate, we calculate initial angle using that
     */
    TransformScrim.prototype._startRotating = function (d) {
        d3.select(this._el).selectAll(".selection-parent-bounds").remove();
        
        this._initialBounds = new Bounds(this._bounds);
        this._initialBounds.xCenter = this._initialBounds.left + this._initialBounds.width / 2;
        this._initialBounds.yCenter = this._initialBounds.top + this._initialBounds.height / 2;
        this._currentAngle = 0;
        this._initialAngle = Math.atan2(d.y - this._initialBounds.yCenter,
            d.x - this._initialBounds.xCenter) * 180 / Math.PI;
    };

    /**
     * Rotation helper function, calculate the new angle offset, and transforms the controls
     * to show user end result of rotation without applying it
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
     * @private`
     * @param  {Object} d Data point drag was started on, used for it's key
     */
    TransformScrim.prototype._resizeBounds = function (d) {
        var proportional = d3.event.sourceEvent.shiftKey;

        // Update the correct corner to the new mouse location
        switch (d.key) {
        case "nw":
            this._bounds._left = d3.event.x;
            this._bounds._top = d3.event.y;
            break;
        case "ne":
            this._bounds._right = d3.event.x;
            this._bounds._top = d3.event.y;
            break;
        case "se":
            this._bounds._right = d3.event.x;
            this._bounds._bottom = d3.event.y;
            break;
        case "sw":
            this._bounds._left = d3.event.x;
            this._bounds._bottom = d3.event.y;
            break;
        }
        
        this._bounds._width = this._bounds.right - this._bounds.left;
        this._bounds._height = this._bounds.bottom - this._bounds.top;
        
        // We find the side that's smaller and scale the bounds according to that size
        if (proportional) {
            var widthRatio = this._bounds.width / this._initialBounds.width,
                heightRatio = this._bounds.height / this._initialBounds.height,
                diagonal = this._initialBounds.width / this._initialBounds.height;

            // Using the signs of original ratios help us figure out four quadrant resizing
            if (heightRatio < widthRatio) {
                this._bounds._width = Math.sign(heightRatio) *
                    Math.sign(widthRatio) *
                    this._bounds.height * diagonal;
            } else {
                this._bounds._height = Math.sign(widthRatio) *
                    Math.sign(heightRatio) *
                    this._bounds.width / diagonal;
            }

            // This allows us to offset for the corner we're resizing from
            switch (d.key) {
            case "nw":
                this._bounds._left = this._bounds.right - this._bounds.width;
                this._bounds._top = this._bounds.bottom - this._bounds.height;
                break;
            case "ne":
                this._bounds._right = this._bounds.left + this._bounds.width;
                this._bounds._top = this._bounds.bottom - this._bounds.height;
                break;
            case "se":
                this._bounds._right = this._bounds.left + this._bounds.width;
                this._bounds._bottom = this._bounds.top + this._bounds.height;
                break;
            case "sw":
                this._bounds._left = this._bounds.right - this._bounds.width;
                this._bounds._bottom = this._bounds.top + this._bounds.height;
                break;
            }
        }

        this.update(this._el, {bounds: this._bounds});
    };

    /**
     * Rotation helper to clean up, also calls the apply function on parent
     * @private
     */
    TransformScrim.prototype._finishRotating = function () {
        this._initialBounds = null;
        this._initialAngle = 0;

        this._parent.rotateLayers(this._currentAngle);
        this._currentAngle = 0;
    };

    /**
     * Resize helper to clean up, also calls the apply function on parent
     * @private
     */
    TransformScrim.prototype._finishResizing = function () {
        this._initialBounds = null;
        
        this._parent.resizeLayers(this._bounds);
    };


    /**
     * Draws the rotation areas on four corners of the bounds
     * @private
     * @param  {Array.<Object>} data Data list containing corners
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
            }

            startAngle = startAngle * Math.PI / 2;
            endAngle = endAngle * Math.PI / 2;

            var arcFn = d3.svg.arc()
                .innerRadius(5 * scale)
                .outerRadius(25 * scale)
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
            // Changes the mouse over cursor for the areas
            .style("cursor", "crosshair")
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
     * @private
     * @param {Array.<Object>} data Data list containing corner points for each bound
     */
    TransformScrim.prototype._drawParentBounds = function (data) {
        var g = d3.select(this._el).selectAll(".transform-control-group"),
            bounds = g.selectAll(".parent-bounds")
                .data(data);

        bounds.enter()
            .append("polygon")
                .attr("points", function (d) {
                    return d.map(function (p) {
                        return [p.x, p.y].join(",");
                    }).join(" ");
                })
                .classed("selection-parent-bounds", true)
                // We style the stroke width here so we can scale it correctly
                .style("stroke-width", 1.0 * this._scale)
                // Lets pointer events fall through to other SVG shapes
                .style("pointer-events", "none");
                
        bounds.exit()
            .remove();
    };

    /**
     * Draws the bounds around the selection
     * @private
     * @param  {Array.<Object>} data Data list containing corners
     */
    TransformScrim.prototype._drawSelectionBounds = function (data) {
        var g = d3.select(this._el).selectAll(".transform-control-group"),
            bounds = g.selectAll(".transform-bounds")
                .data([data]);

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
                .style("stroke-width", 1.5 * this._scale)
                // Lets pointer events fall through to other SVG shapes
                .style("pointer-events", "none");

        bounds.exit()
            .remove();
    };

    /**
     * Draws the corner anchors
     * @private
     * @param  {Array.<Object>} data Data list containing corners
     */
    TransformScrim.prototype._drawCornerAnchors = function (data) {
        var g = d3.select(this._el).selectAll(".transform-control-group"),
            anchor = g.selectAll(".transform-anchor")
                .data(data, function (d) { return d.key; });

        // Defines half of a side for the drag anchor, change this for anchor size
        var anchorSide = 5 * this._scale;

        // Define the drag behavior here
        var dragResize = d3.behavior.drag()
            .origin(function (d) { return d; })
            .on("dragstart", this._startResizing.bind(this))
            .on("drag", this._resizeBounds.bind(this))
            .on("dragend", this._finishResizing.bind(this));

            
        anchor.enter()
            //Draw a rectangle for each data point
            .append("rect")
            .classed("anchor-points", true)
            .attr("id", function (d) { return d.key + "-resize";})
            .attr("x", function (d) { return d.x - anchorSide / 2; })
            .attr("y", function (d) { return d.y - anchorSide / 2; })
            .attr("width", anchorSide)
            .attr("height", anchorSide)
            // Set the stroke width style here so we can scale
            .style("stroke-width", 1.0 * this._scale)
            // Sets the HTML cursor for each anchor
            .style("cursor", function (d) { return d.key + "-resize"; })
            // Sets the class on mouse over
            .on("mouseover", function () {
                d3.select(this)
                    .classed("anchor-hover", true);
            })
            // Resets the class on mouse over
            .on("mouseout", function () {
                d3.select(this)
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
     * @type {Object}
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
     * @type {Number}
     */
    TransformScrim.prototype._initialAngle = 0;

    /**
     * Angle from center to the current drag point during drag rotate
     *
     * @type {Number}
     */
    TransformScrim.prototype._currentAngle = 0;

    /**
     * Scaling to be applied to all stroke widths 
     * so SVG elements don't get drawn bigger as document zoom changes
     *
     * @type {Number}
     */
    TransformScrim.prototype._scale = null;


    module.exports = TransformScrim;
});
