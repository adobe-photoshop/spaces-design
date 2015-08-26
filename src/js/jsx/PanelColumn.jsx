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
        classnames = require("classnames"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon");
        
    var PanelColumn = React.createClass({

        shouldComponentUpdate: function (nextProps) {
            // The document is inactive
            if (!nextProps.current) {
                return false;
            }

            return true;
        },
        
        render: function () {
            var className = classnames({
                    "panel": true,
                    "panel__visible": this.props.visible
                });

            return (
                <div className={className}>
                    <div
                        className="panel__hide"
                        onClick={this.props.onVisibilityToggle}>
                        <SVGIcon
                            viewBox="0 0 5 8"
                            CSSID="triangle" />
                    </div>
                    {this.props.children}
                </div>
            );
        }
    });

    module.exports = PanelColumn;
});
