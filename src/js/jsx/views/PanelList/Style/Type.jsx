/** @jsx React.DOM */
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

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        TextField = require("jsx!js/jsx/shared/TextField"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        strings = require("i18n!nls/strings");

    var Type = React.createClass({
        render: function () {
            return (
                <div>
                    <header className="sub-header">
                        <h3>
                            {strings.STYLE.TYPE.TITLE}
                        </h3>
                        <div className="buttonCluster">
                            <button id="button-lorem-ipsum" ref="lorem" onClick={this._openLoremPanel}>ℒ</button>
                            <button id="button-glyphs" ref="glyphs" onClick={this._openGlyphsPanel}>æ</button>
                            <button className="button-settings"></button>
                        </div>
                    </header>

                    <ul>
                        <li className="formline" >
                            <Label
                                title={strings.STYLE.TYPE.TYPEFACE}
                            />
                            <Gutter />
                            
                            <TextField
                                valueType="combo"
                                ref="typeface"
                            />
                            <Gutter />
                        </li>
                        
                        <li className="formline">
                            <Label
                                title={strings.STYLE.TYPE.WEIGHT}
                            />
                            <Gutter />
                            <TextField
                                valueType="combo"
                                ref="weight"
                            />
                            <Gutter />
                        </li>

                        <li className="formline">
                            <Label
                                title="Color here"
                            />
                            <Gutter />
                            <Label
                                title={strings.STYLE.TYPE.SIZE}
                                size="c-3-25"/>
                            <Gutter />
                            <TextField
                                valueType="simple" 
                            />
                        </li>


                        <li className="formline">
                            <Label
                                title={strings.STYLE.TYPE.LETTER}
                            />
                            <Gutter />
                            <TextField
                                valueType="simple"
                            />
                            <Gutter />
                            <Gutter />
                            <Gutter />
                            <Label
                                title={strings.STYLE.TYPE.LINE}
                                size="c-3-25"
                            />
                            <Gutter />
                            <TextField
                                valueType="simple"
                            />
                        </li>

                        <li className="formline">
                            <Label
                                title={strings.STYLE.TYPE.ALIGN}
                            />
                            <Gutter />
                            <SplitButton
                                items="text-left,text-center,text-right,text-justified"
                            />
                        </li>
                    </ul>
                </div>
            );
        },

        _openGlyphsPanel: function (event) {
    
        },

        _openLoremPanel: function (event) {
        
        }
    });

    module.exports = Type;
});
