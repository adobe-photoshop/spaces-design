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

    var UI = require("adapter/ps/ui");

    var PolicyOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("policy", "ui")],

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                policyStore = flux.store("policy"),
                uiStore = flux.store("ui"),
                pointerPolicies = policyStore.getMasterPointerPolicyList(),
                canvasBounds = uiStore.getCloakRect();

            return {
                policies: pointerPolicies,
                canvasBounds: canvasBounds
            };
        },

        /**
         * D3 element where policies are being drawn
         *
         * @type {SVGElement}
         */
        _scrimGroup: null,

        /**
         * Debounced draw function, set in componentWillMount
         *
         * @type {function()}
         */
        _drawDebounced: null,

        componentWillMount: function () {
            this._drawDebounced = _.debounce(this.drawOverlay, 100, false);
        },
        
        componentDidMount: function () {
            this._drawDebounced();
        },

        componentDidUpdate: function () {
            this._drawDebounced();
        },

        /**
         * Draws the policy overlay showing where the pointer policies are
         */
        drawOverlay: function () {
            if (!this.isMounted()) {
                return;
            }

            var svg = d3.select(React.findDOMNode(this));

            svg.selectAll(".policy-overlays").remove();
            
            this._scrimGroup = svg.insert("g", ".policy-group")
                .classed("policy-overlays", true)
                .attr("transform", this.props.transformString);

            this.drawPolicies(this.state.policies);
            this.drawCanvasBounds(this.state.canvasBounds);
        },

        /**
         * Draws the pointer policies that have defined areas
         * 
         * @param {Array.<object>} policies
         */
        drawPolicies: function (policies) {
            policies.forEach(function (policy) {
                if (policy.area) {
                    var area = policy.area,
                        policyRect = this._scrimGroup
                        .append("rect")
                        .attr("x", area[0])
                        .attr("y", area[1])
                        .attr("width", area[2])
                        .attr("height", area[3])
                        .style("fill-opacity", "0.0")
                        .style("stroke-opacity", "0.0");
    
                    if (policy.action === UI.policyAction.ALWAYS_PROPAGATE) {
                        policyRect.style("stroke", "#008800")
                            .style("stroke-opacity", "1.0");
                    } else if (policy.action === UI.policyAction.NEVER_PROPAGATE) {
                        policyRect.style("stroke", "#FF2200")
                            .style("stroke-opacity", "1.0");
                    }
                }
            }, this);
        },

        /**
         * Draws the canvas bounds as defined by the UI edges.
         * 
         * @param {?object} canvasBounds
         */
        drawCanvasBounds: function (canvasBounds) {
            if (!canvasBounds) {
                return;
            }

            this._scrimGroup
                .append("rect")
                .attr("x", canvasBounds.left)
                .attr("y", canvasBounds.top)
                .attr("width", canvasBounds.right - canvasBounds.left)
                .attr("height", canvasBounds.bottom - canvasBounds.top)
                .style("fill-opacity", "0.0")
                .style("stroke", "hotpink")
                .style("stroke-width", "4px")
                .style("stroke-opacity", "1.0");
        },

        render: function () {
            return (<g />);
        }
    });

    module.exports = PolicyOverlay;
});
