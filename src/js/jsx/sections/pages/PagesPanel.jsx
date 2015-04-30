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
        _ = require("lodash");

    var os = require("adapter/os");

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        Layer = require("jsx!./Layer"),
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
            this._updateLowestNode();
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            if (this.props.disabled !== nextProps.disabled) {
                return true;
            }

            if (this.state.dragTarget || nextState.dragTarget) {
                return true;
            }

            if (!this.props.visible && !nextProps.visible) {
                return false;
            }

            if (this.props.visible !== nextProps.visible) {
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

            var parentNode = this.refs.parent.getDOMNode(),
                pageNodes = parentNode.querySelectorAll(".face");

            this._lowestNode = _.reduce(pageNodes, function (lowNode, curNode) {
                if (lowNode.getBoundingClientRect().bottom < curNode.getBoundingClientRect().bottom) {
                    return curNode;
                } else {
                    return lowNode;
                }
            }, pageNodes[0]);
        },
        /**
         * Scrolls to portion of layer panel containing the first element of the passed selection
         *
         * @param {Immutable.List.<Layer>} selected layers to attempt to scroll to
         */
        _scrollToSelection: function (selected) {
            if (selected.size > 0) {
                var focusLayer = selected.first(),
                    containerNode = this.refs.container.getDOMNode(),
                    childNode = containerNode.querySelector("[data-layer-id='" + focusLayer.id + "'");

                if (childNode) {
                    childNode.scrollIntoViewIfNeeded();
                }
            }
        },

        /**
         * Tests to make sure drop target is not a child of any of the dragged layers
         *
         * @param {Immutable.List.<Layer>} draggedLayers Currently dragged layers
         * @param {Layer} target Layer that the mouse is overing on as potential drop target
         * @param {boolean} dropAbove Whether we're currently dropping above or below the target
         * @return {boolean} Whether the selection can be reordered to the given layer or not
         */
        _validDropTarget: function (draggedLayers, target, dropAbove) {
            var doc = this.props.document,
                child;

            // Do not let drop below background
            if (target.isBackground && !dropAbove) {
                return false;
            }

            // Do not allow dropping artboards in artboards
            var draggedLayersHasArtboard = draggedLayers
                .some(function (layer) {
                    return layer.isArtboard;
                });
                
            if (draggedLayersHasArtboard &&
                !(dropAbove && target.isArtboard)) {
                var targetInsideArtboard = doc.layers.ancestors(target)
                    .some(function (layer) {
                        return layer.isArtboard;
                    });

                if (targetInsideArtboard) {
                    return false;
                }
            }

            // Do not let reorder exceed nesting limit
            var targetDepth = doc.layers.depth(target),
                nestLimitExceeded = draggedLayers.some(function (layer) {
                var layerDepth = doc.layers.depth(layer),
                    layerTreeDepth = doc.layers.maxDescendantDepth(layer) - layerDepth,
                    extraDepth = dropAbove ? 0 : 1;

                return layerTreeDepth + targetDepth + extraDepth > PS_MAX_NEST_DEPTH;
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
         * Set the target layer for the upcoming drag operation.
         * 
         * @param {React.Node} layer React component representing the layer
         */
        _handleStart: function (layer) {
            if (!this._validDragTarget(layer.props.layer)) {
                return;
            }

            this._bottomNodeBounds = (2 * this._lowestNode.getBoundingClientRect().bottom +
                this._lowestNode.getBoundingClientRect().top) / 3;

            this.setState({
                dragTarget: layer.props.layer
            });
        },

        /**
         * Custom drag handler function
         * Figures out which layer we're hovering on, marks it above/below
         * If it's a valid target, replaces the old target with the new
         * and updates the LayerTree component so it redraws the drop zone
         * 
         * @param {React.Node} layer React component representing the layer
         * @param {MouseEvent} event Native Mouse Event
         */
        _handleDrag: function (layer, event) {
            if (!this._validDragTarget(layer.props.layer)) {
                return;
            }

            var yPos = event.y,
                dragTargetEl = layer.getDOMNode(),
                parentNode = this.refs.parent.getDOMNode(),
                pageNodes = parentNode.querySelectorAll(".face"),
                targetPageNode = null,
                dropAbove = false,
                reallyBelow = false,
                draggingLayers = this._getDraggingLayers(layer.props.layer);

            _.some(pageNodes, function (pageNode) {
                if (pageNode === dragTargetEl) {
                    return;
                }

                var boundingRect = pageNode.getBoundingClientRect(),
                    boundingRectMid = (boundingRect.top + boundingRect.bottom) / 2;

                if (boundingRect.top <= yPos && yPos < boundingRect.bottom) {
                    targetPageNode = pageNode;
                    if (yPos > this._bottomNodeBounds && this._validDropTargetIndex(draggingLayers, 0)) {
                        reallyBelow = true;
                    }
                    if (yPos <= boundingRectMid) {
                        dropAbove = true;
                    } else {
                        dropAbove = false;
                    }
                    return true;
                }
            }, this);

            if (!targetPageNode) {
                if (yPos > this._bottomNodeBounds && this._validDropTargetIndex(draggingLayers, 0)) {
                    this.setState({
                        dropTarget: this._lowestNode,
                        reallyBelow: true});
                }
                return;
            }

            var doc = this.props.document,
                dropLayerID = math.parseNumber(targetPageNode.getAttribute("data-layer-id")),
                dropTarget = doc.layers.byID(dropLayerID);

            if (!this._validDropTarget(draggingLayers, dropTarget, dropAbove)) {
                // If invalid target, don't highlight the last valid target we had
                dropTarget = null;
            }
            
            if (dropTarget !== this.state.dropTarget) {
                this.setState({
                    dropTarget: dropTarget,
                    dropAbove: dropAbove,
                    reallyBelow: reallyBelow
                });
            } else if (dropAbove !== this.state.dropAbove) {
                this.setState({
                    dropAbove: dropAbove,
                    reallyBelow: reallyBelow
                });
            }
        },

        /**
         * Custom drag finish handler. Calculates the drop index through the target,
         * removes drop target properties, and calls the reorder action.
         *
         * @param {React.Node} layer React component representing the layer
         */
        _handleStop: function (layer) {
            if (this.state.dropTarget) {
                var flux = this.getFlux(),
                    doc = this.props.document,
                    dragLayer = layer.props.layer,
                    dragSource = [dragLayer.id],
                    dropIndex = doc.layers.indexOf(this.state.dropTarget) -
                        (this.state.dropAbove ? 0 : 1);
                if (this.state.reallyBelow) {
                    dropIndex = 0;
                }

                dragSource = collection.pluck(this._getDraggingLayers(dragLayer), "id");
                    
                flux.actions.layers.reorder(doc.id, dragSource, dropIndex)
                    .bind(this)
                    .finally(function () {
                        this.setState({
                            dragTarget: null,
                            dropTarget: null,
                            dropAbove: null,
                            reallyBelow: null
                        });
                    });
            } else {
                this.setState({
                    dragTarget: null,
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
                        return (
                            <li key={layer.key}>
                                <Layer
                                    disabled={this.props.disabled}
                                    document={doc}
                                    layer={layer}
                                    axis="y"
                                    dragTargetClass="face__target"
                                    dragPlaceholderClass="face__placeholder"
                                    onDragStart={this._handleStart}
                                    onDragMove={this._handleDrag}
                                    onDragStop={this._handleStop}
                                    dragTarget={this.state.dragTarget}
                                    dropTarget={this.state.dropTarget}
                                    dropAbove={this.state.dropAbove}
                                    reallyBelow={this.state.reallyBelow}/>
                            </li>
                        );
                    }, this)
                    .toArray();

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

            var containerClasses = React.addons.classSet({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = React.addons.classSet({
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
