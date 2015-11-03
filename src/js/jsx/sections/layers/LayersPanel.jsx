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

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        LayerFace = require("jsx!./LayerFace"),
        DummyLayerFace = require("jsx!./DummyLayerFace"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection"),
        synchronization = require("js/util/synchronization");

    /**
     * Get the layer depths that correspond to the current document's visible layers.
     * Used for invalidation
     *
     * @private
     * @param {object} props
     * @return {?Immutable.Iterable.<number>}
     */
    var _getDepths = function (props) {
        var document = props.document;
        if (!document) {
            return null;
        }

        var layers = document.layers.allVisible;
        return layers.map(document.layers.depth.bind(document.layers));
    };

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
        mixins: [FluxMixin],

        /**
         * A throttled version of os.setTooltip
         *
         * @private
         * @type {?function}
         */
        _setTooltipThrottled: null,

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
         * The list of layers last scrolled to. Used by _scrollToSelection
         * when determining whether to scroll.
         *
         * @private
         * @type {Immutable.List.<Layer>}
         */
        _lastScrolledTo: Immutable.List(),

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
            this._mountedLayerIDs = new Set();
        },

        componentDidMount: function () {
            this._scrollToSelection(this.props.document.layers);
        },

        componentDidUpdate: function () {
            this._scrollToSelection(this.props.document.layers);
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            if (this.props.disabled !== nextProps.disabled ||
                this.props.active !== nextProps.active) {
                return true;
            }

            if (this.props.visible !== nextProps.visible) {
                return true;
            }

            return this.props.active !== nextProps.active ||
                !Immutable.is(_getFaces(this.props), _getFaces(nextProps)) ||
                !Immutable.is(_getDepths(this.props), _getDepths(nextProps));
        },

        /**
         * Scrolls the layers panel to make (newly) selected layers visible.
         *
         * @param {LayerStructure} layerStructure
         */
        _scrollToSelection: function (layerStructure) {
            var selected = layerStructure.selected;
            if (selected.isEmpty()) {
                return;
            }

            var previous = this._lastScrolledTo,
                next = collection.difference(selected, previous),
                visible = next.filterNot(function (layer) {
                    return layerStructure.hasCollapsedAncestor(layer);
                });

            if (visible.isEmpty()) {
                return;
            }

            var focusLayer = visible.first(),
                childNode = React.findDOMNode(this.refs[focusLayer.key]);

            if (childNode) {
                childNode.scrollIntoViewIfNeeded();
                this._lastScrolledTo = next;
            }
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
            this.getFlux().actions.ui.disableTooltips();
        },

        /**
         * Nullify the boundingClientRect cache at the end of the drag.
         */
        _handleStop: function () {
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
         * Workaround a CEF bug by clearing any active tooltips when scrolling.
         * More details here: https://github.com/adobe-photoshop/spaces-design/issues/444
         *
         * @private
         */
        _handleScroll: function () {
            this._setTooltipThrottled("");
        },

        render: function () {
            var doc = this.props.document;

            var layerComponents = doc.layers.allVisibleReversed
                    .filter(function (layer) {
                        // Do not render descendants of collapsed layers unless
                        // they have been mounted previously
                        if (this._mountedLayerIDs.has(layer.id)) {
                            return true;
                        } else if (doc.layers.hasCollapsedAncestor(layer)) {
                            return false;
                        } else {
                            this._mountedLayerIDs.add(layer.id);
                            return true;
                        }
                    }, this)
                    .map(function (layer, visibleIndex) {
                        return (
                            <LayerFace
                                ref={layer.key}
                                key={layer.key}
                                disabled={this.props.disabled}
                                document={doc}
                                layer={layer}
                                keyObject={layer}
                                visibleLayerIndex={visibleIndex}
                                dragPlaceholderClass="face__placeholder"
                                onDragStart={this._handleStart}
                                onDragStop={this._handleStop}
                                getDragItems={this._getDraggingLayers}/>
                        );
                    }, this);

            var bottomLayer = doc.layers.byIndex(1);
            if (bottomLayer.kind === bottomLayer.layerKinds.GROUPEND) {
                layerComponents = layerComponents.push(<DummyLayerFace key="dummy" document={doc}/>);
            }

            // TODO: fix this
            var layerListClasses = classnames({
                "layer-list": true
            });

            var childComponents = (
                <ul ref="parent" className={layerListClasses}>
                    {layerComponents}
                </ul>
            );

            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "layers": true,
                "section": true,
                "section__active": this.props.active,
                "section__collapsed": !this.props.visible
            });

            return (
                <section
                    className={sectionClasses}
                    onScroll={this._handleScroll}>
                    <TitleHeader
                        title={nls.localize("strings.TITLE_PAGES")}
                        visible={this.props.visible}
                        disabled={this.props.disabled}
                        onDoubleClick={this.props.onVisibilityToggle}>
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
