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

        _getDefaultIconPath: function (){
            return "img/ico-" + this.props.CSSID + ".svg#" + this.props.CSSID;
        },

        _setLinkAttribute: function (useNode){
            var iconPath;
            
            if (this.props.hasOwnProperty("iconPath")){
                iconPath = this.props.iconPath + "#" + this.props.CSSID;
            }else{
                iconPath = this._getDefaultIconPath();
            }
            
            useNode.setAttributeNS( "http://www.w3.org/1999/xlink", "href", iconPath);   
        },

        shouldComponentUpdate: function (nextProps) {
            return nextProps.iconPath !== this.props.iconPath && nextProps.CSSID !== this.props.CSSID;
        },
        
        componentDidMount: function (){
            var component = this.getDOMNode(),
                useNode = document.createElementNS("http://www.w3.org/2000/svg", "use");

            this._setLinkAttribute(useNode);
                                
            component.appendChild(useNode);                        
        },
        
        componentDidUpdate: function (){
            var useNode = this.getDOMNode().querySelector("use");

            this._setLinkAttribute(useNode);
        },                        

        render: function () {
            if (!this.props.hasOwnProperty("className")) {
                this.props.className = "";
            }
            
            return (
                <svg
                    viewBox={this.props.viewBox}
                    className = {this.props.className} />
            );        
        },
    });

    module.exports = SVGIcon;
});
