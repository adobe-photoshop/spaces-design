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
        Immutable = require("immutable"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        _ = require("lodash");

    var collection = require("js/util/collection");

    var NumberInput = require("js/jsx/shared/NumberInput"),
        Label = require("js/jsx/shared/Label"),
        SVGIcon = require("js/jsx/shared/SVGIcon"),
        CoalesceMixin = require("js/jsx/mixin/Coalesce"),
        nls = require("js/util/nls");

    var Rotate = React.createClass({
        mixins: [FluxMixin, CoalesceMixin],
        
        propTypes: {
            document: React.PropTypes.object
        },

        /**
         * Value of the input as user begins to scrub this control
         *
         * @type {number}
         */
        _scrubAngle: null,

        getInitialState: function () {
            return {
                value: 0
            };
        },

        componentWillReceiveProps: function (nextProps) {
            var curDocument = this.props.document,
                nextDocument = nextProps.document,
                curLayerIDs = collection.pluck(this.props.document.layers.selected, "id"),
                nextLayerIDs = collection.pluck(nextProps.document.layers.selected, "id");

            var differentSource = curDocument.id !== nextDocument.id ||
                !Immutable.is(curLayerIDs, nextLayerIDs);

            // If selection has changed, reset the value back to zero
            if (differentSource) {
                this.setState({
                    differentSource: true,
                    value: 0
                });
            } else {
                this.setState({
                    differentSource: false
                });
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return nextState.differentSource || this.state.value !== nextState.value;
        },

        /**
         * Force a re-render on undo/redo.
         *
         * @private
         */
        _handleHistoryStateChange: function () {
            this.setState({
                value: 0
            });
        },

        componentWillMount: function () {
            // HACK: force the rotation back to 0 on undo/redo. We explicitly
            // listen for changes here instead of with the StoreWatchMixin because
            // there is no relevant history state.
            this.getFlux().store("history")
                .on("timetravel", this._handleHistoryStateChange);
        },

        componentWillUnmount: function () {
            this.getFlux().store("history")
                .off("timetravel", this._handleHistoryStateChange);
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
                angleDelta = modAngle - this.state.value;

            if (angleDelta !== 0) {
                // We do not debounce this action, because state is kept in React component
                // and the view relies on amount of rotates being sent to Photoshop being accurate
                this.getFlux().actions.transform.rotate(document, angleDelta);
            }

            this.setState({
                value: modAngle
            });
        },

        /**
         * Starts scrubbing by playing a non-coalesced rotate action so we have a history state to go back to
         *
         * @private
         */
        _handleScrubBegin: function () {
            this._scrubAngle = this.state.value;
            this.startCoalescing();
        },

        /**
         * Throttled scrub handler
         *
         * @private
         * @param {number} deltaX How far the user has scrubbed in X axis
         */
        _handleScrub: _.throttle(function (deltaX) {
            var document = this.props.document,
                angleDelta = deltaX % 360;

            if (angleDelta !== 0) {
                this.getFlux().actions.transform.rotate(
                    document,
                    angleDelta,
                    { coalesce: this.shouldCoalesce() }
                );
            }

            var newAngle = this._scrubAngle + angleDelta;
            
            this.setState({
                value: newAngle
            });
        }, 100),

        /**
         * When scrub finishes, updates the stored rotation value
         *
         * @private
         */
        _handleScrubEnd: function () {
            this.stopCoalescing();
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
                    if (layer.isBackground || layer.isArtboard || layer.isAdjustment) {
                        return true;
                    }

                    var childBounds = layerTree.childBounds(layer);
                    return !childBounds || childBounds.empty;
                }) ||
                layers.every(function (layer) {
                    return document.layers.isEmptyGroup(layer);
                });
        },

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected,
                disabled = this._disabled(document, layers);

            return (
                <div className="control-group__horizontal">
                    <div>
                        <Label
                            onScrubStart={this._handleScrubBegin}
                            onScrub={this._handleScrub}
                            onScrubEnd={this._handleScrubEnd}
                            size="column-3"
                            title={nls.localize("strings.TOOLTIPS.SET_ROTATION")}>
                            <SVGIcon CSSID="rotation" />
                        </Label>
                        <NumberInput
                            disabled={disabled}
                            // HACK: This lets 0 as a value work and not be considered the starting value
                            value={disabled ? "" : this.state.value}
                            onChange={this._rotateLayer}
                            step={1}
                            bigstep={15}
                            ref="rotate"
                            size="column-4" />
                    </div>
                </div>
            );
        }
    });

    module.exports = Rotate;
});
