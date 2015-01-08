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
        strings = require("i18n!nls/strings"),
        PureRenderMixin = React.addons.PureRenderMixin;

    var AlignDistribute = React.createClass({
        mixins: [PureRenderMixin],
        render: function () {

            return (
                <li className="header-alignment">
                    <button
                        className="distribute-horizontally button-align-distribute"
                        title={strings.TOOLTIPS.DISTRIBUTE_HORIZONTALLY} />
                    <button
                        className="distribute-vertically button-align-distribute"
                        title={strings.TOOLTIPS.DISTRIBUTE_VERTICALLY} />
                    <button
                        className="align-left button-align-distribute"
                        title={strings.TOOLTIPS.ALIGN_LEFT} />
                    <button
                        className="align-center button-align-distribute"
                        title={strings.TOOLTIPS.ALIGN_CENTER} />
                    <button
                        className="align-right button-align-distribute"
                        title={strings.TOOLTIPS.ALIGN_RIGHT} />
                    <button
                        className="align-top button-align-distribute"
                        title={strings.TOOLTIPS.ALIGN_TOP} />
                    <button
                        className="align-middle button-align-distribute"
                        title={strings.TOOLTIPS.ALIGN_MIDDLE} />
                    <button
                        className="align-bottom button-align-distribute"
                        title={strings.TOOLTIPS.ALIGN_BOTTOM} />
                </li>
            );
        },
    });

    module.exports = AlignDistribute;
});
