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

    var SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        AlignDistribute = require("jsx!./AlignDistribute"),
        Size = require("jsx!./Size"),
        Position = require("jsx!./Position"),
        Rotate = require("jsx!./Rotate"),
        Combine = require("jsx!./Combine"),
        Flip = require("jsx!./Flip");

    var TransformPanel = React.createClass({
        render: function () {
            var positionRotateClasses = classnames("formline",
                "formline__bottom-align",
                "formline__space-between",
                "column-24",
                "formline__padded-first-child");
            
            return (
                <section className="transform section">
                    <header className="section-header">
                        <AlignDistribute document={this.props.document} />
                    </header>
                    <div className="section-container__no-collapse transform__body">
                        <div className="formline column-24 formline__padded-first-child">
                            <div className="control-group">
                                <Size document={this.props.document} />
                                
                            </div>
                            <div className="control-group">
                                <div className="control-group reference-mark">
                                    <SVGIcon CSSID="reference-cm" />
                                </div>
                            </div>
                        </div>
                        <div className={positionRotateClasses}>
                            <div className="control-group">
                                <Position document={this.props.document} />
                            </div>
                            <div className="control-group">
                                <Rotate document={this.props.document} />
                            </div>
                        </div>
                        <div className="formline formline__space-between">
                            <Combine document={this.props.document} />
                            <Flip document={this.props.document} />
                        </div>
                    </div>
                </section>
            );
        }
    });

    module.exports = TransformPanel;
});
