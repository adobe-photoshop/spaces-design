/*
 * Copyright (c) 2016 Adobe Systems Incorporated. All rights reserved.
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
        Immutable = require("immutable");

    var Layer = require("js/models/layer"),
        Document = require("js/models/document");

    var DummyLayerFace = require("./DummyLayerFace"),
        LayerFace = require("./LayerFace");

    var LayerGroup = React.createClass({
        mixins: [FluxMixin],

        /**
         * This is used by the root LayerGroup to control whether or not its child LayerGroups 
         * should render their collapsed layers. At initial rendering, `_renderCollapsedLayers` 
         * is set to false to prevent child LayerGroups from rendering collapsed layers, which
         * will reduce the initial load time. After the root LayerGroup is mounted , it will 
         * set `_renderCollapsedLayers` to true, and force update its child LayerGroups to 
         * render the collapsed layers for faster future expand actions (in `componentDidMount`).
         * 
         * @type {boolean}
         */
        _renderCollapsedLayers: false,
        
        /**
         * @type {number}
         */
        _forceUpdateTimerID: null,
        
        /**
         * Used to determine whether to scroll to selected layer. When a selected layer has a new index,
         * it may become invisible if the new index is outside of the visible area. If so, we need to
         * scroll the layer into the visible area. Operations that will change layer index:
         * - drag-and-drop layer
         * - menu items (e.g. Bring Forward `cmd+]`)
         * - undo/redo layer ordering
         *
         * @type {boolean}
         */
        _selectedLayerHasNewIndex: false,

        propTypes: {
            /**
             * List of Layer nodes in the same layer group.
             * @type {Immutable.Iterable.<LayerNode>}
             */
            layerNodes: React.PropTypes.instanceOf(Immutable.Iterable).isRequired,

            /**
             * The parent layer of the layer nodes.
             * @type {Layer}
             */
            parentLayer: React.PropTypes.instanceOf(Layer),

            /**
             * @type {Document}
             */
            document: React.PropTypes.instanceOf(Document).isRequired,

            /**
             * @type {boolean}
             */
            disabled: React.PropTypes.bool,

            /**
             * True if the LayerGroup should render collapsed layers. This is controlled by the 
             * root LayerGroup.
             * 
             * @type {boolean}
             */
            renderCollapsedLayers: React.PropTypes.bool
        },
        
        componentDidMount: function () {
            if (!this.props.parentLayer) {
                // Wait for 2 seconds when the root LayerPanel is mounted, then force update to 
                // render the collapsed layers.
                this._renderCollapsedLayers = true;
                this._forceUpdateTimerID = window.setTimeout(function () {
                    this.forceUpdate();
                }.bind(this), 2000);
            }

            this._scrollIntoFirstSelectedLayer();
        },

        componentWillUnmount: function () {
            if (this._forceUpdateTimerID) {
                window.clearTimeout(this._forceUpdateTimerID);
            }
        },

        componentWillReceiveProps: function (nextProps) {
            this._selectedLayerHasNewIndex = nextProps.layerNodes.some(function (layerNode) {
                var layer = nextProps.document.layers.byID(layerNode.id);

                if (layer.selected) {
                    var index = this.props.document.layers.indexOf(layer),
                        nextIndex = nextProps.document.layers.indexOf(layer);
                    
                    if (index !== nextIndex) {
                        return true;
                    }
                }
                
                return false;
            }, this);
        },
        
        shouldComponentUpdate: function () {
            // TODO Currently we always render the entire LayerGroup tree and let the LayerFace components
            // to run their own shouldComponentUpdate validation. In the future, we may consider 
            // consolidating the validations in one place (e.g. in the LayerPanel or the root LayerGroup),
            // which allows us to skip rendering a subtree if its children remain unchanged.
            return true;
        },
        
        componentDidUpdate: function () {
            if (this._selectedLayerHasNewIndex) {
                this._selectedLayerHasNewIndex = false;
                this._scrollIntoFirstSelectedLayer();
            }
        },

        /**
         * Scroll into the first selected layer if it is not within the visible area.
         */
        _scrollIntoFirstSelectedLayer: function () {
            var firstSelectedLayer = this.props.document.layers.selected.first(),
                layerNode = firstSelectedLayer ? ReactDOM.findDOMNode(this.refs[firstSelectedLayer.key]) : null;
            
            if (layerNode) {
                layerNode.scrollIntoViewIfNeeded();
            }
        },

        render: function () {
            var parentLayer = this.props.parentLayer,
                isRoot = !parentLayer,
                renderCollapsedLayers = isRoot ? this._renderCollapsedLayers : this.props.renderCollapsedLayers;

            // Do not render layer group of collapsed layer to reduce document load time.
            // when the root LayerGroup is mounted, it will 
            if (!isRoot && !parentLayer.expanded && !renderCollapsedLayers) {
                return false;
            }

            var layerFaces = this.props.layerNodes.reduce(function (results, layerNode) {
                var layer = this.props.document.layers.byID(layerNode.id);

                if (!layer.isGroupEnd) {
                    var layerGroup = layerNode.children && (
                        <LayerGroup
                            parentLayer={layer}
                            layerNodes={layerNode.children}
                            document={this.props.document}
                            disabled={this.props.disabled}
                            renderCollapsedLayers={renderCollapsedLayers}/>
                    );

                    var className = classnames({
                        "layer-group": layerGroup
                    });

                    results.push(
                        <li key={layer.key} className={className} ref={layer.key}>
                            <LayerFace
                                key={layer.key}
                                disabled={this.props.disabled}
                                document={this.props.document}
                                layer={layer}
                                hasChildren={!!layerNode.children}/>
                            {layerGroup}
                        </li>
                    );
                }
                
                return results;
            }, [], this);

            if (isRoot) {
                var bottomLayer = this.props.document.layers.byIndex(1);
                
                if (bottomLayer.isGroupEnd) {
                    layerFaces.push(
                        <li key="dummy">
                            <DummyLayerFace key="dummy" document={this.props.document}/>
                        </li>
                    );
                }
            }
            
            return (
                <ul className="layer-group">
                    {layerFaces}
                </ul>
            );
        }
    });

    module.exports = LayerGroup;
});
