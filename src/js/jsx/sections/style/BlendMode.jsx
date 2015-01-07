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
        Immutable = require("immutable");

    var Datalist = require("jsx!js/jsx/shared/Datalist"),
        strings = require("i18n!nls/strings");

    /**
     * @private
     * @constructor
     */
    var BlendRec = Immutable.Record({
        id: null,
        title: null
    });

    /**
     * The set of possible layer opacity blend modes.
     * 
     * @private
     * @type {Immutable.List.<BlendRec>}
     */
    var _blendModes = Immutable.List([
        new BlendRec({
            id: "normal",
            title: strings.STYLE.BLEND.NORMAL
        }),
        new BlendRec({
            id: "dissolve",
            title: strings.STYLE.BLEND.DISSOLVE
        }),
        new BlendRec({
            id: "darken",
            title: strings.STYLE.BLEND.DARKEN
        }),
        new BlendRec({
            id: "lighten",
            title: strings.STYLE.BLEND.LIGHTEN
        }),
        new BlendRec({
            id: "screen",
            title: strings.STYLE.BLEND.SCREEN
        }),
        new BlendRec({
            id: "overlay",
            title: strings.STYLE.BLEND.OVERLAY
        }),
        new BlendRec({
            id: "multiply",
            title: strings.STYLE.BLEND.MULTIPLY
        }),
        new BlendRec({
            id: "colorBurn",
            title: strings.STYLE.BLEND.COLORBURN
        }),
        new BlendRec({
            id: "linearBurn",
            title: strings.STYLE.BLEND.LINEARBURN
        }),
        new BlendRec({
            id: "darkerColor",
            title: strings.STYLE.BLEND.DARKERCOLOR
        }),
    ]);

    var BlendMode = React.createClass({
        render: function () {
            var defaultMode = _blendModes.first();

            return (
                <Datalist
                    list={"blendmodes"}
                    options={_blendModes}
                    value={defaultMode.title}
                    defaultSelected={defaultMode.id}
                />
            );
        }
    });

    module.exports = BlendMode;
});
