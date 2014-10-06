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
        ClassSet = React.addons.classSet,
        FluxChildMixin = Fluxxor.FluxChildMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Draggable = require("js/jsx/mixin/Draggable"),
        log = require("js/util/log"),
        _ = require("lodash");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        TextField = require("jsx!js/jsx/shared/TextField");
    
    var Layer = React.createClass({
        mixins: [FluxChildMixin, StoreWatchMixin("layer"), Draggable],

        getStateFromFlux: function () {
            return {};
        },

        componentWillUpdate: function () {
            if (this.refs.children) {
                this.refs.children.setState({
                    highlightLayer: this.props.dropTarget
                });
            }
        },

        handleLayerNameChange: function () {},
        
        /**
         * Grabs the correct modifier by processing event modifier keys
         * and calls the select action with correct modifier.
         * 
         * @private
         * @param {Object} event React event
         */
        _handleLayerClick: function (event) {
            var modifier = "select";
            if (event.shiftKey) {
                modifier = "addUpTo";
            } else if (event.metaKey) {
                var selected = this.props.layer.selected;

                if (selected) {
                    modifier = "deselect";
                } else {
                    modifier = "add";
                }
            }
            this.getFlux().actions.layers.select(this.props.document.id, this.props.layer.id, modifier);
        },

        /**
         * Changes the visibility of the layer
         * 
         * @private
         * @param {boolean} toggled Flag for the ToggleButton, false means visible
         */
        _handleVisibilityToggle: function (toggled) {
            // Invisible if toggled, visible if not
            this.getFlux().actions.layers.setVisibility(this.props.document.id, this.props.layer.id, !toggled);
        },

        /**
         * Changes the locking of the layer
         * 
         * @private
         * @param {boolean} toggled Flag for the ToggleButton, true means locked
         */
        _handleLockToggle: function (toggled) {
            // Locked if toggled, visible if not
            this.getFlux().actions.layers.setLocking(this.props.document.id, this.props.layer.id, toggled);
        },

        render: function () {
            var doc = this.props.document,
                layer = this.props.layer;

            if (layer.kind === layer.layerKinds.GROUPEND) {
                return (
                    <li className="HiddenPage" key={this.props.key}/>
                );
            }

            var depthSpacing = _.range(layer.depth).map(function (index) {
                return (
                    <div data-leash className="c-half-25" key={index}/>
                );
            });

            var style = {},
                dropStyle = "3px inset green";

            if (layer === this.props.dropTarget) {
                if (layer.dropAbove) {
                    style["border-top"] = dropStyle;
                } else {
                    style["border-bottom"] = dropStyle;
                }
            }

            var dragTargetAbove = (layer === this.props.dropTarget && layer.dropAbove),
                dragTargetBelow = (layer === this.props.dropTarget && !layer.dropAbove),
                pageClassName = ClassSet({
                    "Page": true,
                    "Page_dragTargetAbove": dragTargetAbove,
                    "Page_dragTargetBelow": dragTargetBelow
                });

            pageClassName += " " + this.state.dragClass;
  

            return (
                <li key={this.props.key}
                    className={pageClassName}
                    data-selected={layer.selected}
                    data-layer-id={layer.id}>
                    <div 
                            style={_.merge(style, this.props.style)} 
                            onClick={this._handleLayerClick}
                            onMouseDown={this._handleDragStart}>
                            <Gutter/>
                            <ToggleButton
                                size="c-2-25"
                                buttonType="layer-visibility"
                                selected={!layer.visible}
                                onClick={this._handleVisibilityToggle}>
                            </ToggleButton>
                            <Gutter/>
                            {depthSpacing}
                            <TextField
                                className="layer_name"
                                ref="layer_name"
                                type="text"
                                value={layer.name}
                                onChange={this.handleLayerNameChange}>
                            </TextField>
                            <ToggleButton
                                size="c-2-25"
                                buttonType="layer-lock"
                                selected={layer.locked}
                                onClick={this._handleLockToggle}>
                            </ToggleButton>
                        </div>

                    <LayerTree
                        ref="children"
                        document={doc}
                        layers={layer.children}
                        dropTarget={this.props.dropTarget}
                        onDragStart={this.props.onDragStart}
                        onDragMove={this.props.onDragMove}
                        onDragStop={this.props.onDragStop}/>
                </li>
            );
        }
    });
       
    var LayerTree = React.createClass({
        render: function () {
            var doc = this.props.document;

            if (!doc) {
                return null;
            }

            // Set the draggable options here on this dynamic declaration
            var layers = this.props.layers || doc.layerTree.topLayers,
                children = layers.map(function (layer, index) {
                    return (
                        <Layer key={index} 
                            ref={"Layer"+layer.id.toString()}
                            document={doc}
                            layer={layer}
                            axis="y"
                            dragTarget="Page_target"
                            dragPlaceholder="Page_placeholder"
                            dropTarget={this.props.dropTarget}
                            onDragStart={this.props.onDragStart}
                            onDragMove={this.props.onDragMove}
                            onDragStop={this.props.onDragStop}/>
                    );
                }, this);

            return (
                <ul>
                    {children}
                </ul>
            );
        }
    });

    module.exports = LayerTree;
});
