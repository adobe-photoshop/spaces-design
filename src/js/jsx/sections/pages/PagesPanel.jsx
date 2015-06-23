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

    var PagesPanel = React.createClass({
        mixins: [FluxMixin],

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
            if (!this.props.document) {
                return;
            }

            this._scrollToSelection(this.props.document.layers.selected);
            this._bottomNodeBounds = 0;
            
            // For all layer refs, ask for their registration info and add to list
            var batchRegistrationInformation = this.props.document.layers.allVisible.map(function (i) {
                return this.refs[i.key].getRegistration();
            }, this),
                mappedBatchRegistrationInformation = new Immutable.OrderedMap(batchRegistrationInformation);

            this.getFlux().actions.draganddrop.batchRegisterDroppables(mappedBatchRegistrationInformation);
        },

        componentDidUpdate: function (prevProps) {
            if (this.props.document) {
                var nextSelected = this.props.document.layers.selected,
                    prevSelected = prevProps.document ? prevProps.document.layers.selected : Immutable.List(),
                    newSelection = collection.difference(nextSelected, prevSelected);

                this._scrollToSelection(newSelection);

                if (prevProps.document.id !== this.props.document.id) {
                    // For all layer refs, ask for their registration info and add to list
                    var batchRegistrationInformation = [];

                    this.props.document.layers.allVisible.forEach(function (i) {
                        batchRegistrationInformation.push(this.refs[i.key].getRegistration());
                    }.bind(this));

                    this.getFlux().actions.draganddrop.resetDroppables(batchRegistrationInformation);
                }

                if (!Immutable.is(this.props.document.layers.index, prevProps.document.layers.index)) {
                    var pastLayerKeys = collection.pluck(prevProps.document.layers.all, "key"),
                        currentLayerKeys = collection.pluck(this.props.document.layers.all, "key"),
                        removedLayerKeys = collection.difference(pastLayerKeys, currentLayerKeys);

                    if (removedLayerKeys.size > 0) {
                        this.getFlux().actions.draganddrop.batchDeregisterDroppables(removedLayerKeys);
                    }
                }
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

        /* Set initial state
         * State variables are:
         *  futureReorder {boolean} - Need this to prevent flash of dragged layer 
         *     back to original positiion
         *  batchRegister {boolean} - Should we register all dropppables at once 
         *     (and prevent individual droppables from registering)
         *  dropAbove {boolean} - Should the dragged layer drop above or below target
         *
         * @return {Object}
         */
        getInitialState: function () {
            return {
                futureReorder: false,
                batchRegister: true,
                dropAbove: false
            };
        },

        /**
         * Updates the lowest Node pointer to the current bottom of our list
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
         * Tests to make sure drop target is not a child of any of the dragged layers
         *
         * @param {Layer} target Layer that the mouse is overing on as potential drop target
         * @param {Immutable.List.<Layer>} draggedLayers Currently dragged layers
         * @param {Object} point Point where drop event occurred 
         * @param {Object} bounds Bounds of target drop area
         * @return {boolean} Whether the selection can be reordered to the given layer or not
         */
        _validDropTarget: function (target, draggedLayers, point, bounds) {
            var dropAbove = false;

            if (point && bounds) {
                if ((bounds.height / 2) < bounds.bottom - point.y) {
                    dropAbove = true;
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
                dropAbove: dropAbove
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
                layerComponents = doc.layers.allVisibleReversed
                    .map(function (layer, visibleIndex) {
                        var dragTarget = this.props.dragTarget,
                            dropTarget = this.props.dropTarget;

                        if (this.state.futureReorder) {
                            dragTarget = this.props.pastDragTarget;
                        }
                        var isDragTarget = !!(dragTarget && dragTarget.indexOf(layer) !== -1),
                            isDropTarget = !!(dropTarget && dropTarget.keyObject.key === layer.key);

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
                                    validateDrop={this._validDropTarget}
                                    onDragStop={this._handleStop}
                                    getDragItems={this._getDraggingLayers}
                                    dragTarget={isDragTarget}
                                    dragPosition={(isDropTarget || isDragTarget) &&
                                        this.props.dragPosition}
                                    dropTarget={isDropTarget}
                                    dropAbove={!!(isDropTarget && this.state.dropAbove)} />
                        );
                    }, this);

                var layerListClasses = classnames({
                    "layer-list": true,
                    "layer-list__dragging": this.props.dragTarget
                });

                childComponents = (
                    <ul ref="parent" className={layerListClasses}>
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
