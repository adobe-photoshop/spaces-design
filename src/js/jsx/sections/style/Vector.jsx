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

    var React = require("react");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        strings = require("i18n!nls/strings"),
        Combine = require("jsx!./Combine"),
        Radius = require("jsx!./Radius");

    var Vector = React.createClass({
        render: function () {
            var vectorLayers = this.props.document.layers.selected.filter(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                });

            if (vectorLayers.isEmpty()) {
                return null;
            }

            return (
                <div>
                    <header className="sub-header">
                        <h3>
                            {strings.STYLE.VECTOR.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule" />
                    </header>
                    <Combine {...this.props}
                        layers={vectorLayers} />
                    <Radius {...this.props}
                        layers={vectorLayers} />
                </div>
            );
        }
    });

    module.exports = Vector;
});
