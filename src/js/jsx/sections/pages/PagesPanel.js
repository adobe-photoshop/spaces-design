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
        Immutable = require("immutable"),
        classnames = require("classnames");

    var os = require("adapter").os;

    var TitleHeader = require("../../../jsx/shared/TitleHeader"),
        Layer = require("./Layer"),
        math = require("../../../util/math"),
        strings = require("i18n!nls/strings"),
        collection = require("../../../util/collection"),
        synchronization = require("../../../util/synchronization");

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

        var layers = document.layers.all;
        return collection.pluck(layers, "face");
    };

    var PagesPanel = React.createClass({
        mixins: [FluxMixin],

        /**
         * A throttled version of os.setTooltip
         *
         * @type {?function}
         */
        _setTooltipThrottled: null,

        /**
         * A pointer to the lowest item in our list
         *
         * @type {DOMNode} 
         */
        _lowestNode: null,

        /**
         * a store for the bottom of a bounds at the beginning of each drag
         *
         * @type {Number}
         */
        _bottomNodeBounds: null,

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
        },

        componentDidMount: function () {
            if (!this.props.document) {
                return;
            }

            this._scrollToSelection(this.props.document.layers.selected);
            this._updateLowestNode();
            this._bottomNodeBounds = 0;
        },

        componentDidUpdate: function (prevProps) {
            var _getSelected = function (props) {
                if (!props.document) {
                    return Immutable.List();
                }
                return props.document.layers.selected;
            };

            var prevSelected = _getSelected(prevProps),
                nextSelected = _getSelected(this.props),
                newSelection = collection.difference(nextSelected, prevSelected);

            this._scrollToSelection(newSelection);
            if (!newSelection.isEmpty()) {
                this._updateLowestNode();
            }
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            if (this.props.disabled !== nextProps.disabled) {
                return true;
            }

            if (this.props.dragTarget || nextProps.dragTarget) {
                return true;
            }

            if (this.props.dropTarget || nextProps.dropTarget) {
                return true;
            }

            if (!this.props.visible && !nextProps.visible) {
                return false;
            }

            if (this.props.visible !== nextProps.visible) {
                return true;
            }

            if (this.state.futureReorder !== nextState.futureReorder) {
                return true;
            }

            return !Immutable.is(_getFaces(this.props), _getFaces(nextProps));
        },

        getInitialState: function () {
            return {};
        },

        /**
         * Updates the lowest Node pointer to the current bottom of our list
         */
        _updateLowestNode: function () {
            if (!this.refs.parent) {
                return;
            }

            var parentNode = React.findDOMNode(this.refs.parent),
                pageNodes = parentNode.querySelectorAll(".face"),
                pageNodeCount = pageNodes.length;

            this._lowestNode = pageNodeCount > 0 ? pageNodes[pageNodeCount - 1] : null;
        },
        /**
         * Scrolls to portion of layer panel containing the first element of the passed selection
         *
         * @param {Immutable.List.<Layer>} selected layers to attempt to scroll to
         */
        _scrollToSelection: function (selected) {
            if (selected.size > 0) {
                var focusLayer = selected.first(),
                    containerNode = React.findDOMNode(this.refs.container),
                    childNode = containerNode.querySelector("[data-layer-id='" + focusLayer.id + "'");

                if (childNode) {
                    childNode.scrollIntoViewIfNeeded();
                }
            }
        },

        /**
         * Tests to make sure drop target is not a child of any of the dragged layers
         *
         * @param {Layer} target Layer that the mouse is overing on as potential drop target
         * @param {Immutable.List.<Layer>} draggedLayers Currently dragged layers
         * @param {Object} point Point where drop event occurred 
         * @param {Object} bounds Bounds of target drop area
         * @return {boolean} Whether the selection can be reordered to the given layer or not
         */
        _validDropTarget: function (target, draggedLayers, point, bounds) {
            var dropAbove = true;
            if (point && bounds) {
                if ((bounds.height / 2) > bounds.bottom - point.y) {
                    dropAbove = false;
                }
            }

            var doc = this.props.document,
                child;

            // Do not let drop below background
            if (target.isBackground && !dropAbove) {
                return false;
            }

            // Do not let reorder exceed nesting limit
            // When we drag artboards, this limit is 1
            // because we can't nest artboards in any layers
            var targetDepth = doc.layers.depth(target),
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

            this.setState({
                dropAbove: dropAbove,
                dropBounds: bounds
            });

            return true;
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
                layerID = math.parseNumber(this._lowestNode.getAttribute("data-layer-id")),
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
         * @param {Layer} dragLayer Layer the user is dragging
         * @return {Immutable.List.<Layer>}
         */
        _getDraggingLayers: function (dragLayer) {
            var doc = this.props.document;

            if (dragLayer.selected) {
                return doc.layers.selected.filter(function (layer) {
                    return this._validDragTarget(layer);
                }, this);
            } else {
                return Immutable.List.of(dragLayer);
            }
        },

        /**
         * Custom drag finish handler. Calculates the drop index through the target,
         * removes drop target properties, and calls the reorder action.
         *
         */
        _handleStop: function () {
            if (this.props.dragTarget) {
                var flux = this.getFlux(),
                    doc = this.props.document,
                    above = this.state.dropAbove,
                    dropIndex = doc.layers.indexOf(this.props.dropTarget.keyObject) - (above ? 0 : 1);
                if (this.state.reallyBelow) {
                    dropIndex = 0;
                }

                this.setState({
                    futureReorder: true
                });

                var dragSource = collection.pluck(this.props.dragTarget, "id");

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
        },

        render: function () {
            var doc = this.props.document,
                layerCount,
                layerComponents,
                childComponents;

            if (!doc || !this.props.visible) {
                layerCount = null;
                childComponents = null;
            } else {
                layerComponents = doc.layers.top
                    .map(function (layer) {
                        // If the layer or its descendants is not the dropTarget, pass false here
                        // I am attempting to not have so many extra renders of the Layers...but this may be slower
                        // Otherwise, pass down the layer

                        var dragTarget = this.props.dragTarget;

                        var shouldPassDropTarget = !!(layer &&
                                this.props.dropTarget &&
                                doc.layers.descendants(layer).indexOf(this.props.dropTarget.keyObject) !== -1),
                            shouldPassDragTarget = false;

                        if (dragTarget) {
                            // Should be false if the layer and the layers children do not appear in this list
                            shouldPassDragTarget = dragTarget.some(function (dragT) {
                                return layer && doc.layers.descendants(layer).indexOf(dragT) !== -1;
                            });
                        } else if (this.state.futureReorder) {
                            dragTarget = this.props.pastDragTarget;
                            shouldPassDragTarget = dragTarget.some(function (dragT) {
                                return layer && doc.layers.descendants(layer).indexOf(dragT) !== -1;
                            });
                        }

                        return (
                            <li key={layer.key}>
                                <Layer
                                    disabled={this.props.disabled}
                                    document={doc}
                                    layer={layer}
                                    axis="y"
                                    layerIndex={doc.layers.indexOf(layer)}
                                    dragPlaceholderClass="face__placeholder"
                                    validateDrop={this._validDropTarget}
                                    onDragStop={this._handleStop}
                                    getDragItems={this._getDraggingLayers}
                                    dragTarget={shouldPassDragTarget && dragTarget}
                                    dragPosition={(shouldPassDropTarget || shouldPassDragTarget) &&
                                        this.props.dragPosition}
                                    dropTarget={shouldPassDropTarget && this.props.dropTarget}
                                    dropAbove={shouldPassDropTarget && this.props.dropAbove} />
                            </li>
                        );
                    }, this);

                childComponents = (
                    <ul ref="parent" className="layer-list">
                        {layerComponents}
                    </ul>
                );

                layerCount = (
                    <div
                        title={strings.TOOLTIPS.LAYER_COUNT}
                        className="layer-count">
                        {doc.layers.selected.size}<span className="text-fancy"> oƒ </span>{doc.layers.count}
                    </div>
                );
            }

            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "pages": true,
                "section": true,
                "section__sibling-collapsed": !this.props.visibleSibling
            });

            return (
                <section
                    className={sectionClasses}
                    ref="pagesSection"
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

    module.exports = PagesPanel;
});
