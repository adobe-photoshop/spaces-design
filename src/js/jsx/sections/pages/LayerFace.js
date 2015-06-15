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
        classnames = require("classnames"),
        Immutable = require("immutable"),
        _ = require("lodash");

    var Draggable = require("../../../jsx/shared/Draggable"),
        Droppable = require("../../../jsx/shared/Droppable"),
        Button = require("../../../jsx/shared/Button"),
        SVGIcon = require("../../../jsx/shared/SVGIcon"),
        ToggleButton = require("../../../jsx/shared/ToggleButton"),
        TextInput = require("../../../jsx/shared/TextInput"),
        system = require("../../../util/system"),
        strings = require("i18n!nls/strings");

    var LayerFace = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            return !Immutable.is(this.props.layer.face, nextProps.layer.face) ||
                this.props.dragTarget !== nextProps.dragTarget ||
                this.props.dropAbove !== nextProps.dropAbove ||
                this.props.dragPosition !== nextProps.dragPosition ||
                this.props.dragStyle !== nextProps.dragStyle ||
                this.props.dropTarget !== nextProps.dropTarget;
        },

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
            event.stopPropagation();

            // Don't select if this is the click that follows a drag operation
            if (event.currentTarget.classList.contains("face__drag_target")) {
                return;
            }

            var modifier = "select";
            if (event.shiftKey) {
                modifier = "addUpTo";
            } else if (system.isMac ? event.metaKey : event.ctrlKey) {
                var selected = this.props.layer.selected;

                if (selected) {
                    modifier = "deselect";
                } else {
                    modifier = "add";
                }
            }

            this.getFlux().actions.layers.select(this.props.document, this.props.layer, modifier);
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
         * Goes into edit mode for the layer, if it's visible and unlocked
         * Reason for that is, we send a click event to the center of the layer
         * to go into edit mode, and:
         *  - For invisible layers that causes the tool we're switching to create a new layer
         *  - For locked layers, Photoshop does not like we're trying to edit them
         *  
         * @param {SyntheticEvent} event
         */
        _handleLayerEdit: function (event) {
            var layer = this.props.layer;
            if (layer.locked || !layer.visible) {
                return;
            }

            this.getFlux().actions.superselect.editLayer(this.props.document, this.props.layer);
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

        /**
         * When not editing a layer name, prevent the layer names from scrolling
         * horizontally while scrolling the layers panel by preventing the default
         * wheel action if there is a non-zero deltaX and instead firing a new
         * wheel action with deltaX set to 0.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleWheel: function (event) {
            var layerName = this.refs.layerName;
            if (!layerName.isEditing() && event.target === React.findDOMNode(layerName)) {
                if (event.deltaX) {
                    var nativeEvent = event.nativeEvent,
                        domEvent = new window.WheelEvent(event.type, {
                            deltaX: 0.0,
                            deltaY: nativeEvent.deltaY
                        });

                    event.preventDefault();
                    event.target.dispatchEvent(domEvent);
                }
            }
        },

        render: function () {
            var doc = this.props.document,
                layer = this.props.layer,
                layerStructure = doc.layers,
                layerIndex = layerStructure.indexOf(layer),
                nameEditable = !layer.isBackground,
                isSelected = layer.selected,
                isDragTarget = this.props.dragTarget,
                isDropTarget = this.props.dropTarget,
                isDropTargetAbove = true,
                isDropTargetBelow = false;

            if (isDropTarget && !this.props.dropAbove) {
                isDropTargetAbove = false;
                isDropTargetBelow = true;
            }

            // Set all the classes need to style this LayerFace
            var faceClasses = {
                "face": true,
                "face__select_immediate": isSelected,
                "face__drag_target": isDragTarget,
                "face__drop_target": isDropTarget,
                "face__drop_target_above": isDropTarget && isDropTargetAbove,
                "face__drop_target_below": isDropTarget && isDropTargetBelow,
                "face__group_start": layer.kind === layer.layerKinds.GROUP
            };

            faceClasses[this.props.dragClass] = true;

            var depthSpacing = _().range(layerStructure.depth(layer))
                .map(function (index) {
                    var classes = "face__leash column-half",
                        myClass = classes + " depth-" + index;

                    return (
                        <div className={myClass} key={index} />
                    );
                })
                .value();

            var dragStyle;
            if (isDragTarget) {
                dragStyle = this.props.dragStyle;
            } else {
                dragStyle = {};
            }

            // Super Hack: If two tooltip regions are flush and have the same title,
            // the plugin does not invalidate the tooltip when moving the mouse from
            // one region to the other. This is used to make the titles to be different,
            // and hence to force the tooltip to be invalidated.
            var tooltipPadding = _.repeat("\u200b", layerIndex);

            // Used to determine the layer face icon below
            var iconID = "layer-";
            if (layer.isArtboard) {
                iconID += "artboard";
            } else if (layer.kind === layer.layerKinds.BACKGROUND) {
                iconID += layer.layerKinds.PIXEL;
            } else if (layer.kind === layer.layerKinds.SMARTOBJECT && layer.isLinked) {
                iconID += layer.kind + "-linked";
            } else {
                iconID += layer.kind;
            }

            var showHideButton = layer.isBackground ? null : (
                <ToggleButton
                    disabled={this.props.disabled}
                    title={strings.TOOLTIPS.SET_LAYER_VISIBILITY + tooltipPadding}
                    className="face__button_visibility"
                    size="column-2"
                    buttonType="layer-visibility"
                    selected={!layer.visible}
                    onClick={this._handleVisibilityToggle}>
                </ToggleButton>
            );

            return (
                <div
                    style={dragStyle}
                    className={classnames(faceClasses)}
                    data-layer-id={layer.id}
                    onMouseDown={!this.props.disabled && this.props.handleDragStart}
                    onClick={!this.props.disabled && this._handleLayerClick}>
                    {depthSpacing}
                    <Button
                        title={strings.LAYER_KIND[layer.kind] + tooltipPadding}
                        disabled={this.props.disabled}
                        className="face__kind"
                        data-kind={layer.isArtboard ? "artboard" : layer.kind}
                        onDoubleClick={this._handleLayerEdit}>
                        <SVGIcon
                            CSSID={iconID}
                            viewbox="0 0 24 24"/>
                    </Button>
                    <span className="face__separator">
                        <TextInput
                            title={layer.name + tooltipPadding}
                            className="face__name"
                            ref="layerName"
                            type="text"
                            value={layer.name}
                            editable={!this.props.disabled && nameEditable}
                            onKeyDown={this._skipToNextLayerName}
                            onWheel={this._handleWheel}
                            onChange={this._handleLayerNameChange}>
                        </TextInput>
                        {showHideButton}
                    </span>
                    <ToggleButton
                        disabled={this.props.disabled}
                        title={strings.TOOLTIPS.LOCK_LAYER + tooltipPadding}
                        className="face__button_locked"
                        size="column-2"
                        buttonType="toggle-lock"
                        selected={layer.locked}
                        onClick={this._handleLockToggle}>
                    </ToggleButton>
                </div>
            );
        }
    });

    var draggedVersion = Draggable.createWithComponent(LayerFace, function (props) { return props.layer;}, "y"),
        droppableSettings = function (props) {
            return {
                key: props.layer.key,
                keyObject: props.layer,
                validateDrop: _.curry(props.validateDrop)(props.layer),
                handleDrop: props.onDragStop
            };
        };

    module.exports = Droppable.createWithComponent(draggedVersion, droppableSettings);
});
