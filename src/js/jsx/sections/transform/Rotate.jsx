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
        Immutable = require("immutable");

    var NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        collection = require("js/util/collection");

    var Rotate = React.createClass({
        mixins: [FluxMixin],
        
        propTypes: {
            document: React.PropTypes.object,
            layers: React.PropTypes.arrayOf(React.PropTypes.object)
        },

        /**
         * Last angle on input for relative rotation
         *
         * @type {number}
         */
        _lastAngle: null,

        componentWillReceiveProps: function () {
            // Reset this flag every time we receive new props
            this.setState({
                undo: false
            });
        },

        getInitialState: function () {
            return {
                undo: false
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            if (nextState.undo) {
                return true;
            }

            var curDocument = this.props.document,
                nextDocument = nextProps.document,
                curLayers = curDocument ? curDocument.layers.selected : Immutable.List(),
                nextLayers = nextDocument ? nextDocument.layers.selected : Immutable.List(),
                curLayerIDs = collection.pluck(curLayers, "id"),
                nextLayerIDs = collection.pluck(nextLayers, "id");

            return !Immutable.is(curLayerIDs, nextLayerIDs);
        },

        componentWillUpdate: function () {
            this._lastAngle = 0;
        },

        /*
         * Set the undo flag to force a re-render on undo/redo.
         *
         * @private
         */
        _handleHistoryStateChange: function () {
            this.setState({
                undo: true
            });
        },

        componentWillMount: function () {
            // HACK: force the rotation back to 0 on undo/redo. We explicitly
            // listen for changes here instead of with the StoreWatchMixin because
            // there is no relevant history state.
            this.getFlux().store("history")
                .on("change", this._handleHistoryStateChange);
        },

        componentWillUnmount: function () {
            this.getFlux().store("history")
                .off("change", this._handleHistoryStateChange);
        },

        /**
         * Rotates the selected layers by the entered angle - last value of the control
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newAngle
         */
        _rotateLayer: function (event, newAngle) {
            var document = this.props.document,
                modAngle = newAngle % 360,
                angleDelta = modAngle - this._lastAngle;

            if (angleDelta !== 0) {
                // We do not debounce this action, because state is kept in React component
                // and the view relies on amount of rotates being sent to Photoshop being accurate
                this.getFlux().actions.transform.rotate(document, angleDelta);
            }

            this._lastAngle = newAngle;
        },

        /**
         * Determine if rotate operations should be disabled for a given set of layers.
         * TRUE If layers is empty
         * or if either a background or adjustment layer is included
         * (note that adjustment layers are kind of OK, but seem to have subtle issues with bounds afterwards)
         * or if ALL layers are empty groups
         * or if any layers are artboards
         *
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layer>} layers
         * @return {boolean}
         */
        _disabled: function (document, layers) {
            var layerTree = document.layers;
            
            return document.unsupported ||
                layers.isEmpty() ||
                layers.some(function (layer) {
                    var childBounds = layerTree.childBounds(layer);

                    return layer.isBackground ||
                        layer.kind === layer.layerKinds.ADJUSTMENT ||
                        (!childBounds || childBounds.empty) ||
                        layer.isArtboard;
                }) ||
                layers.every(function (layer) {
                    return document.layers.isEmptyGroup(layer);
                });
        },


        render: function () {
            var document = this.props.document,
                layers = document ? document.layers.selected : Immutable.List(),
                disabled = !document || this._disabled(document, layers);

            return (
                <NumberInput
                    disabled={disabled}
                    //HACK: This lets 0 as a value work and not be considered the starting value
                    value={disabled ? "" : "0"}
                    onChange={this._rotateLayer}
                    step={1}
                    bigstep={15}
                    ref="rotate"
                    size="column-3" />
            
            );
        }
    });

    module.exports = Rotate;
});
