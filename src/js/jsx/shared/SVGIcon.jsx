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

        shouldComponentUpdate: function (nextProps) {
            return nextProps.iconPath !== this.props.iconPath && nextProps.CSSID !== this.props.CSSID ;
        },
        
        componentDidMount: function (){

            var component = this.getDOMNode(),
                iconPath = this.props.iconPath + "#" + this.props.CSSID,
                useNode = document.createElementNS('http://www.w3.org/2000/svg', 'use');

            useNode.setAttributeNS( 'http://www.w3.org/1999/xlink', 'href', iconPath);   
                    
            component.appendChild( useNode );                        
        },
        
        componentDidUpdate: function (){

            var useNode = this.getDOMNode().querySelector("use"),
                iconPath = this.props.iconPath + "#" + this.props.CSSID;

            useNode.setAttributeNS( 'http://www.w3.org/1999/xlink', 'href', iconPath);                           
        },        
                

        render: function () {
            if (!this.props.hasOwnProperty("className")) {
                this.props.className = "";
            }
            

            
            // var iconPath = this.props.iconPath + "#" + this.props.CSSID;
            
            // return (
            //     <svg
            //         viewBox={this.props.viewBox}
            //         className = {this.props.className}
            //         dangerouslySetInnerHTML={{ __html: '<use xlink:href="' + iconPath + '"/>' }} />
            // );

            // This snippet is a way to test whether <svg><use> is the problem or not
            // return (
            //     <div
            //         className = {this.props.className}
            //         style = { {"backgroundImage" : "url(" + this.props.iconPath + ")",
            //         "width": "1.3rem",
            //         "height": "1.3rem"
            //                     } } />
            // );
            
            // Use this with componentDidMount
            return (
                <svg
                    viewBox={this.props.viewBox}
                    className = {this.props.className} />
            );        

        },
    });

    module.exports = SVGIcon;
});
