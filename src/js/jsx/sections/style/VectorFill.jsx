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

    var contentLayerLib = require("adapter").lib.contentLayer;

    var LayerBlendMode = require("./LayerBlendMode"),
        Opacity = require("./Opacity"),
        Fill = require("./Fill"),
        FillColor = Fill.FillColor,
        FillVisiblity = Fill.FillVisibility,
        Label = require("js/jsx/shared/Label"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection"),
        classnames = require("classnames");

    /**
     * VectorFill Component displays information of fills for non-type only sets of layers
     */
    var VectorFill = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            return this.props.disabled !== nextProps.disabled ||
                !Immutable.is(this.props.document, nextProps.document);
        },

        /**
         * Setup state for the fill and layers for child components
         *
         * @private
         * @param {Object} props
         */
        _setFillState: function (props) {
            var document = props.document,
                // We only care about vector layers.  If at least one exists, then this component should render
                layers = document.layers.selected.filter(function (layer) {
                    return layer.isVector;
                }),
                fills = collection.pluck(layers, "fill"),
                downsample = this._downsampleFills(fills);

            this.setState({
                layers: layers,
                fill: downsample
            });
        },

        componentWillMount: function () {
            this._setFillState(this.props);
        },

        componentWillReceiveProps: function (nextProps) {
            this._setFillState(nextProps);
        },

        /**
        * Produce a set of arrays of separate fill display properties, transformed and ready for the sub-components
        *
        * @private
        * @param {Immutable.List.<Fill>} fills
        * @return {object}
        */
        _downsampleFills: function (fills) {
            var colors = fills.map(function (fill) {
                if (!fill) {
                    return null;
                }

                if (fill.type === contentLayerLib.contentTypes.SOLID_COLOR) {
                    return fill.color;
                } else {
                    return fill.type;
                }
            }),
            opacityPercentages = collection.pluck(fills, "color")
                .map(function (color) {
                    return color && color.opacity;
                }),
            enabledFlags = collection.pluck(fills, "enabled", false);

            return {
                colors: colors,
                opacityPercentages: opacityPercentages,
                enabledFlags: enabledFlags
            };
        },

        render: function () {
            if (this.props.uniformLayerKind && this.props.hasSomeTextLayers) {
                return null;
            }

            var opacityLabelClasses = classnames({
                "label__medium__left-aligned": true,
                "opacity-label": true
            });

            var fillVisibilityToggle = !this.props.uniformLayerKind ? null : (
                <FillVisiblity
                    document={this.props.document}
                    layers={this.state.layers}
                    fill={this.state.fill} />);
            
            return (
                <div className="formline">
                    <div className="control-group__vertical vector-fill">
                        <FillColor
                            disabled={!this.props.uniformLayerKind}
                            forceDisabledDisplay={this.props.hasSomeTypeLayers}
                            document={this.props.document}
                            layers={this.state.layers}
                            fill={this.state.fill} />
                    </div>
                    <div className="control-group__vertical control-group__no-label">
                        <LayerBlendMode
                            id={this.props.id}
                            document={this.props.document}
                            disabled={this.props.disabled}
                            onFocus={this.props.onFocus}
                            containerType={"appearance"}
                            layers={this.props.document.layers.selected} />
                    </div>
                    <div className="control-group__vertical">
                        <Label
                            size="column-4"
                            className={opacityLabelClasses}
                            title={nls.localize("strings.TOOLTIPS.SET_OPACITY")}>
                            {nls.localize("strings.STYLE.OPACITY")}
                        </Label>
                        <Opacity
                            document={this.props.document}
                            disabled={this.props.disabled}
                            onFocus={this.props.onFocus}
                            layers={this.props.document.layers.selected} />
                    </div>
                    <div className="control-group__vertical control-group__no-label">
                        {fillVisibilityToggle}
                    </div>
                </div>
            );
        }
    });

    module.exports = VectorFill;
});
