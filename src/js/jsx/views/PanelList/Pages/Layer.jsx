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
        FluxChildMixin = Fluxxor.FluxChildMixin(React);

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        TextField = require("jsx!js/jsx/shared/TextField");
    
    var Layer = React.createClass({
        mixins: [FluxChildMixin],
        render: function () {
            var layerObject = this.props.layerData;
            var layerKinds = this.getFlux().store("layer").layerKinds;

            if (layerObject.layerKind === layerKinds.GROUPEND) {
                return (
                    <li className="HiddenPage" />
                );
            }

            var childLayers = this.props.layerData.children.map(function (layer, itemIndex) {
                return (
                    <Layer layerData={layer} key={itemIndex} />
                );
            });

            var depthSpacing = [];
            for (var i = 0; i < layerObject.depth; i++) {
                depthSpacing.push( 
                    <div data-leash className="c-half-25" />
                );
            }

            return (
                <li className="Page"
                    key={this.props.key}>
                    <div>
                        <Gutter/>
                        <ToggleButton
                            size="c-2-25"
                            buttonType="layer-visibility"
                            selected={!layerObject.visible}
                            onClick={this.handleVisibilityToggle}
                        />
                        <Gutter/>
                        {depthSpacing}
                        <TextField
                            className="layer_name"
                            ref="layer_name"
                            type="text"
                            value={layerObject.name}
                        />
                        <ToggleButton
                            size="c-2-25"
                            buttonType="layer-lock"
                            selected={layerObject.layerLocking.value.protectAll}
                            onClick={this.handleLockToggle}
                        />
                    </div>
                    <ul>
                        {childLayers}
                    </ul>
                </li>
            );
        }
    });
    module.exports = Layer;
});
