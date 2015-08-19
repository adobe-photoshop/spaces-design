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
        Immutable = require("immutable");

    var VectorFill = require("jsx!./VectorFill"),
        Stroke = require("jsx!./Stroke"),
        Radius = require("jsx!./Radius");

    /**
     * VectorAppearance Component displays information of appearance properties for non-type only sets of layers
     */
    var VectorAppearance = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            return !Immutable.is(this.props.document, nextProps.document);
        },

        render: function () {
            var onlyTextLayers = this.props.document.layers.selected.every(function (layer) {
                return layer.kind === layer.layerKinds.TEXT;
            });
            
            if (onlyTextLayers) {
                return null;
            }

            return (
                <div>
                    <VectorFill document={this.props.document} />
                    <Stroke document={this.props.document} />
                    <Radius document={this.props.document} />
                </div>
            );
        }
    });

    module.exports = VectorAppearance;
});
