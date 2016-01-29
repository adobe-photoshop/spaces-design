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
        classnames = require("classnames");

    var PanelColumn = React.createClass({
        getInitialState: function () {
            return {};
        },
        
        shouldComponentUpdate: function (nextProps) {
            if (!this.props.visible && !nextProps.visible) {
                return false;
            }

            return true;
        },

        componentWillReceiveProps: function (nextProps) {
            if (!this.props.visible && nextProps.visible) {
                this.setState({
                    showPanel: true
                });
            } else if (this.props.visible && !nextProps.visible) {
                this.setState({
                    hidePanel: true
                });
            }
        },
        
        render: function () {

            var className = classnames({
                    "panel": true,
                    "panel-show": this.state.showPanel,
                    "panel-hide": this.state.hidePanel,
                    "panel__visible": this.props.visible
                });

            return (
                <div className={className}>
                    {this.props.children}
                </div>
            );
        }
    });

    module.exports = PanelColumn;
});
