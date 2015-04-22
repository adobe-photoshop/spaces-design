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
        _ = require("lodash");

    var Bounds = require("js/models/bounds"),
        TransformScrim = require("js/scrim/TransformScrim");

    // Temporarily here until we can hide artboard bounds in PS
    var HIDE_ARTBOARDS = false;

    // Used for debouncing drawing the overlay
    var DEBOUNCE_DELAY = 200;

    var TransformOverlay = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool", "document", "application", "ui")],

        /**
         * React and D3 play nice together, as long as they don't touch the same DOM objects
         * This is the class responsible for editing anything under this <svg> element
         * TransformScrim
         */
        _transformScrim: null,

        /**
         * During certain drags, especially with Artboards, we get a lot of
         * UI updating events, document resizes etc. we debounce drawing functions
         * so our overlays don't play catch up
         *
         * @type {function}
         */
        _drawDebounced: null,

        // This React component is the container for D3 code, where in all d3 code is defined in
        // scrim folder. D3 and React both try to keep the DOM to themselves, 
        // so this component is a clear cut line for D3 modifications
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                applicationStore = flux.store("application"),
                toolStore = flux.store("tool"),
                document = applicationStore.getCurrentDocument(),
                selectedLayers = document ? document.layers.selected : Immutable.List(),
                parentBounds = document ? this._getSelectedParentBounds(document.layers) : Immutable.List(),
                currentTool = toolStore.getCurrentTool(),
                modalState = toolStore.getModalToolState(),
                hidden = modalState || (currentTool ? currentTool.hideTransformOverlay : false),
                noResize = (currentTool ? currentTool.hideTransformControls : false) ||
                    (document ? this._resizeLocked(document.layers) : true),
                noRotation = (currentTool ? currentTool.hideTransformControls : false) ||
                    (document ? this._rotationLocked(document.layers) : true),
                bounds;
            
            if (HIDE_ARTBOARDS) {
                // TEMPORARY HACK: REMOVES ARTBOARDS FROM SELECTION / BOUNDS
                var childbounds = document && document.layers.selected
                    .filterNot(function (layer) {
                        return layer.isArtboard;
                    })
                    .map(function (layer) {
                        return document.layers.childBounds(layer);
                    }, this)
                    .filter(function (bounds) {
                        return bounds && bounds.area > 0;
                    });

                bounds = document && Bounds.union(childbounds);
            } else {
                bounds = document && document.layers.selectedAreaBounds;
            }

            return {
                layers: selectedLayers,
                parentBounds: parentBounds,
                bounds: bounds,
                hidden: hidden,
                noResize: noResize,
                noRotation: noRotation
            };
        },

        /**
         * When the overlay is mounted, we initialize the D3 graphics
         */
        componentDidMount: function () {
            var el = this.getDOMNode();
            this._transformScrim = new TransformScrim(el, this.getFlux());
            this._drawDebounced = _.debounce(this.drawOverlay, DEBOUNCE_DELAY);

            this._drawDebounced();
        },

        /**
         * If anything is updated from the React side, we also update the D3 graphics
         */
        componentDidUpdate: function () {
            this._drawDebounced();
        },

        /**
         * On component unmount, we also clean the D3 graphics
         */
        componentWillUnmount: function () {
            this._transformScrim.destroy(this.getDOMNode());
        },

        /**
         * This method is debounced so we don't play catch up to Photoshop
         * when we're bombarded with updates
         */
        drawOverlay: function () {
            if (!this.isMounted()) {
                return;
            }
            
            this._transformScrim.update(this.getDOMNode(), this.state);
        },

        /**
         * This method is called by the owner Scrim to clear out D3 graphics
         */
        clearOverlay: function () {
            this._transformScrim.clear(this.getDOMNode());
        },   

        /**
         * Rendering a null object so React doesn't complain
         */
        render: function () {
            return (<g transform={this.props.transformString}/>);
        },

        /**
         * Get the child-encompassing bounds of the parents of the selected layers.
         * 
         * @param {LayerStructure} layerTree
         * @return {Immutable.List.<Bounds>}
         */
        _getSelectedParentBounds: function (layerTree) {
            return Immutable.List(layerTree.selected.reduce(function (allBounds, layer) {
                var parent = layerTree.parent(layer);
                if (parent) {
                    var bounds = layerTree.childBounds(parent);
                    if (bounds) {
                        allBounds.add(bounds);
                    }
                }
                return allBounds;
            }, new Set()));
        },

        /**
         * Determines whether we should hide BOTH rotation and resize controls.
         *
         * @private
         * @param {LayerStructure} layerTree
         * @return {boolean}
         */
        _bothLocked: function (layerTree) {
            var selectedLayers = layerTree.selected;

            return (selectedLayers.first() && selectedLayers.first().isBackground) ||
                (selectedLayers.size > 1 && selectedLayers.some(function (layer) {
                    return layer.isArtboard;
                })) ||
                selectedLayers.some(function (layer) {
                    return layer.kind === layer.layerKinds.ADJUSTMENT ||
                    layerTree.hasLockedDescendant(layer) ||
                    layerTree.hasLockedAncestor(layer);
                }) ||
                selectedLayers.every(function (layer) {
                    return !layer.visible;
                });
        },

        /**
         * Determines whether we should show rotation controls or not
         * Current rules are:
         *  - There is an artboard layer in the selection
         *
         * @param {LayerStructure} layerTree
         * @return {boolean}
         */
        _rotationLocked: function (layerTree) {
            var selectedLayers = layerTree.selected;

            return this._bothLocked(layerTree) || selectedLayers.some(function (layer) {
                return layer.isArtboard;
            });
        },

        /**
         * Determines whether we should show the controls or not
         * Current rules are:
         *  - Background layer is selected
         *  - There are multiple layers selected and at least one of them is an artboard
         *  - There is a text layer in selection
         *  - There is an adjustment layer in the selection
         *  - A locked layer is selected
         *  - All selected layers are hidden
         *
         * @param {LayerStructure} layerTree
         * @return {boolean} [description]
         */
        _resizeLocked: function (layerTree) {
            var selectedLayers = layerTree.selected;

            return this._bothLocked(layerTree) || selectedLayers.some(function (layer) {
                return layer.kind === layer.layerKinds.TEXT;
            });
        }
    });

    module.exports = TransformOverlay;
});
