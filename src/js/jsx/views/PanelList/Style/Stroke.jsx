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
        StoreWatchMixin  = Fluxxor.StoreWatchMixin;

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings");
        _ = require("lodash");

    /**
     * Given a set of selectedLayers, build the merged state of Strokes
     *
     * @private
     * @param  {Array.<Layer>} activeLayers
     * @return {Array.<Stroke>}
     */
    var _buildStrokeState = function (activeLayers) {
        // FIXME for now we're just blindly grabbing the strokes of the first active layer
        // but eventually the "mixed" logic should be here
        if (_.isArray(activeLayers) && _.size(activeLayers) > 0 ){
            return activeLayers[0].strokes;
        } else {
            return [];
        }
    };

    var Stroke = React.createClass({

        mixins: [FluxMixin, StoreWatchMixin ("stroke", "layer", "document", "application")],

        /**
         * Get the active document and active/selected layers from flux, and put in state
         */
        getStateFromFlux: function () {
            var activeDocument = this.getFlux().store("application").getCurrentDocument(),
                activeLayers = activeDocument ? activeDocument.getSelectedLayers() : [];
            return {
                activeDocument: activeDocument,
                activeLayers: activeLayers, //Maybe don't explicitly need this
                strokes: _buildStrokeState(activeLayers)
            };
        },

        /**
         * Handle the button click event, call the toggleStrokeEnabled button
         * @param  {[type]}  event
         * @param  {Boolean} isChecked
         */
        _toggleStrokeEnabled: function (event, isChecked){
            event.preventDefault();

            // Assume first stroke for now, we don't yet support multiple shape strokes
            var stroke = _.isArray(this.state.strokes) && !_.isEmpty(this.state.strokes) && this.state.strokes[0];

            if (_.isArray(this.state.activeLayers) && !_.isEmpty(this.state.activeLayers)) {
                this.getFlux().actions.layers.toggleStrokeEnabled(
                    this.state.activeDocument,
                    this.state.activeLayers,
                    stroke,  
                    isChecked
                );
            }
        },

        _handleStrokeSizeChange: function (event, value) {

        },

        render: function () {
            if (!_.isArray(this.state.strokes) || _.isEmpty(this.state.strokes)) {
                return null;
            }
            // FIXME: only display first stroke for now.  future: forEach
            var stroke = this.state.strokes[0];

            return (
                <li className="formline" >
                    <header className="sub-header">
                        <h3>
                        {strings.STYLE.STROKE.TITLE}
                        </h3>
                    </header>

                    <ul>
                        <li className="formline">
                            <ToggleButton
                                name="toggleStrokeEnabled"
                                selected={stroke.enabled}
                                onClick={this._toggleStrokeEnabled}
                            />
                            <Label
                                title="Color here"
                            />
                            <Gutter />
                            <Label
                                title={strings.STYLE.STROKE.SIZE}
                                size="c-3-25"
                            />
                            <Gutter />
                            <TextInput
                                valueType="size"
                                onChange={this._handleStrokeSizeChange}
                            />
                            <Gutter />
                            <Gutter />
                            <ToggleButton
                                buttonType="toggle-trash"
                            />
                        </li>
                    </ul>
                </li>
            );
        }
    });

    module.exports = Stroke;
});
