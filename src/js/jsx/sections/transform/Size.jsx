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
        
    var Gutter = require("js/jsx/shared/Gutter"),
        Label = require("js/jsx/shared/Label"),
        NumberInput = require("js/jsx/shared/NumberInput"),
        ToggleButton = require("js/jsx/shared/ToggleButton"),
        CoalesceMixin = require("js/jsx/mixin/Coalesce"),
        math = require("js/util/math"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection");

    var MAX_LAYER_SIZE = 32000,
        MIN_LAYER_SIZE = 0.1;

    var Size = React.createClass({
        mixins: [FluxMixin, CoalesceMixin],

        shouldComponentUpdate: function (nextProps, nextState) {
            // Calculations that are usually done here are done in
            // componentWillReceiveProps
            return this.props.active !== nextProps.active ||
                this.props.referencePoint !== nextProps.referencePoint ||
                this.state.disabled !== nextState.disabled ||
                this.state.proportional !== nextState.proportional ||
                !Immutable.is(this.state.layers, nextState.layers) ||
                !Immutable.is(this.state.widths, nextState.widths) ||
                !Immutable.is(this.state.heights, nextState.heights);
        },

        /**
         * Calculates the new state only if it will change
         * The top part of this function used to be in shouldComponentUpdate
         * To make state available outside render(), we moved the calculation into this function
         * But we don't want to re-calculate it if the component is not going to update
         * If it will, we calculate and set the new state
         *
         * @param {object} nextProps
         */
        componentWillReceiveProps: function (nextProps) {
            var document = nextProps.document,
                documentBounds = document.bounds,
                layers = document.layers.selected,
                boundsShown = document.layers.selectedChildBounds,
                hasArtboard = document.layers.hasArtboard,
                disabled = this._disabled(document, layers, boundsShown),
                proportionalFlags = layers.map(function (layer) {
                    return layer.proportionalScaling;
                }),
                proportional = collection.uniformValue(proportionalFlags);
                
            if (layers.isEmpty()) {
                boundsShown = documentBounds && !hasArtboard ?
                    Immutable.List.of(documentBounds) :
                    boundsShown;
            }

            var widths = collection.pluck(boundsShown, "width"),
                heights = collection.pluck(boundsShown, "height");
            
            this.setState({
                disabled: disabled,
                layers: layers,
                widths: widths,
                heights: heights,
                proportional: proportional
            });
        },

        componentWillMount: function () {
            // Needed to correctly initialize this.state.
            this.componentWillReceiveProps(this.props);
        },

        /**
         * Blur the Width input when shift-tabbing past it.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleWidthKeyDown: function (event) {
            var key = event.key,
                shiftKey = event.shiftKey;

            if (key === "Tab" && shiftKey) {
                event.preventDefault();
                event.target.blur();
            }
        },

        /**
         * Saves the current width of selected layers on scrub start
         *
         * @private
         */
        _handleWScrubBegin: function () {
            var currentWidth = collection.uniformValue(this.state.widths);
            
            this.setState({
                scrubWidth: currentWidth
            });

            if (currentWidth !== null) {
                this.startCoalescing();
            }
        },

        /**
         * Update the current width of the selected layers based on change from initial scrub position
         *
         * @private
         * @param {number} deltaX
         */
        _handleWScrub: function (deltaX) {
            if (this.state.scrubWidth === null) {
                return;
            }

            var document = this.props.document,
                newWidth = math.clamp(this.state.scrubWidth + deltaX, MIN_LAYER_SIZE, MAX_LAYER_SIZE),
                currentWidth = collection.uniformValue(this.state.widths);
            
            if (newWidth !== currentWidth) {
                this.getFlux().actions.transform.setSizeThrottled(
                    document,
                    document.layers.selected,
                    { w: newWidth },
                    this.props.referencePoint,
                    { coalesce: this.shouldCoalesce() }
                );
            }
        },

        _handleWScrubEnd: function () {
            this.setState({
                scrubWidth: null
            });

            this.stopCoalescing();
        },

        /**
         * Saves the current height of selected layers on scrub start
         *
         * @private
         */
        _handleHScrubBegin: function () {
            var currentHeight = collection.uniformValue(this.state.heights);
            
            this.setState({
                scrubHeight: currentHeight
            });

            if (currentHeight !== null) {
                this.startCoalescing();
            }
        },

        /**
         * Update the current height of the selected layers based on change from initial scrub position
         *
         * @private
         * @param {number} deltaX
         */
        _handleHScrub: function (deltaX) {
            // If it's a mixed value, we shouldn't scrub
            if (this.state.scrubHeight === null) {
                return;
            }

            var document = this.props.document,
                newHeight = math.clamp(this.state.scrubHeight + deltaX, MIN_LAYER_SIZE, MAX_LAYER_SIZE),
                currentHeight = collection.uniformValue(this.state.heights);

            if (newHeight !== currentHeight) {
                this.getFlux().actions.transform.setSizeThrottled(
                    document,
                    document.layers.selected,
                    { h: newHeight },
                    this.props.referencePoint,
                    { coalesce: true }
                );
            }
        },

        _handleHScrubEnd: function () {
            this.setState({
                scrubHeight: null
            });

            this.stopCoalescing();
        },

        /**
         * Update the width of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newWidth
         */
        _handleWidthChange: function (event, newWidth) {
            var document = this.props.document,
                flux = this.getFlux(),
                referencePoint = flux.store("panel").getState().referencePoint;

            flux.actions.transform.setSizeThrottled(
                document,
                document.layers.selected,
                { w: newWidth },
                referencePoint
            );
        },

        /**
         * Update the height of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newHeight
         */
        _handleHeightChange: function (event, newHeight) {
            var document = this.props.document,
                flux = this.getFlux(),
                referencePoint = flux.store("panel").getState().referencePoint;
            
            this.getFlux().actions.transform
                .setSizeThrottled(document, document.layers.selected, { h: newHeight }, referencePoint);
        },

        /**
         * Update the proportional transformation lock 
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {bool} proportional
         */
        _handleProportionChange: function (event, proportional) {
            var document = this.props.document;
            
            this.getFlux().actions.layers
                .setProportional(document, document.layers.selected, proportional);
        },

        /**
         * Indicates whether the size input should be disabled
         * TRUE if layers is non-empty while the boundsShown is empty
         * or if layers are empty and the document has Artboards
         * or if either a background, adjustment or text layer is included
         * or if there is zero-bound layer included
         * or if an empty group is included
         * or if the selection is a mixture of artboards and other layers
         * 
         * @private
         * @param {Document} document
         * @param {Immutable.List.<Layers>} layers
         * @param {Immutable.List.<Bounds>} boundsShown
         * @return {boolean}
         */
        _disabled: function (document, layers, boundsShown) {
            var layerTree = document.layers,
                artboardLayers = layers.filter(function (layer) {
                    return layer.isArtboard;
                });

            return document.unsupported ||
                (layers.isEmpty() && document.layers.hasArtboard) ||
                (!layers.isEmpty() && boundsShown.isEmpty()) ||
                layers.some(function (layer) {
                    var childBounds = layerTree.childBounds(layer);
                    
                    return layer.isBackground ||
                        layer.isAdjustment ||
                        (!childBounds || childBounds.empty) ||
                        (!layer.isArtboard && document.layers.isEmptyGroup(layer));
                }) ||
                (artboardLayers.size !== layers.size && artboardLayers.size !== 0);
        },

        render: function () {
            var proportionalToggle = null;

            if (this.state.layers.isEmpty() || this.state.disabled) {
                proportionalToggle = (
                    <Gutter
                        size="column-4" />
                );
            } else {
                proportionalToggle = (
                    <ToggleButton
                        size="column-4"
                        buttonType="toggle-disconnected"
                        title={nls.localize("strings.TOOLTIPS.LOCK_PROPORTIONAL_TRANSFORM")}
                        selected={this.state.proportional}
                        selectedButtonType = "toggle-connected"
                        onClick={this._handleProportionChange} />
                );
            }

            return (
                <div className="control-group__horizontal">
                    <Label
                        title={nls.localize("strings.TOOLTIPS.SET_WIDTH")}
                        className="label__medium__left-aligned"
                        onScrub={this._handleWScrub}
                        onScrubStart={this._handleWScrubBegin}
                        onScrubEnd={this._handleWScrubEnd}
                        size="column-1">
                        {nls.localize("strings.TRANSFORM.W")}
                    </Label>
                    <NumberInput
                        disabled={this.state.disabled}
                        value={this.state.widths}
                        onChange={this._handleWidthChange}
                        onKeyDown={this._handleWidthKeyDown}
                        ref="width"
                        min={MIN_LAYER_SIZE}
                        max={MAX_LAYER_SIZE}
                        size="column-5" />
                    {proportionalToggle}
                    <Label
                        size="column-1"
                        className="label__medium__left-aligned"
                        onScrub={this._handleHScrub}
                        onScrubStart={this._handleHScrubBegin}
                        onScrubEnd={this._handleHScrubEnd}
                        title={nls.localize("strings.TOOLTIPS.SET_HEIGHT")}>
                        {nls.localize("strings.TRANSFORM.H")}
                    </Label>
                    <div className="column-6">
                    <NumberInput
                        value={this.state.heights}
                        disabled={this.state.disabled}
                        onChange={this._handleHeightChange}
                        ref="height"
                        min={MIN_LAYER_SIZE}
                        max={MAX_LAYER_SIZE}
                        size="column-5" />
                    </div>
                </div>
            );
        }
    });

    module.exports = Size;
});
