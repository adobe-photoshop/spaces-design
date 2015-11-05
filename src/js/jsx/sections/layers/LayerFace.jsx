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
        _ = require("lodash"),
        Promise = require("bluebird");
    
    var os = require("adapter/os"),
        system = require("js/util/system"),
        svgUtil = require("js/util/svg"),
        collection = require("js/util/collection"),
        nls = require("js/util/nls");

    var Draggable = require("jsx!js/jsx/shared/Draggable"),
        Droppable = require("jsx!js/jsx/shared/Droppable"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        TextInput = require("jsx!js/jsx/shared/TextInput");
    
    var PS_MAX_NEST_DEPTH = 10;

    var LayerFace = React.createClass({
        mixins: [FluxMixin],
        
        /**
         * Set the initial component state.
         * 
         * @return {{futureReorder: boolean, dropPosition: ?string}} Where:
         *  futureReorder: Used to prevent flash of dragged layer back to original positiion
         *  dropPosition: One of "above", "below" or "on" (the latter of which is only valid
         *      for group drop targets)
         */
        getInitialState: function () {
            return { 
                isDropTarget: false,
                dropPosition: null,
                isDragging: false,
                dragStyle: null
            };
        },
        
        shouldComponentUpdate: function (nextProps, nextState) {
            // Drag states
            if (this.state.isDragging !== nextState.isDragging ||
                this.state.dragStyle !== nextState.dragStyle ||
                this.state.dropPosition !== nextState.dropPosition ||
                this.state.isDropTarget !== nextState.isDropTarget) {
                return true;
            }
            
            // Face change
            if (!Immutable.is(this.props.layer.face, nextProps.layer.face)) {
                return true;
            }

            if (!Immutable.is(this.props.layer.vectorMaskEnabled, nextProps.layer.vectorMaskEnabled)) {
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
                willHaveCollapsedAncestor = nextDocument.layers.hasCollapsedAncestor(nextProps.layer),
                hadInvisibleAncestor = document.layers.hasInvisibleAncestor(this.props.layer),
                willHaveInvisibleAncestor = nextDocument.layers.hasInvisibleAncestor(nextProps.layer);

            return hadCollapsedAncestor !== willHaveCollapsedAncestor ||
                   hadInvisibleAncestor !== willHaveInvisibleAncestor;
        },

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

            // The clicked layer may an have out-of-date document models due to
            // the aggressive SCU method in LayersPanel.
            var documentID = this.props.document.id,
                documentStore = this.getFlux().store("document"),
                currentDocument = documentStore.getDocument(documentID),
                currentLayer = currentDocument.layers.byID(this.props.layer.id);

            this.getFlux().actions.layers.setGroupExpansion(currentDocument, currentLayer,
                !currentLayer.expanded, descendants);
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

            // The clicked layer may an have out-of-date document models due to
            // the aggressive SCU method in LayersPanel.
            var documentID = this.props.document.id,
                documentStore = this.getFlux().store("document"),
                currentDocument = documentStore.getDocument(documentID),
                currentLayer = currentDocument.layers.byID(this.props.layer.id);

            this.getFlux().actions.layers.select(currentDocument, currentLayer, modifier);
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
        
        _validCompatibleDropTarget: function (target, draggedLayers, dropPosition) {
            // TODO
            if (draggedLayers.size === 1 && draggedLayers.first() === target) {
                return false;
            }
            
            // Do not let drop below background
            if (target.isBackground && dropPosition !== "above") {
                return false;
            }

            // Drop on is only allowed for groups
            if (target.kind !== target.layerKinds.GROUP && dropPosition === "on") {
                return false;
            }

            // Do not allow reordering to exceed the nesting limit.
            var doc = this.props.document,
                targetDepth = doc.layers.depth(target);

            // Target depth is incremented if we're dropping INTO a group
            switch (dropPosition) {
            case "below":
                if (target.kind === target.layerKinds.GROUP && target.expanded) {
                    targetDepth++;
                }
                break;
            case "on":
                targetDepth++;
                break;
            default:
                break;
            }

            // When dragging artboards, the nesting limit is 0 because artboard
            // nesting is forbidden.
            var draggingArtboard = draggedLayers.some(function (layer) {
                return layer.isArtboard;
            });

            if (draggingArtboard && targetDepth > 0) {
                return false;
            }

            // Otherwise, the maximum allowable layer depth determines the nesting limit.
            var nestLimitExceeded = draggedLayers.some(function (layer) {
                var layerDepth = doc.layers.depth(layer),
                    layerTreeDepth = doc.layers.maxDescendantDepth(layer) - layerDepth,
                    nestDepth = layerTreeDepth + targetDepth;

                return nestDepth > PS_MAX_NEST_DEPTH;
            });

            if (nestLimitExceeded) {
                return false;
            }

            // Do not allow dragging a group into itself
            var child;
            while (!draggedLayers.isEmpty()) {
                child = draggedLayers.first();
                draggedLayers = draggedLayers.shift();

                if (target.key === child.key) {
                    return false;
                }

                // The special case of dragging a group below itself
                if (child.kind === child.layerKinds.GROUPEND &&
                    dropPosition === "above" && doc.layers.indexOf(child) - doc.layers.indexOf(target) === 1) {
                    return false;
                }

                draggedLayers = draggedLayers.concat(doc.layers.children(child));
            }

            return true;
        },
        
        _getDropPosition: function (dragPosition) {
            var layer = this.props.layer,
                bounds = this.getDOMNode().getBoundingClientRect(),
                dropPosition;

            if (layer.kind === layer.layerKinds.GROUP) {
                // Groups can be dropped above, below or on
                if (dragPosition.y < (bounds.top + (bounds.height / 4))) {
                    // Point is in the top quarter
                    dropPosition = "above";
                } else if (dragPosition.y > (bounds.bottom - (bounds.height / 4))) {
                    // Point is in the bottom quarter
                    dropPosition = "below";
                } else {
                    // Point is in the middle half
                    dropPosition = "on";
                }
            } else {
                // Other layers can only be dropped above or below
                if ((bounds.height / 2) < (bounds.bottom - dragPosition.y)) {
                    dropPosition = "above";
                } else {
                    dropPosition = "below";
                }
            }
            
            return dropPosition;
        },
        
        _handleBeforeDragStart: function () {
            // Photoshop logic is, if we drag a selected layers, all selected layers are being reordered
            // If we drag an unselected layer, only that layer will be reordered
            var draggedLayers = Immutable.List([this.props.layer]);

            if (this.props.layer.selected) {
                draggedLayers = this.props.document.layers.selected.filter(function (layer) {
                    // For now, we only check for background layer, but we might prevent locked layers dragging later
                    return !layer.isBackground;
                }, this);
            }
            
            return { draggedTargets: draggedLayers };
        },
        
        _handleDragStart: function () {
            this.getFlux().actions.ui.disableTooltips();
        },
        
        _handleDragStop: function () {
            this.getFlux().actions.ui.enableTooltips();
            
            this.setState({
                isDragging: false,
                dragStyle: null
            });
        },
        
        _handleDrag: function (dragPosition, dragOffset, initialDragPosition, initialBounds) {
            var dragStyle = {
                top: initialBounds.top + dragOffset.y,
                left: initialBounds.left
            };

            this.setState({
                isDragging: true,
                dragStyle: dragStyle
            });
        },
        
        _handleDrop: function (draggedLayers) {
            if (!this.state.isDropTarget) {
                return Promise.resolve();
            }
            
            this.setState({ isDropTarget: false });
            
            var dropLayer = this.props.layer,
                doc = this.props.document,
                dropPosition = this.state.dropPosition,
                dropOffset;

            switch (dropPosition) {
                case "above":
                    dropOffset = 0;
                    break;
                case "below":
                    if (dropLayer.kind === dropLayer.layerKinds.GROUP && !dropLayer.expanded) {
                        // Drop below the closed group
                        dropOffset = doc.layers.descendants(dropLayer).size;
                    } else {
                        // Drop directly below, inside the closed group
                        dropOffset = 1;
                    }
                    break;
                case "on":
                    dropOffset = 1;
                    break;
                default:
                    throw new Error("Unable to drop at unexpected position: " + dropPosition);
            }

            var dropIndex = doc.layers.indexOf(dropLayer) - dropOffset,
                dragSource = collection.pluck(draggedLayers, "id");

            return this.getFlux().actions.layers.reorder(doc, dragSource, dropIndex);
        },
        
        _handleDragTargetMove: function (draggedLayers, dragPosition) {
            var isDropTarget = !draggedLayers.includes(this.props.layer),
                dropPosition = isDropTarget ? this._getDropPosition(dragPosition) : null,
                canDropLayer = isDropTarget && this._validCompatibleDropTarget(
                    this.props.layer, draggedLayers, dropPosition);
            
            this.setState({ 
                isDropTarget: canDropLayer,
                dropPosition: dropPosition
            });
        },
        
        _handleDragTargetLeave: function () {
            this.setState({ isDropTarget: false });
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
                isDragging = this.state.isDragging,
                isDropTarget = this.state.isDropTarget,
                dropPosition = this.state.dropPosition,
                isGroupStart = layer.kind === layer.layerKinds.GROUP || layer.isArtboard;

            var depth = layerStructure.depth(layer),
                endOfGroupStructure = false,
                isLastInGroup = false,
                dragStyle;

            if (isDragging && this.state.dragStyle) {
                dragStyle = this.state.dragStyle;
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
                "face__drag_target": isDragging && this.state.dragStyle,
                "face__drop_target": isDropTarget,
                "face__drop_target_above": isDropTarget && dropPosition === "above",
                "face__drop_target_below": isDropTarget && dropPosition === "below",
                "face__drop_target_on": isDropTarget && dropPosition === "on",
                "face__group_start": isGroupStart,
                "face__group_lastchild": isLastInGroup,
                "face__group_lastchildgroup": endOfGroupStructure,
                "face__not-visible": !layer.visible || layerStructure.hasInvisibleAncestor(layer)
            };

            faceClasses["face__depth-" + depth] = true;

            // Super Hack: If two tooltip regions are flush and have the same title,
            // the plugin does not invalidate the tooltip when moving the mouse from
            // one region to the other. This is used to make the titles to be different,
            // and hence to force the tooltip to be invalidated.
            var tooltipPadding = _.repeat("\u200b", layerIndex),
                tooltipTitle = layer.isArtboard ?
                    nls.localize("strings.LAYER_KIND.ARTBOARD") :
                    nls.localize("strings.LAYER_KIND." + layer.kind),
                iconID = svgUtil.getSVGClassFromLayer(layer),
                showHideButton = layer.isBackground ? null : (
                    <ToggleButton
                        disabled={this.props.disabled}
                        title={nls.localize("strings.TOOLTIPS.SET_LAYER_VISIBILITY") + tooltipPadding}
                        className="face__button_visibility"
                        size="column-2"
                        buttonType={ layer.visible ? "layer-visible" : "layer-not-visible" }
                        selected={!layer.visible}
                        onClick={this._handleVisibilityToggle}>
                    </ToggleButton>
                ),
                iconClassModifier;

            if (layer.isSmartObject()) {
                if (layer.smartObject.linkMissing) {
                    tooltipTitle += " : " + nls.localize("strings.LAYER_KIND_ALERTS.LINK_MISSING");
                    iconClassModifier = "face__kind__error";
                }

                if (layer.smartObject.linkChanged) {
                    tooltipTitle += " : " + nls.localize("strings.LAYER_KIND_ALERTS.LINK_CHANGED");
                    iconClassModifier = "face__kind__warning";
                }
            }
            if (layer.isTextLayer()) {
                if (layer.textWarningLevel === 2) {
                    iconClassModifier = "face__kind__alert";
                }
            }

            return (
                <Draggable
                    type="layer"
                    keyObject={this.props.layer}
                    beforeDragStart={this._handleBeforeDragStart}
                    onDragStart={this._handleDragStart}
                    onDrag={this._handleDrag}
                    onDragStop={this._handleDragStop}>
                <Droppable
                    accept="layer"
                    onDrop={this._handleDrop}
                    onDragTargetMove={this._handleDragTargetMove}
                    onDragTargetLeave={this._handleDragTargetLeave}>
                    <li className={classnames(layerClasses)}>
                        <div
                            style={dragStyle}
                            className={classnames(faceClasses)}
                            data-layer-id={layer.id}
                            data-kind={layer.kind}
                            onClick={!this.props.disabled && this._handleLayerClick}>
                            <Button
                                title={tooltipTitle + tooltipPadding}
                                disabled={this.props.disabled}
                                className={classnames("face__kind", iconClassModifier)}
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
                                    preventHorizontalScrolling={true}
                                    onKeyDown={this._skipToNextLayerName}
                                    onChange={this._handleLayerNameChange}>
                                </TextInput>
                                {showHideButton}
                            </span>
                            <ToggleButton
                                disabled={this.props.disabled}
                                title={nls.localize("strings.TOOLTIPS.LOCK_LAYER") + tooltipPadding}
                                className="face__button_locked"
                                size="column-2"
                                buttonType={layer.locked ? "toggle-lock" : "toggle-unlock"}
                                selected={layer.locked}
                                onClick={this._handleLockToggle}>
                            </ToggleButton>
                        </div>
                    </li>
                </Droppable>
                </Draggable>
            );
        }
    });

    module.exports = LayerFace;
});
