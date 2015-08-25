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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        classnames = require("classnames");

    var Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        strings = require("i18n!nls/strings");
    
    var ToolbarIcon = React.createClass({
        mixins: [FluxMixin],

        /**
         * Get a CSS ID for the given tool
         * 
         * @private
         * @param {Tool} tool
         * @return {string}
         */
        _getToolCSSID: function (tool) {
            return "tool-" + tool.icon;
        },

        shouldComponentUpdate: function (nextProps) {
            return this.props.selected !== nextProps.selected ||
                this.props.disabled !== nextProps.disabled ||
                this.props.style !== nextProps.style;
        },
        
        render: function () {
            var toolID = this.props.toolID;
            if (!this.props.toolID) {
                return (<li key={this.props.index} className='tool-spacer'/>);
            }

            var toolStore = this.getFlux().store("tool"),
                tool = toolStore.getToolByID(toolID),
                CSSID = this._getToolCSSID(tool),
                buttonClassName = classnames({
                    "tool-selected": this.props.selected,
                    "toolbar-button": true
                });
                
            return (
                <li
                    key={this.props.index}
                    id={this.props.id}
                    style={this.props.style}>
                    <Button
                        title={strings.TOOLS[toolID]}
                        className={buttonClassName}
                        onClick={!this.props.disabled && this.props.onClick}
                        disabled={this.props.disabled}>
                        <SVGIcon
                            viewBox="0 0 24 24"
                            CSSID={CSSID} />
                    </Button>
                </li>
            );
        }
    });

    module.exports = ToolbarIcon;
});
