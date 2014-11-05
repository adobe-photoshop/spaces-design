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
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        synchronization = require("js/util/synchronization");

    var MAX_LAYER_POS = 32768,
        MIN_LAYER_POS = -32768;

    var Position = React.createClass({
        mixins: [FluxChildMixin, StoreWatchMixin("bounds", "layer", "document", "application")],

        /**
         * A debounced version of actions.transform.setPosition
         * 
         * @type {?function}
         */
        _setPositionDebounced: null,

        componentWillMount: function() {
            var flux = this.getFlux(),
                setPosition = flux.actions.transform.setPosition;

            this._setPositionDebounced = synchronization.debounce(setPosition);
        },

        getInitialState: function () {
            return {};
        },
        
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                currentDocument = flux.store("application").getCurrentDocument(),
                layers = currentDocument ? currentDocument.getSelectedLayers() : [],
                documentBounds = currentDocument ? currentDocument.bounds : null,
                boundsShown = _.pluck(layers, "bounds"),
                isDocument = false;

            if (boundsShown.length === 0 && documentBounds) {
                isDocument = true;
                boundsShown = [documentBounds];
            }
                
            var tops = _.pluck(boundsShown, "top"),
                lefts = _.pluck(boundsShown, "left");

            return {
                tops: tops,
                lefts: lefts,
                currentDocument: currentDocument,
                isDocument: isDocument
            };
        },

        /**
         * Update the left position of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newX
         */
        _handleLeftChange: function (event, newX) { 
            var currentDocument = this.state.currentDocument;
            if (!currentDocument) {
                return;
            }
            
            var layers = currentDocument.getSelectedLayers();                
            
            this._setPositionDebounced(currentDocument, layers, {x: newX});
        },

        /**
         * Update the top position of the selected layers.
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} newY
         */
        _handleTopChange: function (event, newY) { 
            var currentDocument = this.state.currentDocument;
            if (!currentDocument) {
                return;
            }
            
            var layers = currentDocument.getSelectedLayers();                

            this._setPositionDebounced(currentDocument, layers, {y: newY});
        },

        render: function () {
            return !this.state.isDocument && (
                <li className="formline">
                    <Label
                        title={strings.TRANSFORM.X}
                        size="c-2-25"
                    />
                    <Gutter />
                    <NumberInput
                        value={this.state.lefts}
                        valueType="simple"
                        onChange={this._handleLeftChange}
                        ref="left"
                        min={MIN_LAYER_POS}
                        max={MAX_LAYER_POS}
                    />
                    <Gutter />
                    <ToggleButton
                        size="c-2-25"
                        buttonType="toggle-delta"
                    />
                    <Gutter />
                    <Label
                        title={strings.TRANSFORM.Y}
                        size="c-2-25"
                    />
                    <Gutter />
                    <NumberInput
                        value={this.state.tops}
                        valueType="simple"
                        onChange={this._handleTopChange}
                        ref="top"
                        min={MIN_LAYER_POS}
                        max={MAX_LAYER_POS}
                    />
                </li>
            );
        }
    });

    module.exports = Position;
});
