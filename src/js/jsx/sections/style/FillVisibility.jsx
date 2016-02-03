/*
 * Copyright (c) 2016 Adobe Systems Incorporated. All rights reserved.
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
        Immutable = require("immutable"),
        _ = require("lodash");

    var ToggleButton = require("js/jsx/shared/ToggleButton"),
        nls = require("js/util/nls");
    
    /**
     * FillVisibility Component displays visibility information of a single fill for a given layer or 
     * set of layers.
     */
    var FillVisibility = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            return !Immutable.is(this.props.fill, nextProps.fill) ||
                this.props.disabled !== nextProps.disabled;
        },

        /**
         * Handle the button click event, call the toggleFillEnabled button
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {boolean} isChecked
         */
        _toggleFillEnabled: function (event, isChecked) {
            this.getFlux().actions.shapes.setFillEnabled(
                this.props.document,
                this.props.vectorLayers,
                { enabled: isChecked }
            );
        },

        render: function () {
            // If there are no vector layers, hide the component
            if (this.props.vectorLayers.size === 0) {
                return null;
            }

            return (
                <ToggleButton
                    title={nls.localize("strings.TOOLTIPS.TOGGLE_FILL")}
                    name="toggleFillEnabled"
                    buttonType="layer-not-visible"
                    // selected={this.props.fill.enabledFlags}
                    selectedButtonType={"layer-visible"}
                    onClick={!this.props.disabled ? this._toggleFillEnabled : _.noop}
                    size="column-2" />
            );
        }
    });

    module.exports = FillVisibility;
});
