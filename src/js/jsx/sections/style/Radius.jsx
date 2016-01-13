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
        
    var Label = require("js/jsx/shared/Label"),
        NumberInput = require("js/jsx/shared/NumberInput"),
        Range = require("js/jsx/shared/Range"),
        Coalesce = require("js/jsx/mixin/Coalesce"),
        math = require("js/util/math"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection");

    var Radius = React.createClass({
        mixins: [FluxMixin, Coalesce],

        propTypes: {
            document: React.PropTypes.object.isRequired
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return !Immutable.is(this.props.document.layers.selected, nextProps.document.layers.selected) ||
                this.state !== nextState;
        },

        componentWillReceiveProps: function (nextProps) {
            var getRelevantProps = function (props) {
                    return collection.pluckAll(props.document.layers.selected, ["id", "bounds", "radii"]);
                },
                relevantProps = getRelevantProps(this.props),
                nextRelevantProps = getRelevantProps(nextProps);

            if (!Immutable.is(relevantProps, nextRelevantProps)) {
                this._calculateState(nextProps.document.layers.selected, nextProps.disabled);
            }
        },

        /**
         * Handler for the document store's "radiiChange" event, which is emitted
         * when just the radii of selected layers have changed.
         *
         * @param {Document} document
         */
        _handleStoreChange: function (document) {
            if (document.id !== this.props.document.id) {
                return;
            }

            this._calculateState(document.layers.selected, this.props.disabled);
        },

        componentWillMount: function () {
            this._calculateState(this.props.document.layers.selected, this.props.disabled);
            this.getFlux().store("document").on("radiiChange", this._handleStoreChange);
        },

        componentWillUnmount: function () {
            this.getFlux().store("document").off("radiiChange", this._handleStoreChange);
        },

        /**
         * Given the props object, calculates and sets the state. This is factored
         * out of componentWillReceiveProps, because it doesn't run on initial render,
         * causing a null state.
         *
         * @private
         * @param {Immutable.List.<Layer>} layers
         * @param {boolean=} forceDisabled
         */
        _calculateState: function (layers, forceDisabled) {
            var disabled = forceDisabled || layers.every(function (layer) {
                    return !layer.radii;
                }),
                shapeLayers = layers.filter(function (layer) {
                    return layer.radii;
                }),
                scalars = shapeLayers.map(function (layer) {
                    return layer.radii.scalar || 0;
                }),
                maxRadius = shapeLayers
                    .toSeq()
                    .filter(function (layer) {
                        return !!layer.bounds;
                    })
                    .reduce(function (sides, layer) {
                        return sides.concat(Immutable.List.of(layer.bounds.width / 2, layer.bounds.height / 2));
                    }, Immutable.List())
                    .min();

            this.setState({
                disabled: disabled,
                layers: shapeLayers,
                scalars: scalars,
                maxRadius: maxRadius,
                maxRadiusInput: Math.floor(maxRadius)
            });
        },

        _handleScrubStart: function () {
            var currentRadius = collection.uniformValue(this.state.scalars);

            // This initial call helps set the history state right before coalescing
            if (currentRadius !== null) {
                this.setState({
                    scrubRadius: currentRadius
                });

                this.startCoalescing();
            }
        },

        _handleRadiusScrub: function (deltaX) {
            if (this.state.scrubRadius === null) {
                return;
            }

            var newRadius = this.state.scrubRadius + deltaX,
                currentRadius = collection.uniformValue(this.state.scalars);

            newRadius = math.clamp(newRadius, 0, this.state.maxRadius);

            if (newRadius !== currentRadius) {
                this.getFlux().actions.transform.setRadiusThrottled(
                    this.props.document,
                    this.state.layers,
                    newRadius,
                    { coalesce: this.shouldCoalesce() }
                );
            }
        },

        _handleScrubEnd: function () {
            this.setState({
                scrubRadius: null
            });

            this.stopCoalescing();
        },

        /**
         * Update the radius of the selected layers in response to user input.
         *
         * @param {SyntheticEvent} event
         * @param {number=} value
         */
        _handleRadiusChange: function (event, value) {
            if (value === undefined) {
                // In this case, the value is coming from the DOM element
                value = math.parseNumber(event.target.value);
            }

            var options = {
                coalesce: this.shouldCoalesce()
            };

            this.getFlux().actions.transform
                .setRadiusThrottled(this.props.document, this.state.layers, value, options);
        },

        render: function () {
            return (
                <div className="formline radius_input">
                    <Label
                        className="label__medium__left-aligned"
                        size="column-4"
                        onScrubStart={this._handleScrubStart}
                        onScrub={this._handleRadiusScrub}
                        onScrubEnd={this._handleScrubEnd}
                        title={nls.localize("strings.TOOLTIPS.SET_RADIUS")}>
                        {nls.localize("strings.TRANSFORM.RADIUS")}
                    </Label>
                    <div className="control-group__vertical">
                        <NumberInput
                            size="column-4"
                            disabled={this.state.disabled}
                            min={0}
                            max={this.state.maxRadiusInput}
                            value={this.state.disabled ? "" : this.state.scalars}
                            onChange={this._handleRadiusChange} />
                    </div>
                    <Range
                        disabled={this.state.disabled}
                        min={0}
                        max={this.state.maxRadius}
                        value={this.state.scalars}
                        size="column-14"
                        onMouseDown={this.startCoalescing}
                        onMouseUp={this.stopCoalescing}
                        onChange={this._handleRadiusChange} />
                </div>
            );
        }
    });

    module.exports = Radius;
});
