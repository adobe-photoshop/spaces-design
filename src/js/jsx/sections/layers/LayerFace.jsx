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

    var UI = require("adapter/ps/ui");
    
    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        classnames = require("classnames"),
        Immutable = require("immutable"),
        _ = require("lodash");

    var Draggable = require("jsx!js/jsx/shared/Draggable"),
        Droppable = require("jsx!js/jsx/shared/Droppable"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        system = require("js/util/system"),
        svgUtil = require("js/util/svg"),
        strings = require("i18n!nls/strings"),
        log = require("js/util/log");

    /**
     * Function for checking whether React component should update
     * Passed to Droppable composed component in order to save on extraneous renders
     *
     * @param {object} nextProps - Next set of properties for this component
     * @return {boolean}
     */
    var shouldComponentUpdate = function (nextProps) {
        // Drag states
        if (this.props.dragTarget !== nextProps.dragTarget ||
            this.props.dropPosition !== nextProps.dropPosition ||
            this.props.dragPosition !== nextProps.dragPosition ||
            this.props.dragStyle !== nextProps.dragStyle ||
            this.props.dropTarget !== nextProps.dropTarget) {
            return true;
        }
        
        // Face change
        if (!Immutable.is(this.props.layer.face, nextProps.layer.face)) {
            return true;
        }

        var document = this.props.document,
            nextDocument = nextProps.document;

        // Depth changes
        var currentDepth = document.layers.depth(this.props.layer),
            nextDepth = nextDocument.layers.depth(nextProps.layer);

        if (currentDepth !== nextDepth) {
            return true;
        }

        // Deeper selection changes
        var childOfSelection = document.layers.hasSelectedAncestor(this.props.layer);
        if (childOfSelection || nextDocument.layers.hasSelectedAncestor(nextProps.layer)) {
            if (!Immutable.is(document.layers.allSelected, nextDocument.layers.allSelected)) {
                return true;
            }
        }

        // Given that the face hasn't changed and no selected ancestor has changed, this
        // component only needs to re-render when going from having a collapsed ancestor
        // (i.e., being hidden) to not having one (i.e., becoming newly visible).
        var hadCollapsedAncestor = document.layers.hasCollapsedAncestor(this.props.layer),
            willHaveCollapsedAncestor = nextDocument.layers.hasCollapsedAncestor(nextProps.layer);

        return hadCollapsedAncestor !== willHaveCollapsedAncestor;
    };

    var LayerFace = React.createClass({
        mixins: [FluxMixin],

        /**
         * Expand or collapse the selected groups.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleIconClick: function (event) {
            var layer = this.props.layer;
            if (layer.kind !== layer.layerKinds.GROUP) {
                return;
            }

            // Suppress click propagation to avoid selection change
            event.stopPropagation();

            // Presence of option/alt modifier determines whether all descendants are toggled
            var flux = this.getFlux(),
                modifierStore = flux.store("modifier"),
                modifierState = modifierStore.getState(),
                descendants = modifierState.alt;

            this.getFlux().actions.layers.setGroupExpansion(this.props.document, layer,
                !layer.expanded, descendants);
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

            this.getFlux().actions.layers.select(this.props.document, this.props.layer, modifier)
            .bind(this)
            .then(function () {
                var flux = this.getFlux(),
                    toolStore = flux.store("tool"),
                    currentTool = toolStore.getCurrentTool(),
                    layer = this.props.layer;
                if ((currentTool.id === "typeCreateOrEdit" || currentTool.id === "superselectType") &&
                    layer.kind === layer.layerKinds.TEXT) {
                    UI.startEditWithCurrentModalTool(function (err) {
                        log.error("startEditWithCurrentModalTool: " + err);
                    });
                }
            });
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
                layerIndex = doc.layers.indexOf(layer),
                nameEditable = !layer.isBackground,
                isSelected = layer.selected,
                isChildOfSelected = !layer.selected &&
                    layerStructure.parent(layer) &&
                    layerStructure.parent(layer).selected,
                isStrictDescendantOfSelected = !isChildOfSelected && layerStructure.hasStrictSelectedAncestor(layer),
                isDragTarget = this.props.dragTarget,
                isDropTarget = this.props.dropTarget,
                dropPosition = this.props.dropPosition,
                isGroupStart = layer.kind === layer.layerKinds.GROUP || layer.isArtboard;

            var depth = layerStructure.depth(layer),
                endOfGroupStructure = false,
                isLastInGroup = false,
                dragStyle;

            if (isDragTarget && this.props.dragStyle) {
                dragStyle = this.props.dragStyle;
            } else {
                // We can skip some rendering calculations if dragging
                isLastInGroup = layerIndex > 0 &&
                    isChildOfSelected &&
                    layerStructure.byIndex(layerIndex - 1).kind === layer.layerKinds.GROUPEND;
                
                // Check to see if this layer is the last in a bunch of nested groups
                if (isStrictDescendantOfSelected &&
                    layerStructure.byIndex(layerIndex - 1).kind === layer.layerKinds.GROUPEND) {
                    var nextVisibleLayer = doc.layers.allVisibleReversed.get(this.props.visibleLayerIndex + 1);
                    if (nextVisibleLayer && !doc.layers.hasStrictSelectedAncestor(nextVisibleLayer)) {
                        endOfGroupStructure = true;
                    }
                }

                dragStyle = {};
            }
            
            var layerClasses = {
                "layer": true,
                "layer__group_start": isGroupStart,
                "layer__select": isSelected,
                "layer__select_child": isChildOfSelected,
                "layer__select_descendant": isStrictDescendantOfSelected,
                "layer__group_end": isLastInGroup,
                "layer__nested_group_end": endOfGroupStructure,
                "layer__group_collapsed": layer.kind === layer.layerKinds.GROUP && !layer.expanded,
                "layer__ancestor_collapsed": doc.layers.hasCollapsedAncestor(layer)
            };

            // Set all the classes need to style this LayerFace
            var faceClasses = {
                "face": true,
                "face__select_immediate": isSelected,
                "face__select_child": isChildOfSelected,
                "face__select_descendant": isStrictDescendantOfSelected,
                "face__drag_target": isDragTarget && this.props.dragStyle,
                "face__drop_target": isDropTarget,
                "face__drop_target_above": dropPosition === "above",
                "face__drop_target_below": dropPosition === "below",
                "face__drop_target_on": dropPosition === "on",
                "face__group_start": isGroupStart,
                "face__group_lastchild": isLastInGroup,
                "face__group_lastchildgroup": endOfGroupStructure
            };

            faceClasses["face__depth-" + depth] = true;

            // Super Hack: If two tooltip regions are flush and have the same title,
            // the plugin does not invalidate the tooltip when moving the mouse from
            // one region to the other. This is used to make the titles to be different,
            // and hence to force the tooltip to be invalidated.
            var tooltipPadding = _.repeat("\u200b", layerIndex),
                tooltipTitle = layer.isArtboard ? strings.LAYER_KIND.ARTBOARD : strings.LAYER_KIND[layer.kind],
                iconID = svgUtil.getSVGClassFromLayer(layer),
                showHideButton = layer.isBackground ? null : (
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
                <li className={classnames(layerClasses)}>
                    <div
                        style={dragStyle}
                        className={classnames(faceClasses)}
                        data-layer-id={layer.id}
                        data-kind={layer.kind}
                        onMouseDown={!this.props.disabled && this.props.handleDragStart}
                        onClick={!this.props.disabled && this._handleLayerClick}>
                        <Button
                            title={tooltipTitle + tooltipPadding}
                            disabled={this.props.disabled}
                            className="face__kind"
                            data-kind={layer.isArtboard ? "artboard" : layer.kind}
                            onClick={this._handleIconClick}
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
                </li>
            );
        }
    });

    // Create a Droppable from a Draggable from a LayerFace.
    var draggedVersion = Draggable.createWithComponent(LayerFace, "y"),
        isEqual = function (layerA, layerB) {
            return layerA.key === layerB.key;
        },
        droppableSettings = function (props) {
            return {
                zone: props.document.id,
                key: props.layer.key,
                keyObject: props.layer,
                isValid: props.isValid,
                handleDrop: props.onDrop
            };
        };

    module.exports = Droppable.createWithComponent(draggedVersion, droppableSettings, isEqual, shouldComponentUpdate);
});
