/** @jsx React.DOM */
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
        FluxChildMixin = Fluxxor.FluxChildMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;
    
    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        Layer = require("jsx!js/jsx/views/PanelList/Pages/Layer"),
        strings = require("i18n!nls/strings"),
        log = require("js/util/log");

    var PagesPanel = React.createClass({
        mixins: [FluxChildMixin, StoreWatchMixin("layer", "document", "application")],
        
        getInitialState: function () {
            return {};
        },

        getStateFromFlux: function () {
            var applicationStore = this.getFlux().store("application"),
                currentDocument = applicationStore.getCurrentDocument();

            return {
                currentDocument: currentDocument
            };
        },

        /**
         * Tests to make sure drop target is not a child of any of the dragged layers
         * @param {Array.<Layer>} Currently dragged layers
         * @param {Layer} Layer that the mouse is overing on as potential drop target
         * @param {boolean} dropAbove Whether we're currently dropping above or below the target
         *
         * @return {boolean} Whether the selection can be reordered to the given layer or not
         */
        _validDropTarget: function (layers, target, dropAbove) {
            var children = layers,
                child;

            // Do not let drop below background
            if (target.isBackground && !dropAbove) {
                return false;
            }

            while (children.length > 0) {
                child = children.shift();
                if (target === child) {
                    return false;
                }

                // For the special case of dragging a group under itself.
                if (child.index - target.index === 1) {
                    return false;
                }

                children = children.concat(child.children);
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
         */
        _getDraggingLayers: function (dragLayer) {
            var flux = this.getFlux(),
                doc = this.state.currentDocument,
                layers = doc.layerTree.layerArray;
                
            if (dragLayer.selected) {
                return layers
                    .filter(function (layer) {
                        return layer.selected && this._validDragTarget(layer);
                    }, this);
            } else {
                return [dragLayer];
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

            var layerTree = this.state.currentDocument.layerTree,
                dropLayerID = targetPageNode.getAttribute("data-layer-id"),
                dropTarget = layerTree.layerSet[dropLayerID],
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
         * Custom drag finish handler
         * Calculates the drop index through the target,
         * removes drop target properties, 
         * and calls the reorder action
         * @param {React.Node} layer React component representing the layer
         * @param {MouseEvent} event Native Mouse Event 
         */
        _handleStop: function (layer, event) {
            if (this.state.dropTarget) {
                
                var flux = this.getFlux(),
                    doc = this.state.currentDocument,
                    dragLayer = layer.props.layer,
                    layers = doc.layerTree.layerArray,
                    dragSource = [dragLayer.id],
                    dropIndex = -1;

                layers.some(function (layer, index) {
                    if (layer === this.state.dropTarget) {
                        if (this.state.dropAbove) {
                            dropIndex = index;
                        } else {
                            dropIndex = index - 1;
                        }
                        return true;
                    }
                }, this);

                dragSource = _.pluck(this._getDraggingLayers(dragLayer), "id");
                    
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

        render: function () {
            var doc = this.state.currentDocument,
                layerComponents,
                childComponents;

            if (!doc) {
                childComponents = null;
            } else {
                layerComponents = doc.layerTree.topLayers.map(function (layer, index) {
                    return (
                        <li key={index}>
                            <Layer
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
                }, this);

                childComponents = (
                    <ul ref="parent">
                        {layerComponents}
                    </ul>
                );
            }

            return (
                <section id="pagesSection" className="pages" ref="pagesSection">
                    <TitleHeader title={strings.TITLE_PAGES}>
                        <span>1 of 3</span>
                    </TitleHeader>
                    <div className="section-background">
                        {childComponents}
                    </div>
                </section>
            );
        }
    });

    module.exports = PagesPanel;
});
