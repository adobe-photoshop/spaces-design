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
         * True if the LayerGroup's components are rendered. Used to avoid
         * rendering layer group until it is first visible.
         * 
         * @type {Boolean}
         */
        isRendered: false,

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
             * @type {Boolean}
             */
            disabled: React.PropTypes.bool
        },
        
        shouldComponentUpdate: function () {
            // TODO Currently we always render the entire LayerGroup tree and let the LayerFace components
            // to run their own shouldComponentUpdate validation. In the future, we may consider 
            // consolidating the validations in one place (e.g. in the LayerPanel or the root LayerGroup),
            // which allows us to skip rendering a subtree if its children remain unchanged.
            return true;
        },

        render: function () {
            var parentLayer = this.props.parentLayer,
                isRoot = !parentLayer;

            // Do not render layer group of collapsed layer to reduce document load time.
            if (!isRoot && !parentLayer.expanded && !this.isRendered) {
                return false;
            } else {
                this.isRendered = true;
            }

            var layerFaces = this.props.layerNodes.reduce(function (results, layerNode) {
                var layer = this.props.document.layers.byID(layerNode.id);

                if (!layer.isGroupEnd) {
                    var layerGroup = layerNode.children && (
                        <LayerGroup
                            parentLayer={layer}
                            layerNodes={layerNode.children}
                            document={this.props.document}
                            disabled={this.props.disabled}/>
                    );

                    var className = classnames({
                        "layer-group": layerGroup
                    });

                    results.push(
                        <li key={layer.key} className={className}>
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
