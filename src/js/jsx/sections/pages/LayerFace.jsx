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
        ClassSet = React.addons.classSet,
        Immutable = require("immutable");

    var Draggable = require("js/jsx/mixin/Draggable"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        Button = require("jsx!js/jsx/shared/Button"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        strings = require("i18n!nls/strings");
    
    var LayerFace = React.createClass({
        mixins: [FluxMixin, Draggable],

        /**
         * Renames the layer
         * 
         * @private
         * @param {SyntheticEvent} event
         * @param {string} newName 
         */
        _handleLayerNameChange: function (event, newName) {
            this.getFlux().actions.layers.rename(this.props.document, this.props.layer, newName);
        },

        /**
         * Not implemented yet, but will call the handler being passed from PagesPanel
         * to skip to the next layer and make it editable
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _skipToNextLayerName: function (event) {
            // TODO: Skip to next layer on the tree
            event.stopPropagation();
        },
        
        /**
         * Grabs the correct modifier by processing event modifier keys
         * and calls the select action with correct modifier.
         * 
         * @private
         * @param {SyntheticEvent} event React event
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
            event.stopPropagation();
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
            this.getFlux().actions.layers.setVisibility(this.props.document, this.props.layer, !toggled);
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
            this.getFlux().actions.layers.setLocking(this.props.document, this.props.layer, toggled);
            event.stopPropagation();
        },

        render: function () {
            var doc = this.props.document,
                layer = this.props.layer;

            var depthSpacing = Immutable.Range(0, this.props.depth)
                .map(function (index) {
                    var classes = "face__leash column-half",
                        myClass = classes + " depth-" + index;

                    return (
                        <div className={myClass} key={index}/>
                    );
                })
                .toArray();

            var dragStyle;
            if (this.props.dragTarget === this.props.layer) {
                dragStyle = this.state.dragStyle;
            } else {
                dragStyle = {};
            }

            var layerIndex = doc.layers.indexOf(layer),
                nameEditable = !layer.locked && !layer.isBackground,
                ancestors = doc.layers.ancestors(layer),
                isInvisible = !layer.visible,
                isAncestorInvisible = isInvisible || ancestors.some(function (ancestor) {
                    return !ancestor.visible;
                }),
                isLocked = layer.locked,
                isAncestorLocked = isLocked || ancestors.some(function (ancestor) {
                    return ancestor.locked;
                }),
                isSelected = layer.selected,
                isAncestorSelected = !isSelected && ancestors.some(function (ancestor) {
                    return ancestor.selected;
                }),
                isParityEven = (layerIndex % 2) === 0,
                isParityOdd = !isParityEven,
                isDragTarget = this.props.dragTarget === layer,
                isDropTarget = this.props.dropTarget === layer,
                isDropTargetAbove = isDropTarget && this.props.dropAbove,
                isDropTargetBelow = isDropTarget && !this.props.dropAbove;

            // Set all the classes need to style this LayerFace
            var faceClasses = {
                "face": true,
                "face__select_immediate": isSelected,
                "face__select_ancestor": isAncestorSelected,
                "face__invisible": isAncestorInvisible,
                "face__locked": isAncestorLocked,
                "face__parity_even": isParityEven,
                "face__parity_odd": isParityOdd,
                "face__drag_target": isDragTarget,
                "face__drop_target": isDropTarget,
                "face__drop_target_above": isDropTargetAbove,
                "face__drop_target_below": isDropTargetBelow
            };

            faceClasses[this.state.dragClass] = true;

            return (
                <div
                    style={dragStyle}
                    className={ClassSet(faceClasses)}
                    data-layer-id={layer.id}
                    onClick={this._handleLayerClick}
                    onMouseDown={this._handleDragStart}>
                    <Gutter/>
                    {depthSpacing}
                    <Button
                        title={strings.LAYER_KIND[layer.kind]}
                        className="face__kind"
                        data-kind={layer.kind}/>
                    <Gutter/>
                    <span className="face__separator">
                        <TextInput
                            title={layer.name}
                            className="face__name"
                            ref="layer_name"
                            type="text"
                            value={layer.name}
                            editable={nameEditable}
                            onKeyDown={this._skipToNextLayerName}
                            onChange={this._handleLayerNameChange}>
                        </TextInput>
                        <ToggleButton
                            title={strings.TOOLTIPS.SET_LAYER_VISIBILITY}
                            className="face__button_visibility"
                            size="column-2"
                            buttonType="layer-visibility"
                            selected={!layer.visible}
                            onClick={this._handleVisibilityToggle}>
                        </ToggleButton>
                        <ToggleButton
                            title={strings.TOOLTIPS.LOCK_LAYER}
                            className="face__button_locked"
                            size="column-2"
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
