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
        FluxMixin = Fluxxor.FluxMixin(React),
        Immutable = require("immutable");

    var Datalist = require("js/jsx/shared/Datalist"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection");

    /**
     * The set of possible layer opacity blend modes.
     * 
     * @private
     * @type {Immutable.OrderedMap.<Select.OptionRec>}
     */
    var _blendModes = Immutable.OrderedMap({
        "normal": {
            id: "normal",
            title: nls.localize("strings.STYLE.BLEND.NORMAL")
        },
        "dissolve": {
            id: "dissolve",
            title: nls.localize("strings.STYLE.BLEND.DISSOLVE")
        },
        "darken": {
            id: "darken",
            title: nls.localize("strings.STYLE.BLEND.DARKEN")
        },
        "lighten": {
            id: "lighten",
            title: nls.localize("strings.STYLE.BLEND.LIGHTEN")
        },
        "screen": {
            id: "screen",
            title: nls.localize("strings.STYLE.BLEND.SCREEN")
        },
        "overlay": {
            id: "overlay",
            title: nls.localize("strings.STYLE.BLEND.OVERLAY")
        },
        "multiply": {
            id: "multiply",
            title: nls.localize("strings.STYLE.BLEND.MULTIPLY")
        },
        "colorBurn": {
            id: "colorBurn",
            title: nls.localize("strings.STYLE.BLEND.COLORBURN")
        },
        "linearBurn": {
            id: "linearBurn",
            title: nls.localize("strings.STYLE.BLEND.LINEARBURN")
        },
        "darkerColor": {
            id: "darkerColor",
            title: nls.localize("strings.STYLE.BLEND.DARKERCOLOR")
        },
        // WE ONLY SHOW PASSTHROUGH IF SELECTION IS ALL GROUPS
        "passThrough": {
            id: "passThrough",
            title: nls.localize("strings.STYLE.BLEND.PASSTHROUGH")
        },
        // WE DON'T SHOW ANYTHING BELOW THIS LINE AS AN OPTION
        "colorDodge": {
            id: "colorDodge",
            title: nls.localize("strings.STYLE.BLEND.COLORDODGE"),
            hidden: true
        },
        "linearDodge": {
            id: "linearDodge",
            title: nls.localize("strings.STYLE.BLEND.LINEARDODGE"),
            hidden: true
        },
        "lighterColor": {
            id: "lighterColor",
            title: nls.localize("strings.STYLE.BLEND.LIGHTERCOLOR"),
            hidden: true
        },
        "softLight": {
            id: "softLight",
            title: nls.localize("strings.STYLE.BLEND.SOFTLIGHT"),
            hidden: true
        },
        "hardLight": {
            id: "hardLight",
            title: nls.localize("strings.STYLE.BLEND.HARDLIGHT"),
            hidden: true
        },
        "vividLight": {
            id: "vividLight",
            title: nls.localize("strings.STYLE.BLEND.VIVIDLIGHT"),
            hidden: true
        },
        "linearLight": {
            id: "linearLight",
            title: nls.localize("strings.STYLE.BLEND.LINEARLIGHT"),
            hidden: true
        },
        "pinLight": {
            id: "pinLight",
            title: nls.localize("strings.STYLE.BLEND.PINLIGHT"),
            hidden: true
        },
        "hardMix": {
            id: "hardMix",
            title: nls.localize("strings.STYLE.BLEND.HARDMIX"),
            hidden: true
        },
        "difference": {
            id: "difference",
            title: nls.localize("strings.STYLE.BLEND.DIFFERENCE"),
            hidden: true
        },
        "exclusion": {
            id: "exclusion",
            title: nls.localize("strings.STYLE.BLEND.EXCLUSION"),
            hidden: true
        },
        "blendSubtraction": {
            id: "blendSubtraction",
            title: nls.localize("strings.STYLE.BLEND.SUBTRACT"),
            hidden: true
        },
        "blendDivide": {
            id: "blendDivide",
            title: nls.localize("strings.STYLE.BLEND.DIVIDE"),
            hidden: true
        },
        "hue": {
            id: "hue",
            title: nls.localize("strings.STYLE.BLEND.HUE"),
            hidden: true
        },
        "saturation": {
            id: "saturation",
            title: nls.localize("strings.STYLE.BLEND.SATURATION"),
            hidden: true
        },
        "color": {
            id: "color",
            title: nls.localize("strings.STYLE.BLEND.COLOR"),
            hidden: true
        },
        "luminosity": {
            id: "luminosity",
            title: nls.localize("strings.STYLE.BLEND.LUMINOSITY"),
            hidden: true
        }
    });

    var BlendMode = React.createClass({
        mixins: [FluxMixin],

        getDefaultProps: function () {
            return {
                allGroups: false,
                size: "column-14"
            };
        },

        render: function () {
            var modes = this.props.modes,
                mode = collection.uniformValue(modes),
                title = _blendModes.has(mode) ? _blendModes.get(mode).title :
                    (modes.size > 1 ? nls.localize("strings.TRANSFORM.MIXED") : mode),
                allGroups = this.props.allGroups,
                // Remove Pass Through option if any of the layers are not a group
                modesToShow = _blendModes.update("passThrough", function (item) {
                    item.hidden = !allGroups;
                    return item;
                }).toList();
            
            // Hack to disable the Fill BlendMode instance
            if (this.props.disabled) {
                title = null;
            }

            var listID = this.props.listID;

            return (
                <Datalist
                    list={listID}
                    disabled={this.props.disabled}
                    className="dialog-blendmodes"
                    options={modesToShow}
                    value={title}
                    defaultSelected={mode}
                    size={this.props.size}
                    onChange={this.props.handleChange}
                    onFocus={this.props.onFocus} />
            );
        }
    });

    module.exports = BlendMode;
});
