/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

    var SVGIcon = React.createClass({

        /**
         * Returns an icon path based on the usual place (img folder), as well as the ID attribute to look
         * in that path
         *
         * @private
         * @return {string}
         */
        _getDefaultIconPath: function () {
            return "img/ico-" + this.props.CSSID + ".svg#" + this.props.CSSID;
        },

        /**
         * Sets xlink:href attribute on a SVG Use element based on props
         *
         * @private
         * @param {SVGSVGElement} useNode
         */
        _setLinkAttribute: function (useNode) {
            var iconPath;
            
            if (typeof this.props.iconPath === "string") {
                iconPath = this.props.iconPath + "#" + this.props.CSSID;
            } else {
                iconPath = this._getDefaultIconPath();
            }
            
            useNode.setAttributeNS("http://www.w3.org/1999/xlink", "href", iconPath);   
        },

        shouldComponentUpdate: function (nextProps) {
            return nextProps.iconPath !== this.props.iconPath || nextProps.CSSID !== this.props.CSSID;
        },
        
        componentDidMount: function () {
            var component = React.findDOMNode(this),
                useNode = window.document.createElementNS("http://www.w3.org/2000/svg", "use");

            this._setLinkAttribute(useNode);
                                
            component.appendChild(useNode);
        },
        
        componentDidUpdate: function () {
            var useNode = React.findDOMNode(this).querySelector("use");

            this._setLinkAttribute(useNode);
        },

        render: function () {
            var className = this.props.className || "";
            
            return (
                <svg
                    key={this.props.key}
                    viewBox={this.props.viewBox}
                    className = {className} />
            );
        }
    });

    module.exports = SVGIcon;
});
