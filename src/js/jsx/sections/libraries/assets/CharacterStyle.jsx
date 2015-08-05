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

    var Promise = require("bluebird"),
        React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React);
        
    var strings = require("i18n!nls/strings");

    var CharacterStyle = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                renditionPath: ""
            };
        },

        componentWillMount: function () {
            // On mount, get the rendition of this element
            var element = this.props.element;

            Promise.fromNode(function (cb) {
                element.getRenditionPath(40, cb);
            }).bind(this).then(function (path) {
                this.setState({
                    renditionPath: path
                });
            });
        },

        _colorDataToHexValue: function (data) {
            /*jshint bitwise: false*/
            var r = data.value.r,
                g = data.value.g,
                b = data.value.b,
                u = r << 16 | g << 8 | b,
                str = "000000" + u.toString(16);

            return "#" + str.substr(str.length - 6);
        },

        _handleAdd: function () {
            this.getFlux().actions.libraries.applyCharacterStyle(this.props.element);
        },

        render: function () {
            var element = this.props.element,
                charStyle = element.getPrimaryRepresentation().getValue("characterstyle", "data"),
                font = charStyle.adbeFont,
                fontSize = charStyle.fontSize,
                fontColorHex = this._colorDataToHexValue(charStyle.color[0]);

            return (
                <div className="libraries__asset" key={element.id} title={strings.LIBRARIES.CLICK_TO_APPLY}>
                    <div className="libraries__asset__preview libraries__asset__preview-character-style">
                        <img src={this.state.renditionPath}/>
                        <div className="libraries__asset__preview-character-style__color-swatch"
                             style={{ backgroundColor: fontColorHex }}/>
                    </div>
                    <div className="libraries__asset__desc">
                        <div>{font.name} {font.style}</div>
                        <div className="libraries__asset__desc-details">
                            {fontSize.value}{fontSize.type}, {fontColorHex}
                        </div>
                    </div>
                </div>
            );
        }
    });

    module.exports = CharacterStyle;
});
