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
        _ = require("lodash");
        
    var SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        strings = require("i18n!nls/strings");

    var RotateFlip = React.createClass({
        
        mixins: [FluxChildMixin],
        
        /**
         * Set the initial state with a flipDisabled flag based on the active layers
         */
        getInitialState : function() {
            var layers = this.props.data.layers;
            return {
                flipDisabled: _.isEmpty(layers) || _.some(layers, "isBackground") || _.some(layers, "locked")
            };
        },

        /**
         * Flips the layer horizontally or vertically based on button value
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _flip: function (event) {
            var buttonId = event.target.id,
                flux = this.getFlux(),
                data = this.props.data;
            
            // use the button's ID to determine the flip axis
            if (buttonId === "ico-flip-horizontal") {
                flux.actions.transform.flipX(data.activeDocument, data.activeLayers);
            } else {
                flux.actions.transform.flipY(data.activeDocument, data.activeLayers);
            }
        },
        
        render: function () {
            return (
                <SplitButton
                    items="ico-flip-horizontal,ico-flip-vertical"
                    buttonDisabled={this.state.flipDisabled}
                    onClick={this._flip}
                />
            );
        }
    });

    module.exports = RotateFlip;
});
