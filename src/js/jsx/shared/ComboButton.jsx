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

    var ComboButton = React.createClass({
        mixins: [React.addons.PureRenderMixin],

        render: function () {
            var size = this.props.size || "column-16",
                myClass = "button-combo" + " " + size,
                values = this.props.values;

            var options = Object.keys(values).map(function (name, idx) {
                return (<option value={name} key={idx}>{values[name]}</option>);
            });

            return (
                <div className={myClass}>
                    <div>Normal</div>
                </div>
            );
        }
    });
    module.exports = ComboButton;
});

//<select
//ref="select"
//value={this.props.selected}>
//                        {options}
//</select>
