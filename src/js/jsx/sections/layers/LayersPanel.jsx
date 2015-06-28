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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Immutable = require("immutable"),
        classnames = require("classnames");

    var os = require("adapter/os");

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        LayerFace = require("jsx!./LayerFace"),
        math = require("js/util/math"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection"),
        synchronization = require("js/util/synchronization");

    var PS_MAX_NEST_DEPTH = 10;

    /**
     * Get the layer faces that correspond to the current document. Used for
     * fast, coarse invalidation.
     *
     * @private
     * @param {object} props
     * @return {?Immutable.Iterable.<Immutable.Map.<string, *>>}
     */
    var _getFaces = function (props) {
        var document = props.document;
        if (!document) {
            return null;
        }

        var layers = document.layers.allVisible;
        return collection.pluck(layers, "face");
    };

    var LayersPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("draganddrop")],

        /**
         * A throttled version of os.setTooltip
         *
         * @type {?function}
         */
        _setTooltipThrottled: null,

        /**
         * a store for the bottom of a bounds at the beginning of each drag
         *
         * @type {Number}
         */
        _bottomNodeBounds: null,

        /**
         * Cache of boundingClientRects used during a single drag operation.
         *
         * @type {?Map.<object>}
         */
        _boundingClientRectCache: null,

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                dragAndDropStore = flux.store("draganddrop"),
                dragAndDropState = dragAndDropStore.getState();

            return {
                dragTargets: dragAndDropState.dragTargets,
                dropTarget: dragAndDropState.dropTarget,
                dragPosition: dragAndDropState.dragPosition,
                pastDragTargets: dragAndDropState.pastDragTargets
            };
        },

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
        },
        
        componentWillReceiveProps: function (nextProps) {
            if (nextProps.document.id !== this.props.document.id) {
                // Changing document, need to tell layers to not register themselves
                this.setState({
                    batchRegister: true
                });
            } else {
                // If we are updating the panel without changing the document
                // We want the individual layers to register themselves
                this.setState({
                    batchRegister: false
                });
            }
        },

        componentDidMount: function () {
            this._scrollToSelection(this.props.document.layers.selected);
            this._bottomNodeBounds = 0;
            
            // For all layer refs, ask for their registration info and add to list
            var batchRegistrationInformation = this.props.document.layers.allVisible.map(function (i) {
                return this.refs[i.key].getRegistration();
            }, this);

            var zone = this.props.document.id,
                flux = this.getFlux();

            flux.store("draganddrop").batchRegisterDroppables(zone, batchRegistrationInformation);
        },

        componentDidUpdate: function (prevProps) {
            var nextSelected = this.props.document.layers.selected,
                prevSelected = prevProps.document ? prevProps.document.layers.selected : Immutable.List(),
                newSelection = collection.difference(nextSelected, prevSelected),
                flux = this.getFlux(),
                zone = this.props.document.id;

            this._scrollToSelection(newSelection);

            if (prevProps.document.id !== this.props.document.id) {
                // For all layer refs, ask for their registration info and add to list
                var batchRegistrationInformation = this.props.document.layers.allVisible.map(function (i) {
                    return this.refs[i.key].getRegistration();
                }.bind(this));

                flux.store("draganddrop").resetDroppables(zone, batchRegistrationInformation);
            }

            if (!Immutable.is(this.props.document.layers.index, prevProps.document.layers.index)) {
                var pastLayerKeys = collection.pluck(prevProps.document.layers.all, "key"),
                    currentLayerKeys = collection.pluck(this.props.document.layers.all, "key"),
                    removedLayerKeys = collection.difference(pastLayerKeys, currentLayerKeys);

                if (removedLayerKeys.size > 0) {
                    flux.store("draganddrop").batchDeregisterDroppables(zone, removedLayerKeys);
                }
            }
        },

        componentWillUnmount: function () {
            var flux = this.getFlux(),
                zone = this.props.document.id;

            flux.store("draganddrop").batchDeregisterDroppables(zone);
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            if (this.props.disabled !== nextProps.disabled) {
                return true;
            }

            if (this.props.visible !== nextProps.visible) {
                return true;
            }

            if (this.state.dragTargets !== nextState.dragTargets) {
                return true;
            }

            if (this.state.dropTarget !== nextState.dropTarget) {
                return true;
            }

            if (this.state.futureReorder !== nextState.futureReorder) {
                return true;
            }

            return this.state.dragTargets !== nextState.dragTargets ||
                this.state.dropTarget !== nextState.dropTarget ||
                this.state.dragPosition !== nextState.dragPosition ||
                !Immutable.is(_getFaces(this.props), _getFaces(nextProps));
        },

        /* Set initial state
         * State variables are:
         *  futureReorder {boolean} - Need this to prevent flash of dragged layer 
         *     back to original positiion
         *  batchRegister {boolean} - Should we register all dropppables at once 
         *     (and prevent individual droppables from registering)
         *  dropAbove {boolean} - Should the dragged layer drop above or below target
         *
         * @return {object}
         */
        getInitialState: function () {
            return {
                futureReorder: false,
                batchRegister: true,
                dropAbove: false
            };
        },

        /**
         * Gets the lowest Node pointer to the current bottom of our list
         *
         * @return {?DOMElement}
         */
        _getLowestNode: function () {
            if (!this.refs.parent) {
                return;
            }

            var parentNode = React.findDOMNode(this.refs.container),
                pageNodes = parentNode.children,
                pageNodeCount = pageNodes.length;

            return pageNodeCount > 0 ? pageNodes[pageNodeCount - 1] : null;
        },
        /**
         * Scrolls to portion of layer panel containing the first element of the passed selection
         *
         * @param {Immutable.List.<Layer>} selected layers to attempt to scroll to
         */
        _scrollToSelection: function (selected) {
            if (selected.size > 0) {
                var focusLayer = selected.first(),
                childNode = React.findDOMNode(this.refs[focusLayer.key]);

                if (childNode) {
                    childNode.scrollIntoViewIfNeeded();
                }
            }
        },

        /**
         * Get a boundingClientRect for the given DOM node, possibly returning
         * a cached value.
         *
         * @private
         * @param {DOMElement} node
         * @return {{top: number, right: number, bottom: number, left: number}}
         */
        _getBoundingClientRectFromCache: function (node) {
            var rect = this._boundingClientRectCache.get(node);
            if (!rect) {
                rect = node.getBoundingClientRect();
                this._boundingClientRectCache.set(node, rect);
            }

            return rect;
        },

        /**
         * Given that the dragged layers are compatible with the target layer,
         * determines whether the target is a valid drop point (either above or
         * below) for the dragged layers.
         *
         * @private
         * @param {Layer} target
         * @param {Immutable.Iterable.<Layer>} draggedLayers
         * @param {boolean} dropAbove
         */
        _validCompatibleDropTarget: function (target, draggedLayers, dropAbove) {
            // Do not let drop below background
            if (target.isBackground && !dropAbove) {
                return false;
            }

            // Do not let reorder exceed nesting limit
            // When we drag artboards, this limit is 1
            // because we can't nest artboards in any layers
            var doc = this.props.document,
                targetDepth = doc.layers.depth(target),
                draggingArtboard = draggedLayers
                    .some(function (layer) {
                        return layer.isArtboard;
                    }),
                nestLimitExceeded = draggedLayers.some(function (layer) {
                    var layerDepth = doc.layers.depth(layer),
                        layerTreeDepth = doc.layers.maxDescendantDepth(layer) - layerDepth,
                        extraDepth = dropAbove ? 0 : 1,
                        nestDepth = layerTreeDepth + targetDepth + extraDepth,
                        maxDepth = draggingArtboard ? 1 : PS_MAX_NEST_DEPTH;

                    return nestDepth > maxDepth;
                });

            if (nestLimitExceeded) {
                return false;
            }

            var child;
            while (!draggedLayers.isEmpty()) {
                child = draggedLayers.first();
                draggedLayers = draggedLayers.shift();

                if (target === child) {
                    return false;
                }

                // The special case of dragging a group below itself
                if (child.kind === child.layerKinds.GROUPEND &&
                    dropAbove && doc.layers.indexOf(child) - doc.layers.indexOf(target) === 1) {
                    return false;
                }

                draggedLayers = draggedLayers.concat(doc.layers.children(child));
            }

            return true;
        },

        /**
         * Determines whether the target is a valid drop point for the dragged
         * layers at the given point.
         *
         * @param {{DOMElement: node, target: Layer}} dropInfo
         * @param {Immutable.List.<Layer>} draggedLayers Currently dragged layers
         * @param {{x: number, y: number}} point Point where drop event would occur
         * @return {boolean} Whether the aforementioned drop may occur
         */
        _validDropTarget: function (dropInfo, draggedLayers, point) {
            var dropNode = dropInfo.node,
                bounds = this._getBoundingClientRectFromCache(dropNode);

            if (point.y < bounds.top || point.y > bounds.bottom ||
                point.x < bounds.left || point.y > bounds.right) {
                return {
                    compatible: false,
                    valid: false
                };
            }

            var dropAbove = false;
            if (point && bounds) {
                if ((bounds.height / 2) < (bounds.bottom - point.y)) {
                    dropAbove = true;
                }
            }

            var target = dropInfo.keyObject,
                valid = this._validCompatibleDropTarget(target, draggedLayers, dropAbove);

            if (valid && this.state.dropAbove !== dropAbove) {
                // For performance reasons, it's important that this NOT cause a virtual
                // render. Instead, we should just wait until the dropPosition changes and
                // render then; otherwise, we'll render twice in one trip around the
                // mousemove handler. This is accomplished by making shouldComponentUpdate oblivious
                // to the dropAbove state.
                this.setState({
                    dropAbove: dropAbove
                });
            }

            return {
                compatible: true,
                valid: valid
            };
        },
        /**
         * Tests to make sure drop target index is not a child of any of the dragged layers
         *
         * @param {Immutable.List.<Layer>} layers Currently dragged layers
         * @param {number} index Layer that the mouse is overing on as potential drop target
         * @return {boolean} Whether the selection can be reordered to the given layer or not
         */
        _validDropTargetIndex: function (layers, index) {
            var doc = this.props.document,
                layerID = math.parseNumber(this._getLowestNode.getAttribute("data-layer-id")),
                lowestLayer = doc.layers.byID(layerID),
                child;
 
            if (index === 0 && lowestLayer && lowestLayer.isBackground) {
                return false;
            }

            while (!layers.isEmpty()) {
                child = layers.first();
                layers = layers.shift();

                if (index === doc.layers.indexOf(child)) {
                    return false;
                }

                // The special case of dragging a group below itself
                if (child.kind === child.layerKinds.GROUPEND &&
                    doc.layers.indexOf(child) - index === 1) {
                    return false;
                }

                layers = layers.concat(doc.layers.children(child));
            }

            return true;
        },

        /** 
         * Tests to make sure layer we're trying to drag is draggable
         * For now, we only check for background layer, but we might prevent locked layers dragging later
         *
         * @param {Layer} layer Layer being tested for drag
         */
        _validDragTarget: function (layer) {
            return !layer.isBackground;
        },

        /**
         * Grabs the list of Layer objects that are currently being dragged
         * Photoshop logic is, if we drag a selected layers, all selected layers are being reordered
         * If we drag an unselected layer, only that layer will be reordered
         *
         * @param {ReactElement} dragComponent Layer the user is dragging
         * @return {Immutable.List.<Layer>}
         */
        _getDraggingLayers: function (dragComponent) {
            var dragLayer = dragComponent.props.layer;

            if (dragLayer.selected) {
                var doc = this.props.document;
                return doc.layers.selected.filter(function (layer) {
                    return this._validDragTarget(layer);
                }, this);
            } else {
                return Immutable.List.of(dragLayer);
            }
        },

        /**
         * Reset the boundingClientRect cache at the beginning of the drag.
         */
        _handleStart: function () {
            this._boundingClientRectCache = new Map();
        },

        /**
         * Custom drag finish handler. Calculates the drop index through the target,
         * removes drop target properties, and calls the reorder action.
         *
         */
        _handleStop: function () {
            if (this.state.dragTargets) {
                var flux = this.getFlux(),
                    doc = this.props.document,
                    above = this.state.dropAbove,
                    dropIndex = doc.layers.indexOf(this.state.dropTarget.keyObject) - (above ? 0 : 1);

                this.setState({
                    futureReorder: true
                });

                var dragSource = collection.pluck(this.state.dragTargets, "id");

                flux.actions.layers.reorder(doc, dragSource, dropIndex)
                    .bind(this)
                    .finally(function () {
                        this.setState({
                            dropAbove: null,
                            futureReorder: false
                        });
                    });
            } else {
                this.setState({
                    dropAbove: null
                });
            }

            this._boundingClientRectCache = null;
        },

        /**
         * Deselects all layers.
         */
        _handleContainerClick: function () {
            this.getFlux().actions.layers.deselectAll();
        },

        /**
         * Workaround a CEF bug by clearing any active tooltips when scrolling.
         * More details here: https://github.com/adobe-photoshop/spaces-design/issues/444
         *
         * @private
         */
        _handleScroll: function () {
            this._setTooltipThrottled("");
            this._boundingClientRectCache = this.state.dragTargets ? new Map() : null;
        },

        render: function () {
            var doc = this.props.document,
                dragTargets = this.state.dragTargets,
                dropTarget = this.state.dropTarget;

            if (this.state.futureReorder) {
                dragTargets = this.state.pastDragTargets;
            }

            var dragTargetSet = dragTargets && dragTargets.toSet(),
                layerComponents = doc.layers.allVisibleReversed
                    .map(function (layer, visibleIndex) {
                        var isDragTarget = !!(dragTargets && dragTargetSet.has(layer)),
                            isDropTarget = !!(dropTarget && dropTarget.key === layer.key);

                        return (
                            <LayerFace
                                key={layer.key}
                                ref={layer.key}
                                disabled={this.props.disabled}
                                registerOnMount={!this.state.batchRegister}
                                deregisterOnUnmount={false}
                                document={doc}
                                layer={layer}
                                axis="y"
                                visibleLayerIndex={visibleIndex}
                                dragPlaceholderClass="face__placeholder"
                                zone={doc.id}
                                isValid={this._validDropTarget}
                                onDragStart={this._handleStart}
                                onDragStop={this._handleStop}
                                getDragItems={this._getDraggingLayers}
                                dragTarget={isDragTarget}
                                dragPosition={(isDropTarget || isDragTarget) &&
                                    this.state.dragPosition}
                                dropTarget={isDropTarget}
                                dropAbove={!!(isDropTarget && this.state.dropAbove)} />
                        );
                    }, this);

            var layerListClasses = classnames({
                "layer-list": true,
                "layer-list__dragging": !!dragTargets
            });

            var childComponents = (
                <ul ref="parent" className={layerListClasses}>
                    {layerComponents}
                </ul>
            );

            var layerCount = (
                <div
                    title={strings.TOOLTIPS.LAYER_COUNT}
                    className="layer-count">
                    {doc.layers.selected.size}<span className="text-fancy"> oƒ </span>{doc.layers.count}
                </div>
            );

            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "layers": true,
                "section": true,
                "section__sibling-collapsed": !this.props.visibleSibling
            });

            return (
                <section
                    className={sectionClasses}
                    onScroll={this._handleScroll}>
                    <TitleHeader
                        title={strings.TITLE_PAGES}
                        visible={this.props.visible}
                        disabled={this.props.disabled}
                        onDoubleClick={this.props.onVisibilityToggle}>
                        {layerCount}
                    </TitleHeader>
                    <div
                        ref="container"
                        className={containerClasses}
                        onClick={this._handleContainerClick}>
                        {childComponents}
                    </div>
                </section>
            );
        }
    });

    module.exports = LayersPanel;
});
