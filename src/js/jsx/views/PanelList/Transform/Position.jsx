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
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings");

    var Position = React.createClass({
         mixins: [FluxChildMixin, StoreWatchMixin("bounds", "layer", "document", "application")],
        
        getInitialState: function () {
            return {};
        },
        
        getStateFromFlux: function () {
            var layers = this.getFlux().store("layer").getActiveSelectedLayers(),
                layerBounds = _.pluck(layers, "bounds"),
                tops = _.pluck(layerBounds, "top"),
                lefts = _.pluck(layerBounds, "left"),
                top = "",
                left = "";

            if (tops.length > 0) {
                top = _.every(tops, function (w) { 
                    return w === tops[0];
                }) ?
                    tops[0].toString() : 
                    "mixed";
            }
            
            if (lefts.length > 0) {
                left = _.every(lefts, function (h) { 
                    return h === lefts[0];
                }) ?
                    lefts[0].toString() :
                    "mixed";
            }
                            
            return {
                top: top,
                left: left
            };

        },

        render: function () {
            return (
                <li className="formline">
                    <Label
                        title="X"
                        size="c-2-25"
                    />
                    <Gutter />
                    <TextField
                        value={this.state.left}
                        valueType="simple"
                    />
                    <Gutter />
                    <ToggleButton
                        size="c-2-25"
                        buttonType="toggle-delta"
                    />
                    <Gutter />
                    <Label
                        title="Y"
                        size="c-2-25"
                    />
                    <Gutter />
                    <TextField
                        value={this.state.top}
                        valueType="simple"
                    />
                </li>
            );
        },
        
        handleClick: function (event) {
            // console.log(event.target.id);
        }
    });

    module.exports = Position;
});
