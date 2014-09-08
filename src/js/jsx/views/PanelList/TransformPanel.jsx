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

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        AlignDistribute = require("jsx!js/jsx/views/PanelList/Transform/AlignDistribute"),
        Label = require("jsx!js/jsx/shared/Label"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        TextField = require("jsx!js/jsx/shared/TextField"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        strings = require("i18n!nls/strings");

    var TransformPanel = React.createClass({
        render: function () {
            return (
                <section id="transformSection" className="transform">
                    <TitleHeader title={strings.TITLE_TRANSFORM}>
                    </TitleHeader>
                    <div className="section-background transform__body">
                        <ul>
                            <AlignDistribute />
                            <li className="formline">
                                <Label
                                    title="W"
                                    size="c-2-25"
                                />
                                <Gutter />
                                <TextField
                                    valueType="size"
                                />
                                <Gutter />
                                <ToggleButton
                                    size="c-2-25"
                                    buttonType="toggle-lock"
                                />
                                <Gutter />
                                <Label
                                    title="H"
                                    size="c-2-25"
                                />
                                <Gutter />
                                <TextField
                                    valueType="size"
                                />
                            </li>
                            
                            <li className="formline">
                                <Label
                                    title="X"
                                    size="c-2-25"
                                />
                                <Gutter />
                                <TextField
                                    valueType="size"
                                />
                                <Gutter />
                                <ToggleButton
                                    size="c-2-25"
                                    buttonType="toggle-delta"
                                />
                                <Gutter />
                                <Label
                                    title="Y"
                                    size="c-2-25"
                                />
                                <Gutter />
                                <TextField
                                    valueType="size"
                                />
                            </li>
                            
                            <li className="formline">
                                <Label
                                    title="Rotate"
                                />
                                <Gutter />
                                <TextField
                                    valueType="percent"
                                />
                                <Gutter />
                                <SplitButton
                                    items="ico-flip-horizontal,ico-flip-vertical"
                                />
                            </li>
                            
                            <li className="formline">
                                <Label
                                    title="Radius"
                                    size="c-2-25"
                                />
                                <Gutter />
                                <TextField
                                    valueType="size"
                                />
                                <Gutter />
                                <Label 
                                    title="SLIDER"
                                />
                            </li>
                        </ul>
                    </div>
                </section>
            );
        }
    });

    module.exports = TransformPanel;
});
