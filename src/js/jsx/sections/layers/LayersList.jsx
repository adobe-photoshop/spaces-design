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
        _ = require("lodash");

    var DummyLayerFace = require("./DummyLayerFace"),
        LayerFace = require("./LayerFace");

    var LayersList = React.createClass({
        mixins: [FluxMixin],
        
        
        getDefaultProps: function () {
            return {
                depth: 0,
                isRoot: false
            };
        },
        
        getInitialState: function () {
            return {
                changedLayerPaths: []
            };
        },
        
        componentWillMount: function () {
            if (this.props.isRoot) {
                this.getFlux().stores.document.addLayerTreeListener(this.props.documentID, this._handleLayerTreeChange);
            }
        },
        
        componentWillUnmount: function () {
            if (this.props.isRoot) {
                this.getFlux().stores.document.removeLayerTreeListener(this.props.documentID);
            }
        },
        
        shouldComponentUpdate: function (nextProps, nextState) {
            return !_.isEqual(this.props.changedLayerPaths, nextProps.changedLayerPaths) ||
                !_.isEqual(this.state.changedLayerPaths, nextState.changedLayerPaths);
        },

        /**
         * Re-render layer list if its layer tree changed.
         * 
         * @type {Document~LayerTreeListener}
         */
        _handleLayerTreeChange: function (changedLayerPaths) {
            this.setState({
                changedLayerPaths: changedLayerPaths
            });
        },

        render: function () {
            var document = this.getFlux().stores.document.getDocument(this.props.documentID),
                layerNodes = this.props.isRoot ? document.layers.roots : this.props.layerNodes,
                layerFaces = layerNodes.reduce(function (results, layerNode) {
                    var layer = document.layers.byID(layerNode.id);

                    if (!layer.isGroupEnd) {
                        var changedLayerPaths = this.props.isRoot ?
                                this.state.changedLayerPaths : this.props.changedLayerPaths;

                        results.push(
                            <LayerFace
                                key={layer.key}
                                disabled={this.props.disabled}
                                depth={this.props.depth}
                                documentID={this.props.documentID}
                                layerID={layer.id}
                                layerNodes={layerNode.children}
                                changedLayerPaths={changedLayerPaths}/>
                        );
                    }
                    
                    return results;
                }.bind(this), []);

            if (this.props.isRoot) {
                var bottomLayer = document.layers.byIndex(1);

                if (bottomLayer.isGroupEnd) {
                    layerFaces.push(
                        <DummyLayerFace key="dummy" document={document}/>
                    );
                }
            }
            
            return (
                <ul className="layer-list">
                    {layerFaces}
                </ul>
            );
        }
    });

    module.exports = LayersList;
});
