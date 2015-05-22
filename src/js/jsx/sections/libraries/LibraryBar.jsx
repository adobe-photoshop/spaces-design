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
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React);

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings");

    var LibraryBar = React.createClass({
        mixins: [FluxMixin],

        createNewElement: function () {
            this.getFlux().actions.libraries.createElementFromSelectedLayer();
        },

        render: function () {
            return (
                <div className="formline">
                    <ul className="button-radio">
                        <SplitButtonItem
                            title={strings.TOOLTIPS.FLIP_HORIZONTAL}
                            iconId="flip-horizontal"
                            onClick={this.createNewElement}
                            replaceWith="Next five are likely to be a new control"
                             />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.FLIP_VERTICAL}
                            iconId="flip-vertical"
                            />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SWAP_POSITION}
                            iconId="swap"
                            />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SWAP_POSITION}
                            iconId="swap"
                            />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SWAP_POSITION}
                            iconId="swap"
                            />
                        <Gutter />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SWAP_POSITION}
                            iconId="swap"
                            replaceWith="Adobe Stock Image link"
                            />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SWAP_POSITION}
                            iconId="swap"
                            replaceWith="syncIcon"
                            />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.SWAP_POSITION}
                            iconId="swap"
                            replaceWith="DeleteButton"
                            />
                    </ul>
                    <Gutter />
                </div>
            );
        }
    });

    module.exports = LibraryBar;
});
