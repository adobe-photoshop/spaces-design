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
        StoreWatchMixin  = Fluxxor.StoreWatchMixin;

    var AlignDistribute = require("jsx!js/jsx/views/PanelList/Transform/AlignDistribute"),
        Size = require("jsx!js/jsx/views/PanelList/Transform/Size"),
        Position = require("jsx!js/jsx/views/PanelList/Transform/Position"),
        RotateFlip = require("jsx!js/jsx/views/PanelList/Transform/RotateFlip"),
        Radius = require("jsx!js/jsx/views/PanelList/Transform/Radius");

    var TransformPanel = React.createClass({
        
        mixins: [FluxMixin, StoreWatchMixin("layer", "document", "application")],
        
        /**
         * Get the active document and active/selected layers from flux, and put in state
         */
        getStateFromFlux: function () {
            var activeDocument = this.getFlux().store("application").getCurrentDocument();
            return {
                activeDocument: activeDocument,
                activeLayers: activeDocument ? activeDocument.getSelectedLayers() : []
            };
        },

        render: function () {
            return (
                <section id="transformSection" className="transform">
                    <div className="section-background transform__body">
                        <ul>
                            <AlignDistribute />
                            <Size document={this.state.activeDocument}/>
                            <Position document={this.state.activeDocument}/>
                            <RotateFlip
                                activeDocument={this.state.activeDocument}
                                activeLayers={this.state.activeLayers}
                            />
                            <Radius />
                        </ul>
                    </div>
                </section>
            );
        }
    });

    module.exports = TransformPanel;
});
