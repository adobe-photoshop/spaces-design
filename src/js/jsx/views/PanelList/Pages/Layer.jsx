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

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        TextField = require("jsx!js/jsx/shared/TextField");
    
    var Layer = React.createClass({
        mixins: [FluxChildMixin],
        handleLayerNameChange: function (event) {

        },
        
        /**
         * Grabs the correct modifier by processing event modifier keys
         * and calls the select action with correct modifier.
         * 
         * @private
         * @param {Object} event React event
         */
        _handleLayerClick: function (event) {
            var modifier = "select";
            if (event.shiftKey) {
                modifier = "addUpTo";
            } else if (event.metaKey) {
                var selected = this.props.layerData.selected;

                if (selected) {
                    modifier = "deselect";
                } else {
                    modifier = "add";
                }
            }
            this.getFlux().actions.layers.select(this.props.documentID, this.props.layerData.id, modifier);
        },

        /**
         * Changes the visibility of the layer
         * 
         * @private
         * @param {boolean} toggled Flag for the ToggleButton, false means visible
         */
        _handleVisibilityToggle: function (toggled) {
            // Invisible if toggled, visible if not
            this.getFlux().actions.layers.setVisibility(this.props.documentID, this.props.layerData.id, !toggled);
        },

        /**
         * Changes the locking of the layer
         * 
         * @private
         * @param {boolean} toggled Flag for the ToggleButton, true means locked
         */
        _handleLockToggle: function (toggled) {
            // Locked if toggled, visible if not
            this.getFlux().actions.layers.setLocking(this.props.documentID, this.props.layerData.id, toggled);
        },
        
        render: function () {
            var layerObject = this.props.layerData;

            if (layerObject.kind === layerObject.layerKinds.GROUPEND) {
                return (
                    <li className="HiddenPage" />
                );
            }

            var childLayers = this.props.layerData.children.map(function (layer, itemIndex) {
                return (
                    <Layer layerData={layer} key={itemIndex} />
                );
            });

            var depthSpacing = _.range(layerObject.depth).map(function () {
                return (
                    <div data-leash className="c-half-25" />
                );
            });

            return (
                <li className="Page"
                    key={this.props.key}
                    data-selected={layerObject.selected}
                    >
                    <div
                        onClick={this._handleLayerClick}
                    >
                        <Gutter/>
                        <ToggleButton
                            size="c-2-25"
                            buttonType="layer-visibility"
                            selected={!layerObject.visible}
                            onClick={this._handleVisibilityToggle}
                        ></ToggleButton>
                        <Gutter/>
                        {depthSpacing}
                        <TextField
                            className="layer_name"
                            ref="layer_name"
                            type="text"
                            value={layerObject.name}
                            onChange={this.handleLayerNameChange}
                        ></TextField>
                        <ToggleButton
                            size="c-2-25"
                            buttonType="layer-lock"
                            selected={layerObject.locked}
                            onClick={this._handleLockToggle}
                        ></ToggleButton>
                    </div>
                    <ul>
                        {childLayers}
                    </ul>
                </li>
            );
        }
    });
    module.exports = Layer;
});
