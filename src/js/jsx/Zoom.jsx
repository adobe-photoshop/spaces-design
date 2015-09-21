/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        FluxMixin = Fluxxor.FluxMixin(React);

    var NumberInput = require("jsx!js/jsx/shared/NumberInput");

    var Zoom = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("ui")],

        getStateFromFlux: function () {
            var uiState = this.getFlux().store("ui").getState();

            return {
                zoom: uiState.zoomFactor * 100
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return (this.state.zoom !== nextState.zoom);
        },

        /**
         * Handle the change of zoom input, the actions will take care
         * of making sure the zoom is at an acceptable range
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} zoom
         */
        _handleZoomChange: function (event, zoom) {
            var payload = {
                zoom: zoom / 100
            };

            this.getFlux().actions.ui.zoom(payload);
        },

        /**
         * If tab key is pressed, we don't want focus to go to some other bar/panel
         * so we blur this element and send focus back to PS
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleKeyDown: function (event) {
            if (event.key === "Tab") {
                React.findDOMNode(this.refs.input).blur();
                event.preventDefault();
            }
        },

        render: function () {
            return (
                <div className="zoom">
                    <NumberInput
                        tabIndex="-1"
                        ref="input"
                        suffix="%"
                        value={this.state.zoom}
                        onChange={this._handleZoomChange}
                        onKeyDown={this._handleKeyDown}
                    />
                </div>
            );
        }
    });

    module.exports = Zoom;
});
