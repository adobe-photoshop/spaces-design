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
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings");

    var Type = React.createClass({
        render: function () {
            return (
                <div>
                    <header className="sub-header">
                        <h3>
                            {strings.STYLE.TYPE.TITLE}
                        </h3>
                        <div className="button-cluster">
                            <button
                                id="button-lorem-ipsum"
                                ref="lorem"
                                title={strings.TOOLTIPS.SHOW_LOREM_IPSUM}>
                                ℒ
                            </button>
                            <button
                                id="button-glyphs"
                                ref="glyphs"
                                title={strings.TOOLTIPS.SHOW_GLYPHS}>
                                æ
                            </button>
                            <button
                                className="button-settings"
                                title={strings.TOOLTIPS.TYPE_SETTINGS}
                                />
                        </div>
                    </header>

                    <ul>
                        <li className="formline" >
                            <Label
                                title={strings.TOOLTIPS.SET_TYPEFACE}>
                                {strings.STYLE.TYPE.TYPEFACE}
                            </Label>
                            <Gutter />
                            
                            <TextInput
                                valueType="combo"
                                ref="typeface"
                            />
                            <Gutter />
                        </li>
                        
                        <li className="formline">
                            <Label
                                title={strings.TOOLTIPS.SET_WEIGHT}>
                                {strings.STYLE.TYPE.WEIGHT}
                            </Label>
                            <Gutter />
                            <TextInput
                                valueType="combo"
                                ref="weight"
                            />
                            <Gutter />
                        </li>

                        <li className="formline">
                            <Label
                                title={strings.TOOLTIPS.SET_TYPE_COLOR}>
                                Color here
                            </Label>
                            <Gutter />
                            <Label
                                title={strings.TOOLTIPS.SET_TYPE_SIZE}
                                size="c-3-25">
                                {strings.STYLE.TYPE.SIZE}
                            </Label>
                            <Gutter />
                            <TextInput
                                valueType="simple"
                            />
                        </li>


                        <li className="formline">
                            <Label
                                title={strings.TOOLTIPS.SET_LETTERSPACING}>
                                {strings.STYLE.TYPE.LETTER}
                            </Label>
                            <Gutter />
                            <TextInput
                                valueType="simple"
                            />
                            <Gutter />
                            <Gutter />
                            <Gutter />
                            <Label
                                title={strings.TOOLTIPS.SET_LINESPACING}
                                size="c-3-25">
                                {strings.STYLE.TYPE.LINE}
                            </Label>
                            <Gutter />
                            <TextInput
                                valueType="simple"
                            />
                        </li>

                        <li className="formline">
                            <Label
                                title={strings.TOOLTIPS.SET_TYPE_ALIGNMENT}>
                                {strings.STYLE.TYPE.ALIGN}
                            </Label>
                            <Gutter />
                            <SplitButtonList>
                                <SplitButtonItem 
                                    id="text-left"
                                    selected={false}
                                    disabled={false}
                                    onClick={null}
                                    title={strings.TOOLTIPS.ALIGN_TYPE_LEFT} />
                                <SplitButtonItem 
                                    id="text-center"
                                    selected={false}
                                    disabled={false}
                                    onClick={null}
                                    title={strings.TOOLTIPS.ALIGN_TYPE_CENTER} />
                                <SplitButtonItem 
                                    id="text-right"
                                    selected={false}
                                    disabled={false}
                                    onClick={null}
                                    title={strings.TOOLTIPS.ALIGN_TYPE_RIGHT} />
                                <SplitButtonItem 
                                    id="text-justified"
                                    selected={false}
                                    disabled={false}
                                    onClick={null}
                                    title={strings.TOOLTIPS.ALIGN_TYPE_JUSTIFIED} />
                            </SplitButtonList>
                        </li>
                    </ul>
                </div>
            );
        },
    });

    module.exports = Type;
});
