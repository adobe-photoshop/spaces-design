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
        classnames = require("classnames");

    var DummyLayerFace = require("./DummyLayerFace"),
        LayerFace = require("./LayerFace");

    var LayersGroup = React.createClass({
        mixins: [FluxMixin],

        getDefaultProps: function () {
            return {
                depth: 0,
                isRoot: false
            };
        },

        render: function () {
            var layerFaces = this.props.layerNodes.reduce(function (results, layerNode) {
                var layer = this.props.document.layers.byID(layerNode.id);
                
                if (!layer.isGroupEnd) {
                    var layersGroup = layerNode.children && (
                        <LayersGroup
                            disabled={this.props.disabled}
                            document={this.props.document}
                            layerNodes={layerNode.children}
                            depth={this.props.depth + 1}/>
                    );

                    var className = classnames({
                        "layer-group": layersGroup,
                        "layer-group__selected": layersGroup && layer.selected,
                        "layer-group__collapsed": layersGroup && !layer.expanded,
                        "layer-group__not-visible": layersGroup && !layer.visible
                    });

                    results.push(
                        <li key={layer.key} className={className}>
                            <LayerFace
                                key={layer.key}
                                disabled={this.props.disabled}
                                document={this.props.document}
                                depth={this.props.depth}
                                layer={layer}
                                childNodes={layerNode.children}/>
                            {layersGroup}
                        </li>
                    );
                }
                
                return results;
            }.bind(this), []);

            if (this.props.isRoot) {
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
                <ul className="layers-group">
                    {layerFaces}
                </ul>
            );
        }
    });

    module.exports = LayersGroup;
});
