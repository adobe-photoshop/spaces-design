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
         * A debounced version of os.setTooltip
         *
         * @type {?function}
         */
        _setTooltipDebounced: null,

        componentWillMount: function() {
            this._setTooltipDebounced = synchronization.debounce(os.setTooltip, os, 500);
        },

        componentDidMount: function() {
            if (!this.props.document) {
                return;
            }

            this._scrollToSelection(this.props.document.layers.selected);
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
        },

        shouldComponentUpdate: function (nextProps, nextState) {
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
         * Scrolls to portion of layer panel containing the first element of the passed selection
         *
         * @param {Immutable.List.<Layer>} selected layers to attempt to scroll to
         */
        _scrollToSelection: function(selected) {
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
            if (!dropAbove){
                var draggedLayersHasArtboard = draggedLayers
                    .some(function (layer){
                        return layer.isArtboard;
                    });
                if (draggedLayersHasArtboard) {
                    var targetInsideArtboard = doc.layers.ancestors(target)
                        .some(function (layer){
                            return layer.isArtboard;
                        });

                    if (targetInsideArtboard) {
                        return false;
                    }
                }
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
         * Tests to make sure layer we're trying to drag is draggable
         * For now, we only check for background layer, but we might prevent locked layers dragging later
         *
         * @param {Layer} layers Layer being tested for drag
         * @return {boolean} True if layer can be dragged
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
                dropAbove = false;

            _.some(pageNodes, function (pageNode) {
                if (pageNode === dragTargetEl) {
                    return;
                }

                var boundingRect = pageNode.getBoundingClientRect(),
                    boundingRectMid = (boundingRect.top + boundingRect.bottom) / 2;

                if (boundingRect.top <= yPos && yPos < boundingRect.bottom) {
                    targetPageNode = pageNode;
                    if (yPos <= boundingRectMid) {
                        dropAbove = true;
                    } else {
                        dropAbove = false;
                    }
                    return true;
                }
            });

            if (!targetPageNode) {
                return;
            }

            var doc = this.props.document,
                dropLayerID = math.parseNumber(targetPageNode.getAttribute("data-layer-id")),
                dropTarget = doc.layers.byID(dropLayerID),
                draggingLayers = this._getDraggingLayers(layer.props.layer);

            if (!this._validDropTarget(draggingLayers, dropTarget, dropAbove)) {
                // If invalid target, don't highlight the last valid target we had
                dropTarget = null;
            }
            
            if (dropTarget !== this.state.dropTarget) {
                this.setState({
                    dropTarget: dropTarget,
                    dropAbove: dropAbove
                });
            } else if (dropAbove !== this.state.dropAbove) {
                this.setState({
                    dropAbove: dropAbove
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

                dragSource = collection.pluck(this._getDraggingLayers(dragLayer), "id");
                    
                flux.actions.layers.reorder(doc.id, dragSource, dropIndex)
                    .bind(this)
                    .finally(function () {
                        this.setState({
                            dragTarget: null,
                            dropTarget: null,
                            dropAbove: null
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
            this._setTooltipDebounced("");
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
                                    depth={0}
                                    dragTargetClass="face__target"
                                    dragPlaceholderClass="face__placeholder"
                                    onDragStart={this._handleStart}                                
                                    onDragMove={this._handleDrag}
                                    onDragStop={this._handleStop}
                                    dragTarget={this.state.dragTarget}
                                    dropTarget={this.state.dropTarget}
                                    dropAbove={this.state.dropAbove}/>
                            </li>
                        );
                    }, this)
                    .toArray();

                childComponents = (
                    <ul ref="parent" className="layer-list">
                        {layerComponents}
                    </ul>
                );

                var allLayers = doc.layers.all.filter(function (layer) {
                    return layer.kind !== layer.layerKinds.GROUPEND;
                });

                layerCount = (
                    <div 
                        title={strings.TOOLTIPS.LAYER_COUNT}
                        className="layer-count">
                        {doc.layers.selected.size}<span className="text-fancy"> oƒ </span>{allLayers.size}
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
