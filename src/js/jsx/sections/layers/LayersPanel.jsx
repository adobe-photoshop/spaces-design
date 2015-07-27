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
        classnames = require("classnames"),
        _ = require("lodash");

    var os = require("adapter/os");

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        LayerFace = require("jsx!./LayerFace"),
        DummyLayerFace = require("jsx!./DummyLayerFace"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection"),
        synchronization = require("js/util/synchronization");

    var PS_MAX_NEST_DEPTH = 10;

    /**
     * After the first render, the render window size will be calculated as
     * parent container height divided by layer face height. For the first
     * render, this approximation is used.
     *
     * @const
     * @private
     * @type {number}
     */
    var INITIAL_RENDER_WINDOW_SIZE = 100;

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
         * @private
         * @type {?function}
         */
        _setTooltipThrottled: null,

        /**
         * Cache of boundingClientRects used during a single drag operation.
         *
         * @private
         * @type {?Map.<object>}
         */
        _boundingClientRectCache: null,

        /**
         * Set of layer IDs with faces that have been mounted. Used to avoid
         * rendering faces until they are first visible. Initialized when the
         * panel is mounted.
         *
         * @private
         * @type {Set.<number>}
         */
        _mountedLayerIDs: null,

        /**
         * A layer which will be centered in the layers panel on the next render.
         * This is always a "visible" layer, meaning it does not have a collapsed
         * ancestor. This reference is nullified after scrolling to center the
         * layer in the panel.
         *
         * @private
         * @type {?Layer}
         */
        _focusLayer: null,

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

        /**
         * Before rendering, set the _focusLayer so that its position in the
         * index can be taken into account when computing the render window.
         * After rendering, the panel will be scrolled to the focus layer.
         *
         * @param {Document} nextDocument
         * @param {Document=} previousDocument
         */
        _updateFocusLayer: function (nextDocument, previousDocument) {
            var nextLayers = nextDocument.layers,
                nextSelected = nextLayers.selected,
                nextSelectedIDs = collection.pluck(nextSelected, "id"),
                previousSelected = previousDocument ? previousDocument.layers.selected : Immutable.List(),
                previousSelectedIDs = collection.pluck(previousSelected, "id");

            if (Immutable.is(nextSelectedIDs, previousSelectedIDs)) {
                return;
            }

            var focusLayer = collection.difference(nextSelected, previousSelected).first();
            if (focusLayer && !nextLayers.hasCollapsedAncestor(focusLayer)) {
                this._focusLayer = focusLayer;
            }
        },

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
            this._mountedLayerIDs = new Set();
            this._updateFocusLayer(this.props.document);
        },

        componentDidMount: function () {
            this._initRenderWindow();
            this._scrollToFocusLayer();

            // Used to re-set the render window parameters (e.g., heights of the scroll 
            // container and layer faces) after window resize, etc.
            this._initRenderWindowDebounced = _.debounce(this._initRenderWindow, 1000);
            window.addEventListener("resize", this._initRenderWindowDebounced);
        },

        componentWillUnmount: function () {
            window.removeEventListener("resize", this._initRenderWindowDebounced);
        },

        componentWillUpdate: function (nextProps) {
            // Set the focus layer before update
            this._updateFocusLayer(nextProps.document, this.props.document);
        },

        componentDidUpdate: function () {
            // Scroll to the focus layer after update
            this._scrollToFocusLayer();
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

            if (this.state.scrollTop !== nextState.scrollTop) {
                return true;
            }

            if (this.state.renderWindowHeight !== nextState.renderWindowHeight) {
                return true;
            }

            if (this.state.layerFaceHeight !== nextState.layerFaceHeight) {
                return true;
            }

            if (nextState.futureReorder) {
                // if we're currently re-ordering, don't re-render
                return false;
            } else if (this.state.futureReorder) {
                // if we're finishing a re-order, always re-render
                return true;
            }

            return this.state.dragTargets !== nextState.dragTargets ||
                this.state.dropTarget !== nextState.dropTarget ||
                this.state.dragPosition !== nextState.dragPosition ||
                !Immutable.is(_getFaces(this.props), _getFaces(nextProps));
        },

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
                futureReorder: false,
                dropPosition: null
            };
        },

        /**
         * Scrolls the layers panel to make the focus layer visible, if defined.
         */
        _scrollToFocusLayer: function () {
            var focusLayer = this._focusLayer;
            if (!focusLayer) {
                return;
            }

            var childNode = React.findDOMNode(this.refs[focusLayer.key]);
            if (childNode) {
                childNode.scrollIntoViewIfNeeded();
                this._focusLayer = null;
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
         * @param {string} dropPosition
         */
        _validCompatibleDropTarget: function (target, draggedLayers, dropPosition) {
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

            // Dropping on the dummy layer is valid as long as a group is not
            // being dropped below itself. The dummy layer only exists
            // when there is a bottom group layer. Drop position is fixed.
            var dropKey = dropInfo.key;
            if (dropKey === "dummy") {
                var bottom = this.props.document.layers.top.last(),
                    isGroup = bottom.kind === bottom.layerKinds.GROUP;

                return {
                    compatible: true,
                    valid: !isGroup || !draggedLayers.contains(bottom)
                };
            }

            var target = dropInfo.keyObject,
                dropPosition;

            if (target.kind === target.layerKinds.GROUP) {
                // Groups can be dropped above, below or on
                if (point.y < (bounds.top + (bounds.height / 4))) {
                    // Point is in the top quarter
                    dropPosition = "above";
                } else if (point.y > (bounds.bottom - (bounds.height / 4))) {
                    // Point is in the bottom quarter
                    dropPosition = "below";
                } else {
                    // Point is in the middle half
                    dropPosition = "on";
                }
            } else {
                // Other layers can only be dropped above or below
                if ((bounds.height / 2) < (bounds.bottom - point.y)) {
                    dropPosition = "above";
                } else {
                    dropPosition = "below";
                }
            }

            var valid = this._validCompatibleDropTarget(target, draggedLayers, dropPosition);

            if (valid && this.state.dropPosition !== dropPosition) {
                // For performance reasons, it's important that this NOT cause a virtual
                // render. Instead, we should just wait until the dropPosition changes and
                // render then; otherwise, we'll render twice in one trip around the
                // mousemove handler. This is accomplished by making shouldComponentUpdate oblivious
                // to the dropPosition state.
                this.setState({
                    dropPosition: dropPosition
                });
            }

            return {
                compatible: true,
                valid: valid
            };
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
         * Initialize the boundingClientRect cache at the beginning of the drag.
         */
        _handleStart: function () {
            this._boundingClientRectCache = new Map();
            this.getFlux().actions.ui.disableTooltips();
        },

        /**
         * Custom drop handler. Calculates the drop index through the target,
         * removes drop target properties, and calls the reorder action.
         */
        _handleDrop: function () {
            if (this.state.dragTargets) {
                var flux = this.getFlux(),
                    doc = this.props.document,
                    dropTarget = this.state.dropTarget,
                    dropIndex;

                // Dropping on the dummy layer reorders to the bottom of the index
                if (dropTarget.key === "dummy") {
                    dropIndex = 0;
                } else {
                    var position = this.state.dropPosition,
                        dropLayer = dropTarget.keyObject,
                        dropOffset = position === "above" ? 0 : 1;

                    switch (position) {
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
                        throw new Error("Unable to drop at unexpected position: " + position);
                    }

                    dropIndex = doc.layers.indexOf(dropLayer) - dropOffset;
                }

                this.setState({
                    futureReorder: true
                });

                var dragSource = collection.pluck(this.state.dragTargets, "id");

                return flux.actions.layers.reorder(doc, dragSource, dropIndex)
                    .bind(this)
                    .finally(function () {
                        this.setState({
                            dropPosition: null,
                            futureReorder: false
                        });

                        // HACK: See explanation in _handleStop below.
                        os.resetCursor();
                    });
            } else {
                this.setState({
                    dropPosition: null
                });
                
                return Promise.resolve();
            }
        },

        /**
         * Nullify the boundingClientRect cache at the end of the drag.
         */
        _handleStop: function () {
            this._boundingClientRectCache = null;
            this.getFlux().actions.ui.enableTooltips();

            // HACK: The cursor does not seem to revert from "grabbing" to "default"
            // after the drag ends until the next mouse move, so we explicitly reset
            // it. Mysteriously, this does not seem sufficient in case the drag
            // succeeds and some reordering takes place. This may be a facet of the
            // adapter bug that prevents mousemove events from being delivered while
            // the main PS thread is busy.
            os.resetCursor();
        },

        /**
         * Deselects all layers.
         */
        _handleContainerClick: function () {
            this.getFlux().actions.layers.deselectAll();
        },

        /**
         * Initialize values needed for the render window calculation, including
         * the height of the scroll container and the layer face height. This
         * must be called before _updateRenderWindow can be called, and should
         * be called again whenever those height values may have changed.
         *
         * @private
         */
        _initRenderWindow: function () {
            var parent = this.refs.parent,
                parentNode = React.findDOMNode(parent).parentNode,
                parentBounds = parentNode.getBoundingClientRect(),
                scrollTop = parentNode.scrollTop,
                windowHeight = parentBounds.height;

            // This happens if the LayersPanel is associated with an inactive document
            if (windowHeight === 0) {
                return;
            }

            // Find a valid layer element for a layer face height measurement
            var children = parentNode.children[0].children,
                faceHeight,
                index,
                child;

            for (index = 0; index < children.length; index++) {
                child = children[index];
                if (child.classList.contains("layer__dummy")) {
                    continue;
                }

                faceHeight = child.getBoundingClientRect().height;
                break;
            }

            this.setState({
                scrollTop: scrollTop,
                renderWindowHeight: windowHeight,
                layerFaceHeight: faceHeight
            });
        },

        /**
         * A debounced version of initRenderWindow, initialized in componentWillMount.
         *
         * @private
         * @type {function}
         */
        _initRenderWindowDebounced: null,

        /**
         * Update the values needed to calculate the render window.
         *
         * @private
         */
        _updateRenderWindow: function () {
            var parent = this.refs.parent,
                parentNode = React.findDOMNode(parent).parentNode,
                scrollTop = parentNode.scrollTop,
                previousScrollTop = this.state.scrollTop || 0,
                scrollChange = scrollTop - previousScrollTop,
                windowHeight = this.state.renderWindowHeight;

            // Ignore scroll events until the accumlated distance reaches a threshold.
            // This takes the place of throttling.
            if (Math.abs(scrollChange) < (windowHeight / 2)) {
                return;
            }

            var scrollDown = scrollChange > 0;
            this.setState({
                scrollTop: parentNode.scrollTop,
                scrollDown: scrollDown
            });

            // Once the updates have quiesced, re-initialize the render window
            // calculations in case any of the bounds have changed as a result
            // of something other than window resize.
            this._initRenderWindowDebounced();
        },

        /**
         * Update the render window, assuming no focus layer is defined. Also
         * workaround a CEF bug by clearing any active tooltips when scrolling.
         * More details here: https://github.com/adobe-photoshop/spaces-design/issues/444
         *
         * @private
         */
        _handleScroll: function () {
            this._setTooltipThrottled("");

            if (this._boundingClientRectCache) {
                this._boundingClientRectCache.clear();
            }

            if (!this._focusLayer) {
                window.requestAnimationFrame(this._updateRenderWindow);
            }
        },

        render: function () {
            var doc = this.props.document,
                dragTargets = this.state.dragTargets,
                dropTarget = this.state.dropTarget;

            if (this.state.futureReorder) {
                dragTargets = this.state.pastDragTargets;
            }

            // Only render layers that are not hidden by a collapsed ancestor
            var layersWithExpandedAncestors = doc.layers.allVisibleReversed
                .filter(function (layer) {
                    return !doc.layers.hasCollapsedAncestor(layer);
                });

            var windowHeight = this.state.renderWindowHeight,
                faceHeight = this.state.layerFaceHeight,
                layersInRenderWindow;

            // Calculate the exact or approximate number of layers faces that
            // fit in visible part of the panel.
            if (windowHeight && faceHeight) {
                layersInRenderWindow = Math.ceil(windowHeight / faceHeight);
            } else {
                layersInRenderWindow = INITIAL_RENDER_WINDOW_SIZE;
            }

            var topVisibleIndex,
                bottomVisibleIndex,
                focusIndex;
            
            if (this._focusLayer) {
                // If there is a focus layer, render a window of layers around that
                var halfWindow = Math.round(layersInRenderWindow / 2);

                focusIndex = layersWithExpandedAncestors.indexOf(this._focusLayer);
                topVisibleIndex = Math.max(0, focusIndex - halfWindow);
                bottomVisibleIndex = Math.min(layersWithExpandedAncestors.size - 1, focusIndex + halfWindow);
            } else if (windowHeight && faceHeight) {
                // Otherwise, assuming the render window values have been calculated,
                // render a window of layers around the current scroll position. This
                // is the most common case.
                topVisibleIndex = Math.floor(this.state.scrollTop / faceHeight);
                bottomVisibleIndex = Math.min(layersWithExpandedAncestors.size - 1,
                    topVisibleIndex + layersInRenderWindow);
            } else {
                // If all else fails, just render the beginning of the list.
                topVisibleIndex = 0;
                bottomVisibleIndex = Math.min(layersWithExpandedAncestors.size - 1,
                    layersInRenderWindow);
            }

            // Add padding layers to the top and the bottom of the list of layers
            // to render. Add additional padding in the direction of the scroll. 
            var scrollUp = this.state.scrollDown === false,
                scrollDown = this.state.scrollDown === true,
                topPadding = layersInRenderWindow * (scrollUp ? 2 : 1),
                bottomPadding = layersInRenderWindow * (scrollDown ? 2 : 1);

            // But, use a little less padding if we're rendering around a focus
            // layer because we're probably making a direct jump from far away,
            // and thus may have to render many new layers, which is expensive.
            if (focusIndex > 0) {
                topPadding = Math.round(topPadding / 2);
                bottomPadding = Math.round(bottomPadding / 2);
            }

            // Trim the list of potential layers to the render window
            var topRenderedIndex = Math.max(0, topVisibleIndex - topPadding),
                bottomRenderedIndex = Math.min(bottomVisibleIndex + bottomPadding, layersWithExpandedAncestors.size),
                renderedSize = bottomRenderedIndex - topRenderedIndex,
                layersHiddenAbove = topRenderedIndex,
                layersHiddenBelow = layersWithExpandedAncestors.size - bottomRenderedIndex,
                layerComponents = layersWithExpandedAncestors
                    .slice(topRenderedIndex, bottomRenderedIndex)
                    .map(function (layer, index) {
                        var isDropTarget = !!dropTarget && dropTarget.key === layer.key,
                            dropPosition = isDropTarget && this.state.dropPosition,
                            marginTop,
                            marginBottom;

                        // Add margins to the top and bottom layers in order to maintain
                        // a constant scroll height.
                        if (index === 0 && layersHiddenAbove > 0) {
                            marginTop = layersHiddenAbove * faceHeight;
                        } else if (index === (renderedSize - 1) && layersHiddenBelow > 0) {
                            marginBottom = layersHiddenBelow * faceHeight;
                        }

                        return (
                            <LayerFace
                                key={layer.key}
                                ref={layer.key}
                                disabled={this.props.disabled}
                                document={doc}
                                layer={layer}
                                keyObject={layer}
                                visibleLayerIndex={index}
                                dragPlaceholderClass="face__placeholder"
                                zone={doc.id}
                                isValid={this._validDropTarget}
                                onDragStart={this._handleStart}
                                onDragStop={this._handleStop}
                                onDrop={this._handleDrop}
                                getDragItems={this._getDraggingLayers}
                                isDropTarget={isDropTarget}
                                dropPosition={dropPosition}
                                marginTop={marginTop}
                                marginBottom={marginBottom} />
                        );
                    }, this);

            // Only render the bottom dummy layer if no other layers are hidden below.
            var bottomLayer = doc.layers.byIndex(1);
            if (bottomLayer.kind === bottomLayer.layerKinds.GROUPEND && layersHiddenBelow === 0) {
                var isBottomDropTarget = dropTarget && dropTarget.key === "dummy";
                
                layerComponents = layerComponents.push(
                    <DummyLayerFace
                        key="dummy"
                        document={doc}
                        zone={doc.id}
                        isValid={this._validDropTarget}
                        keyObject={{ key: "dummy" }}
                        onDrop={this._handleDrop}
                        isDropTarget={isBottomDropTarget} />
                );
            }

            var layerListClasses = classnames({
                "layer-list": true,
                "layer-list__dragging": !!dragTargets
            });

            var childComponents = (
                <ul ref="parent"
                    className={layerListClasses}>
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
                "section__collapsed": !this.props.visible
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
