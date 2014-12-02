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
        _ = require("lodash");

    var Bounds = require("js/models/bounds"),
        TransformScrim = require("js/scrim/TransformScrim");

    var TransformOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool", "bounds", "layer", "application")],

        /**
         * React and D3 play nice together, as long as they don't touch the same DOM objects
         * This is the class responsible for editing anything under this <svg> element
         * TransformScrim
         */
        _transformScrim: null,

        // This React component is the container for D3 code, where in all d3 code is defined in
        // scrim folder. D3 and React both try to keep the DOM to themselves, 
        // so this component is a clear cut line for D3 modifications
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                toolStore = flux.store("tool"),
                currentDocument = applicationStore.getCurrentDocument(),
                selectedLayers = currentDocument ? 
                    currentDocument.layerTree.getSelectedLayers() : [],
                bounds = this._getOverallBounds(selectedLayers),
                parentBounds = _.chain(selectedLayers)
                    .pluck("parent")
                    .compact()
                    .pluck("bounds")
                    .compact()
                    .unique()
                    .value(),
                currentTool = toolStore.getCurrentTool(),
                hideOverlay = currentTool ? currentTool.disableTransformOverlay : false;
            
            return {
                layers: selectedLayers,
                parentBounds: parentBounds,
                bounds: bounds,
                hidden: hideOverlay
            };
        },

        componentDidMount: function () {
            var el = this.getDOMNode().parentNode;
            this._transformScrim = new TransformScrim(el, this, this.state);
        },

        componentDidUpdate: function () {
            var el = this.getDOMNode().parentNode;
            this._transformScrim.update(el, this.state);
        },

        componentWillUnmount: function () {
            var el = this.getDOMNode().parentNode;
            this._transformScrim.destroy(el);
        },

        /**
         * Calls setBounds on the current document with d3 supplied bounds
         *
         * @param  {Bound} newBounds Bounds calculated by D3 events
         */
        resizeLayers: function (newBounds) {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();
            
            flux.actions.transform.setBounds(currentDocument, this.state.bounds, newBounds);
        },

        /**
         * Calls rotate on the current document with d3 supplied angle
         *
         * @param  {number} newAngle Angle to rotate layer by in clockwise degrees
         */
        rotateLayers: function (newAngle) {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                currentDocument = applicationStore.getCurrentDocument();
            
            flux.actions.transform.rotate(currentDocument, newAngle);  
        },

        /**
         * Rendering a null object so React doesn't complain
         */
        render: function () {
            return (<g />);
        },

        /**
         * Given a set of layers, returns the bounding box over them all
         * This way we don't deal with layer objects in the d3 code, and keep it contained
         *
         * @param  {Array.<Layer>} layers Layers to calculate bbox around
         *
         * @return {Bound} Overall bounding box
         */
        _getOverallBounds: function (layers) {
            var _unionBounds = function (group, child) {
                if (!group) {
                    return new Bounds(child);
                } else if (!child) {
                    throw new Error ("Layer with no boundaries defined.");
                }

                // Since we're collecting on the group's bounds, we can edit those
                group._top = Math.min(group.top, child.top);
                group._left = Math.min(group.left, child.left);
                group._bottom = Math.max(group.bottom, child.bottom);
                group._right = Math.max(group.right, child.right);
                group._height = group.bottom - group.top;
                group._width = group.right - group.left;

                return group;
            };
         
            return _.chain(layers)
                .pluck("bounds")
                .reduce(_unionBounds, null)
                .value();
        }
    });

    module.exports = TransformOverlay;
});
