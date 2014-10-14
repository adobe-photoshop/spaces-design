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
        ClassSet = React.addons.classSet,
        Draggable = require("js/jsx/mixin/Draggable"),
        _ = require("lodash");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        TextField = require("jsx!js/jsx/shared/TextField");
    
    var LayerFace = React.createClass({
        mixins: [FluxChildMixin, Draggable],

        _handleLayerNameChange: function () {},
        
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
                var selected = this.props.layer.selected;

                if (selected) {
                    modifier = "deselect";
                } else {
                    modifier = "add";
                }
            }
            this.getFlux().actions.layers.select(this.props.document.id, this.props.layer.id, modifier);
        },

        /**
         * Changes the visibility of the layer
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} toggled Flag for the ToggleButton, false means visible
         */
        _handleVisibilityToggle: function (event, toggled) {
            // Invisible if toggled, visible if not
            this.getFlux().actions.layers.setVisibility(this.props.document.id, this.props.layer.id, !toggled);
            event.stopPropagation();
        },

        /**
         * Changes the locking of the layer
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} toggled Flag for the ToggleButton, true means locked
         */
        _handleLockToggle: function (event, toggled) {
            // Locked if toggled, visible if not
            this.getFlux().actions.layers.setLocking(this.props.document.id, this.props.layer.id, toggled);
            event.stopPropagation();
        },

        render: function () {
            var doc = this.props.document,
                layer = this.props.layer;

            var depthSpacing = _.range(layer.depth).map(function (index) {
                return (
                    <div data-leash className="c-half-25" key={index}/>
                );
            });

            var style = {},
                dropStyle = "3px inset green";
                
            if (this.props.dropTarget === this.props.layer) {
                if (this.props.dropAbove) {
                    style["border-top"] = dropStyle;
                } else {
                    style["border-bottom"] = dropStyle;
                }
            }

            if (this.props.dragTarget === this.props.layer) {
                style = _.merge(style, this.state.dragStyle);
            }

            var ancestors = layer.getAncestors(),
                ancestorSelected = !layer.selected && ancestors.some(function (ancestor) {
                    return ancestor.selected;
                });

            // Set the draggable options here on this dynamic declaration
            var dragTargetAbove = layer === this.props.dropTarget && this.props.dropAbove,
                dragTargetBelow = layer === this.props.dropTarget && !this.props.dropAbove,
                faceClasses = {
                    "face": true,
                    "face__select_immediate": layer.selected,
                    "face__select_ancestor": ancestorSelected,
                    "face__invisible": !layer.visible,
                    "face__locked": layer.locked,
                    "Page": true,
                    "Page_dragTargetAbove": dragTargetAbove,
                    "Page_dragTargetBelow": dragTargetBelow
                },
                faceClassName;

            faceClasses[this.state.dragClass] = true;
            faceClassName = ClassSet(faceClasses);

            return (
                <div style={style}
                    className={faceClassName}
                    data-layer-id={layer.id}
                    onClick={this._handleLayerClick}
                    onMouseDown={this._handleDragStart}>
                    <Gutter/>
                    <ToggleButton className="face__button_visibility"
                        size="c-2-25"
                        buttonType="layer-visibility"
                        selected={!layer.visible}
                        onClick={this._handleVisibilityToggle}>
                    </ToggleButton>
                    <Gutter/>
                    {depthSpacing}
                    <span className="face__separator">
                        <TextField
                            className="face__name"
                            ref="layer_name"
                            type="text"
                            value={layer.name}
                            onChange={this._handleLayerNameChange}>
                        </TextField>
                        <ToggleButton className="face__button_locked"
                            size="c-2-25"
                            buttonType="layer-lock"
                            selected={layer.locked}
                            onClick={this._handleLockToggle}>
                        </ToggleButton>
                    </span>
                </div>
            );
        }
    });

    module.exports = LayerFace;
});
