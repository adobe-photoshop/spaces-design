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
        ReactDOM = require("react-dom"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        classnames = require("classnames"),
        Immutable = require("immutable"),
        _ = require("lodash"),
        Promise = require("bluebird");
    
    var system = require("js/util/system"),
        svgUtil = require("js/util/svg"),
        collection = require("js/util/collection"),
        nls = require("js/util/nls");

    var Draggable = require("js/jsx/shared/Draggable"),
        Droppable = require("js/jsx/shared/Droppable"),
        Button = require("js/jsx/shared/Button"),
        SVGIcon = require("js/jsx/shared/SVGIcon"),
        ToggleButton = require("js/jsx/shared/ToggleButton"),
        TextInput = require("js/jsx/shared/TextInput");
    
    var PS_MAX_NEST_DEPTH = 10;

    var LayerFace = React.createClass({
        mixins: [FluxMixin],
        
        /**
         * Indicates whether the component is the initial target of a drag event.
         *
         * @private
         * @type {boolean}
         */
        _isDragEventTarget: false,
        
        /**
         * True if the layer is or was expanded. Used to avoid
         * rendering its child faces until they are first visible.
         *
         * @private
         * @type {boolean}
         */
        _isExpanded: false,

        getInitialState: function () {
            return {
                layer: this._getDocument().layers.byID(this.props.layerID),
                isDropTarget: false,
                dropPosition: null,
                isDragging: false,
                dragStyle: null
            };
        },
        
        componentWillMount: function () {
            this.getFlux().stores.document.addLayerFaceListener(this.props.documentID, this.props.layerID,
                this._handleLayerFaceChange);
        },
        
        componentWillUnmount: function () {
            this.getFlux().stores.document.removeLayerFaceListener(this.props.documentID, this.props.layerID,
                this._handleLayerFaceChange);
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            var depth = nextProps.depth,
                isLayerChanged = !!nextProps.changedLayerIDPaths[depth] &&
                    nextProps.changedLayerIDPaths[depth].has(nextProps.layerID);

            if (isLayerChanged) {
                return true;
            }
            
            if (this.state.isDragging !== nextState.isDragging ||
                this.state.dragStyle !== nextState.dragStyle ||
                this.state.dropPosition !== nextState.dropPosition ||
                this.state.isDropTarget !== nextState.isDropTarget ||
                !Immutable.is(this.state.layer, nextState.layer)) {
                return true;
            }
            
            return false;
        },

        /**
         * Expand or collapse the selected groups.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleIconClick: function (event) {
            var layer = this.state.layer;
            if (!layer.isGroup) {
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
            var currentDocument = this._getDocument(),
                currentLayer = currentDocument.layers.byID(this.state.layer.id);

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
            if (newName.length !== 0) {
                if (newName !== this.props.layer.name) {
                    this.getFlux().actions.layers.rename(this._getDocument, this.props.layer, newName);
                }
            } else {
                this.refs.layerName.setValue(this.props.layer.name);
            }
        },
        
        /** @ignore */
        _getDocument: function () {
            return this.getFlux().stores.document.getDocument(this.props.documentID);
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
        
        /** @ignore */
        _handleLayerFaceChange: function (nextLayer) {
            this.setState({
                layer: nextLayer
            });
        },

        /**
         * Grabs the correct modifier by processing event modifier keys
         * and calls the select action with correct modifier.
         * 
         * @private
         * @param {SyntheticEvent} event React event
         */
        _handleLayerClick: function (event) {
            window.console.time("Layer Select");
            event.stopPropagation();

            var modifier = "select";
            if (event.shiftKey) {
                modifier = "addUpTo";
            } else if (system.isMac ? event.metaKey : event.ctrlKey) {
                var selected = this.state.layer.selected;

                if (selected) {
                    modifier = "deselect";
                } else {
                    modifier = "add";
                }
            }

            // The clicked layer may an have out-of-date document models due to
            // the aggressive SCU method in LayersPanel.
            var currentDocument = this._getDocument(),
                currentLayer = currentDocument.layers.byID(this.state.layer.id);

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
            this.getFlux().actions.layers.setVisibility(this._getDocument(), this.state.layer, !toggled);
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
            var layer = this.state.layer;
            if (layer.locked || !layer.visible) {
                return;
            }

            this.getFlux().actions.superselect.editLayer(this._getDocument(), layer);
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
            this.getFlux().actions.layers.setLocking(this._getDocument(), this.state.layer, toggled);
            event.stopPropagation();
        },
        
        /**
         * Given that the dragged layers are compatible with the target layer,
         * determines whether the target is a valid drop point (either above or
         * below) for the dragged layers.
         *
         * @private
         * @param {Layer} target
         * @param {Immutable.Iterable.<Layer>} draggedLayers
         * @param {string} dropPosition
         */
        _validCompatibleDropTarget: function (target, draggedLayers, dropPosition) {
            if (draggedLayers.size === 1 && draggedLayers.first() === target) {
                return false;
            }
            
            // Do not let drop below background
            if (target.isBackground && dropPosition !== "above") {
                return false;
            }

            // Drop on is only allowed for groups
            if (!target.isGroup && dropPosition === "on") {
                return false;
            }

            // Do not allow reordering to exceed the nesting limit.
            var doc = this._getDocument(),
                targetDepth = this.props.depth;

            // Target depth is incremented if we're dropping INTO a group
            switch (dropPosition) {
            case "below":
                if (target.isGroup && target.expanded) {
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
                if (child.isGroupEnd &&
                    dropPosition === "above" && doc.layers.indexOf(child) - doc.layers.indexOf(target) === 1) {
                    return false;
                }

                draggedLayers = draggedLayers.concat(doc.layers.children(child));
            }

            return true;
        },
        
        /**
         * Return the drop position based on the current drag position.
         *
         * @private
         * @param {{x: number, y: number}} dragPosition
         * @return {string}
         */
        _getDropPosition: function (dragPosition) {
            var layer = this.state.layer,
                bounds = ReactDOM.findDOMNode(this.refs.face).getBoundingClientRect(),
                dropPosition;

            if (layer.isGroup) {
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
        
        /**
         * Handle before drag start.
         * 
         * @private
         * @type {Draggable~beforeDragStart}
         */
        _handleBeforeDragStart: function () {
            // Photoshop logic is, if we drag a selected layers, all selected layers are being reordered
            // If we drag an unselected layer, only that layer will be reordered
            var document = this._getDocument(),
                layer = document.layers.byID(this.props.layerID),
                draggedLayers = Immutable.List([layer]);

            if (layer.selected) {
                draggedLayers = document.layers.selected.filter(function (layer) {
                    // For now, we only check for background layer, but we might prevent locked layers dragging later
                    return !layer.isBackground;
                }, this);
            }
            
            this._isDragEventTarget = true;
            this.getFlux().actions.panel.disableTooltips();
            
            return { draggedTargets: draggedLayers };
        },

        /**
         * Handle drag stop.
         *
         * @private
         * @type {Draggable~onDragStop}
         */
        _handleDragStop: function () {
            if (this._isDragEventTarget) {
                this.getFlux().actions.panel.enableTooltips();
                this._isDragEventTarget = false;
            }
            
            if (this.isMounted()) {
                this.setState({
                    isDragging: false,
                    dragStyle: null
                });
            }
        },
        
        /**
         * Handle drag.
         *
         * @private
         * @type {Draggable~onDrag}
         */
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
        
        /**
         * Handle drop.
         *
         * @private
         * @type {Droppable~onDrop}
         */
        _handleDrop: function (draggedLayers) {
            if (!this.state.isDropTarget) {
                return Promise.resolve();
            }
            
            this.setState({ isDropTarget: false });
            
            var dropLayer = this.state.layer,
                doc = this._getDocument(),
                dropPosition = this.state.dropPosition,
                dropOffset;

            switch (dropPosition) {
                case "above":
                    dropOffset = 0;
                    break;
                case "below":
                    if (dropLayer.isGroup && !dropLayer.expanded) {
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
        
        /**
         * Handle drag move.
         *
         * @private
         * @type {Droppable~onDragTargetMove}
         */
        _handleDragTargetMove: function (draggedLayers, dragPosition) {
            var layer = this.state.layer,
                isDropTarget = !draggedLayers.includes(layer),
                dropPosition = isDropTarget ? this._getDropPosition(dragPosition) : null,
                canDropLayer = isDropTarget && this._validCompatibleDropTarget(
                    layer, draggedLayers, dropPosition);

            this.setState({
                isDropTarget: canDropLayer,
                dropPosition: dropPosition
            });
        },
        
        /**
         * Handle drag leave.
         *
         * @private
         * @type {Droppable~onDragTargetLeave}
         */
        _handleDragTargetLeave: function () {
            this.setState({
                isDropTarget: false,
                dropPosition: null
            });
        },

        render: function () {
            var doc = this._getDocument(),
                layer = this.state.layer,
                layerIndex = doc.layers.indexOf(layer),
                nameEditable = !layer.isBackground,
                isDragging = this.state.isDragging,
                isDropTarget = this.state.isDropTarget,
                dropPosition = this.state.dropPosition,
                hasChildren = this.props.layerNodes;
            
            var layerClasses = classnames({
                "layer": true,
                "layer__select": layer.selected,
                "layer-group": hasChildren,
                "layer-group__selected": hasChildren && layer.selected,
                "layer-group__collapsed": hasChildren && !layer.expanded,
                "layer-group__not-visible": hasChildren && !layer.visible,
                "layer-group__drag-target": isDragging
            });

            // Set all the classes need to style this LayerFace
            var faceClasses = classnames({
                "face": true,
                "face__selected": layer.selected,
                "face__not-visible": !layer.visible,
                "face__drag-target": isDragging,
                "face__drop_target": isDropTarget,
                "face__drop_target_above": isDropTarget && dropPosition === "above",
                "face__drop_target_below": isDropTarget && dropPosition === "below",
                "face__drop_target_on": isDropTarget && dropPosition === "on"
            }, "face__depth-" + this.props.depth);

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
                        title={nls.localize("strings.TOOLTIPS.SET_LAYER_VISIBILITY")}
                        className="face__button_visibility"
                        size="column-2"
                        buttonType={ layer.visible ? "layer-visible" : "layer-not-visible" }
                        selected={!layer.visible}
                        onClick={this._handleVisibilityToggle}>
                    </ToggleButton>
                ),
                iconClassModifier;

            if (layer.isSmartObject) {
                if (layer.smartObject.linkMissing) {
                    tooltipTitle += " : " + nls.localize("strings.LAYER_KIND_ALERTS.LINK_MISSING");
                    iconClassModifier = "face__kind__error";
                }

                if (layer.smartObject.linkChanged) {
                    tooltipTitle += " : " + nls.localize("strings.LAYER_KIND_ALERTS.LINK_CHANGED");
                    iconClassModifier = "face__kind__warning";
                }
            }
            if (layer.isText) {
                if (layer.textWarningLevel === 2) {
                    iconClassModifier = "face__kind__alert";
                }
            }

            var layerList;

            if (hasChildren && (layer.expanded || this._isExpanded)) {
                this._isExpanded = true;
                
                var LayersList = require("jsx!./LayersList");

                layerList = (
                    <LayersList
                        disabled={this.props.disabled}
                        documentID={this.props.documentID}
                        layerNodes={this.props.layerNodes}
                        depth={this.props.depth + 1}
                        changedLayerIDPaths={this.props.changedLayerIDPaths}/>
                );
            }
            
            window.console.timeEnd("Layer Select");
            
            return (
                <Draggable
                    type="layer"
                    target={layer}
                    beforeDragStart={this._handleBeforeDragStart}
                    onDragStart={this._handleDragStart}
                    onDrag={this._handleDrag}
                    onDragStop={this._handleDragStop}>
                    <Droppable
                        accept="layer"
                        onDrop={this._handleDrop}
                        onDragTargetMove={this._handleDragTargetMove}
                        onDragTargetLeave={this._handleDragTargetLeave}>
                        <li className={layerClasses}>
                            <div
                                ref="face"
                                style={this.state.dragStyle}
                                className={faceClasses}
                                data-layer-id={layer.id}
                                data-kind={layer.kind.toLowerCase()}
                                onClick={!this.props.disabled && this._handleLayerClick}>
                                <Button
                                    title={tooltipTitle + tooltipPadding}
                                    disabled={this.props.disabled}
                                    className={classnames("face__kind", iconClassModifier)}
                                    data-kind={layer.isArtboard ? "artboard" : layer.kind.toLowerCase()}
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
                                        doubleClickToEdit={true}
                                        value={layer.name}
                                        disabled={this.props.disabled || !nameEditable}
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
                            {layerList}
                        </li>
                    </Droppable>
                </Draggable>
            );
        }
    });

    module.exports = LayerFace;
});
