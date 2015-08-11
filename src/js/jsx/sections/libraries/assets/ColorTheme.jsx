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
        classnames = require("classnames"),
        tinycolor = require("tinycolor");
        
    var AssetButtons = require("jsx!./AssetButtons");

    var ColorTheme = React.createClass({
        mixins: [FluxMixin],

        _handleAdd: function () {
            // Do something with color here
        },
        
        /**
         * Handle select element event. 
         * 
         * @private
         */
        _handleSelect: function () {
            if (this.props.onSelect) {
                this.props.onSelect(this.props.element);
            }
        },

        render: function () {
            var element = this.props.element,
                colorSwatches = element.getPrimaryRepresentation().getValue("colortheme", "data").swatches;
                
            var colorSwatchComponents = colorSwatches.map(function (color) {
                var colorHex = tinycolor(color[0].value).toHexString().toUpperCase();
                return (<div key={colorHex} style={{ background: colorHex }} title={colorHex}/>);
            }.bind(this));
            
            var classNames = classnames({
                "libraries__asset": true,
                "libraries__asset-colortheme": true,
                "libraries__asset-selected": this.props.selected
            });
            
            var description = this.props.selected ? (<AssetButtons element={this.props.element}/>) : (
                <div className="libraries__asset__desc">
                    {element.displayName}
                </div>
            );

            return (
                <div className={classNames}
                     key={element.id}
                     onClick={this._handleSelect}>
                    <div className="libraries__asset__preview libraries__asset__preview-colortheme">
                        {colorSwatchComponents}
                    </div>
                    {description}
                </div>
            );
        }
    });

    module.exports = ColorTheme;
});
