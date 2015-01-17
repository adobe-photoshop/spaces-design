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
        Button = require("jsx!js/jsx/shared/Button"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings"),
        Radius = require("jsx!../transform/Radius");

    var Vector = React.createClass({
        render: function () {
            var document = this.props.document,
                layers = document.layers.selected,
                hasVectorLayers = layers.some(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                });

            if (!hasVectorLayers) {
                return null;
            }

            return (
                <div>
                    <header className="sub-header">
                        <h3>
                            {strings.STYLE.VECTOR.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule" />
                        <Gutter />
                        <div className="button-cluster">
                            <Button
                                className="button-settings"
                                title={strings.TOOLTIPS.VECTOR_SETTINGS} />
                        </div>
                    </header>
                    <div className="formline" >
                        <Label
                            title={strings.TOOLTIPS.SET_COMBINATION}>
                            {strings.STYLE.VECTOR.COMBINE}
                        </Label>
                        <Gutter />
                        <SplitButtonList>
                            <SplitButtonItem
                                id="xor-union"
                                selected={true}
                                disabled={false}
                                onClick={null}
                                title={strings.TOOLTIPS.UNITE_SHAPE}/>
                            <SplitButtonItem
                                id="xor-subtract"
                                selected={false}
                                disabled={false}
                                onClick={null}
                                title={strings.TOOLTIPS.SUBTRACT_SHAPE}/>
                            <SplitButtonItem
                                id="xor-intersect"
                                selected={false}
                                disabled={false}
                                onClick={null}
                                title={strings.TOOLTIPS.INTERSECT_SHAPE}/>
                            <SplitButtonItem
                                id="xor-difference"
                                selected={false}
                                disabled={false}
                                onClick={null}
                                title={strings.TOOLTIPS.DIFFERENCE_SHAPE}/>
                        </SplitButtonList>
                        <Gutter />
                    </div>
                    <Radius {...this.props} />
                </div>
            );
        }
    });

    module.exports = Vector;
});
