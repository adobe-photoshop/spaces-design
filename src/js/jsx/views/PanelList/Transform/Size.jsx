/** @jsx React.DOM */
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
        FluxChildMixin = Fluxxor.FluxChildMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        _ = require("lodash");
        
    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        TextField = require("jsx!js/jsx/shared/TextField"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings");

    var Size = React.createClass({
        mixins: [FluxChildMixin, StoreWatchMixin("bounds", "layer", "document", "application")],
        
        getInitialState: function () {
            return {};
        },
        
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                layers = flux.store("layer").getActiveSelectedLayers(),
                documentID = flux.store("application").getCurrentDocumentID(),
                documentBounds = flux.store("bounds").getDocumentBounds(documentID),
                boundsShown = _.pluck(layers, "bounds");

            if (boundsShown.length === 0 && documentBounds) {
                boundsShown = [documentBounds];
            }

            var widths = _.pluck(boundsShown, "width"),
                heights = _.pluck(boundsShown, "height"),
                width,
                height;

            if (widths.length > 0) {
                if (_.every(widths, function (w) { return w === widths[0]; })) {
                    width = widths[0].toString();
                } else { 
                    width = "mixed";
                }
            } else {
                width = "";
            }
            
            if (heights.length > 0) {
                if (_.every(heights, function (h) { return h === heights[0]; })) {
                    height = heights[0].toString(); 
                } else {
                    height = "mixed";
                }
            } else { 
                height = "";
            }
                            
            return {
                width: width,
                height: height
            };

        },

        /**
         * @private
         */
        _handleWidthChange: function (event) {
            var inWidth = event.target.value,
                newWidth = inWidth === "" ? this.state.width : inWidth;
                
            if (this.state.width === newWidth) {
                return;
            }

            var flux = this.getFlux(),
                layers = flux.store("layer").getActiveSelectedLayers(),
                layerIDs = _.pluck(layers, "id"),
                documentID = flux.store("application").getCurrentDocumentID();

            flux.actions.transform.setSize(documentID, layerIDs, {w: newWidth});
        },

        /**
         * @private
         */
        _handleHeightChange: function (event) {
            var inHeight = event.target.value,
                newHeight = inHeight === "" ? this.state.height : inHeight;
                
            if (this.state.height === newHeight) {
                return;
            }

            var flux = this.getFlux(),
                layers = flux.store("layer").getActiveSelectedLayers(),
                layerIDs = _.pluck(layers, "id"),
                documentID = flux.store("application").getCurrentDocumentID();

            flux.actions.transform.setSize(documentID, layerIDs, {h: newHeight});
        },

        render: function () {
            return (
                <li className="formline">
                    <Label
                        title={strings.TRANSFORM.W}
                        size="c-2-25"
                    />
                    <Gutter />
                    <NumberInput
                        value={this.state.width}
                        onValueAccept={this._handleWidthChange}
                        onBlur={this._handleWidthChange}
                        ref="width"
                        valueType="simple"
                    />
                    <Gutter />
                    <ToggleButton
                        size="c-2-25"
                        buttonType="toggle-lock"
                    />
                    <Gutter />
                    <Label
                        title={strings.TRANSFORM.H}
                        size="c-2-25"
                    />
                    <Gutter />
                    <NumberInput
                        value={this.state.height}
                        onValueAccept={this._handleHeightChange}
                        onBlur={this._handleHeightChange}
                        ref="height"
                        valueType="simple"
                    />
                </li>
            );
        }
    });

    module.exports = Size;
});
