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
        StoreWatchMixin  = Fluxxor.StoreWatchMixin ,
        _ = require("lodash");

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        AlignDistribute = require("jsx!js/jsx/views/PanelList/Transform/AlignDistribute"),
        Size = require("jsx!js/jsx/views/PanelList/Transform/Size"),
        Position = require("jsx!js/jsx/views/PanelList/Transform/Position"),
        Label = require("jsx!js/jsx/shared/Label"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        TextField = require("jsx!js/jsx/shared/TextField"),
        RotateFlip = require("jsx!js/jsx/views/PanelList/Transform/RotateFlip");

    var TransformPanel = React.createClass({
        
        mixins: [FluxChildMixin, StoreWatchMixin ("layer", "document", "application")],
        
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
                            <Size />
                            <Position />
                            <li className="formline">
                                <Label
                                    title="Rotate"
                                />
                                <Gutter />
                                <TextField
                                    valueType="percent"
                                />
                                <Gutter />
                                <RotateFlip
                                    activeDocument={this.state.activeDocument}
                                    activeLayers={this.state.activeLayers}
                                />
                            </li>
                            
                            <li className="formline">
                                <Label
                                    title="Radius"
                                    size="c-2-25"
                                />
                                <Gutter />
                                <TextField
                                    valueType="size"
                                />
                                <Gutter />
                                <Label 
                                    title="SLIDER"
                                />
                            </li>
                        </ul>
                    </div>
                </section>
            );
        }
    });

    module.exports = TransformPanel;
});
