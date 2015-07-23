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
        classnames = require("classnames");
        
    var strings = require("i18n!nls/strings");

    var DocumentHeaderTab = React.createClass({
        shouldComponentUpdate: function (nextProps) {
            return this.props.current !== nextProps.current ||
                this.props.dirty !== nextProps.dirty ||
                this.props.name !== nextProps.name ||
                this.props.smallTab !== nextProps.smallTab;
        },

        render: function () {
            var warning;

            if (this.props.unsupported) {
                warning = (
                    <span
                        title={strings.TOOLTIPS.UNSUPPORTED_FEATURES}
                        className="document-controls__unsupported">
                        !
                    </span>
                );
            }

            return (
                <div
                    className={classnames({
                        "document-title": true,
                        "document-title__current": this.props.current,
                        "document-title__small": this.props.smallTab
                    })}
                    title={this.props.name}
                    onClick={this.props.onClick}>
                    {this.props.dirty ? "•" : ""}
                    {this.props.name}
                    {warning}
                </div>
            );
        }
    });

    module.exports = DocumentHeaderTab;
});
