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

    var LibraryDialog = React.createClass({
        propTypes: {
            title: React.PropTypes.string,
            body: React.PropTypes.string,
            confirm: React.PropTypes.string,
            cancel: React.PropTypes.string,
            onCancel: React.PropTypes.func,
            onConfirm: React.PropTypes.func
        },

        render: function () {
            return (
                <div className="libraries__dialog">
                    <div className="libraries__dialog-wrapper">
                        <div className="libraries__dialog__title">
                            {this.props.title}
                        </div>
                        <div className="libraries__dialog__body">
                            {this.props.body}
                        </div>
                        <div className="libraries__dialog__btn-cancel"
                             onClick={this.props.onCancel}>
                            {this.props.cancel}
                        </div>
                        <div className="libraries__dialog__btn-confirm"
                             onClick={this.props.onConfirm}>
                            {this.props.confirm}
                        </div>
                    </div>
                </div>
            );
        }
    });

    module.exports = LibraryDialog;
});
