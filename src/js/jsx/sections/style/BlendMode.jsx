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

    var Datalist = require("jsx!js/jsx/shared/Datalist"),
        strings = require("i18n!nls/strings"),
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
            title: strings.STYLE.BLEND.NORMAL
        },
        "dissolve": {
            id: "dissolve",
            title: strings.STYLE.BLEND.DISSOLVE
        },
        "darken": {
            id: "darken",
            title: strings.STYLE.BLEND.DARKEN
        },
        "lighten": {
            id: "lighten",
            title: strings.STYLE.BLEND.LIGHTEN
        },
        "screen": {
            id: "screen",
            title: strings.STYLE.BLEND.SCREEN
        },
        "overlay": {
            id: "overlay",
            title: strings.STYLE.BLEND.OVERLAY
        },
        "multiply": {
            id: "multiply",
            title: strings.STYLE.BLEND.MULTIPLY
        },
        "colorBurn": {
            id: "colorBurn",
            title: strings.STYLE.BLEND.COLORBURN
        },
        "linearBurn": {
            id: "linearBurn",
            title: strings.STYLE.BLEND.LINEARBURN
        },
        "darkerColor": {
            id: "darkerColor",
            title: strings.STYLE.BLEND.DARKERCOLOR
        },
        // WE ONLY SHOW PASSTHROUGH IF SELECTION IS ALL GROUPS
        "passThrough": {
            id: "passThrough",
            title: strings.STYLE.BLEND.PASSTHROUGH
        },
        // WE DON'T SHOW ANYTHING BELOW THIS LINE AS AN OPTION
        "colorDodge": {
            id: "colorDodge",
            title: strings.STYLE.BLEND.COLORDODGE,
            hidden: true
        },
        "linearDodge": {
            id: "linearDodge",
            title: strings.STYLE.BLEND.LINEARDODGE,
            hidden: true
        },
        "lighterColor": {
            id: "lighterColor",
            title: strings.STYLE.BLEND.LIGHTERCOLOR,
            hidden: true
        },
        "softLight": {
            id: "softLight",
            title: strings.STYLE.BLEND.SOFTLIGHT,
            hidden: true
        },
        "hardLight": {
            id: "hardLight",
            title: strings.STYLE.BLEND.HARDLIGHT,
            hidden: true
        },
        "vividLight": {
            id: "vividLight",
            title: strings.STYLE.BLEND.VIVIDLIGHT,
            hidden: true
        },
        "linearLight": {
            id: "linearLight",
            title: strings.STYLE.BLEND.LINEARLIGHT,
            hidden: true
        },
        "pinLight": {
            id: "pinLight",
            title: strings.STYLE.BLEND.PINLIGHT,
            hidden: true
        },
        "hardMix": {
            id: "hardMix",
            title: strings.STYLE.BLEND.HARDMIX,
            hidden: true
        },
        "difference": {
            id: "difference",
            title: strings.STYLE.BLEND.DIFFERENCE,
            hidden: true
        },
        "exclusion": {
            id: "exclusion",
            title: strings.STYLE.BLEND.EXCLUSION,
            hidden: true
        },
        "blendSubtraction": {
            id: "blendSubtraction",
            title: strings.STYLE.BLEND.SUBTRACT,
            hidden: true
        },
        "blendDivide": {
            id: "blendDivide",
            title: strings.STYLE.BLEND.DIVIDE,
            hidden: true
        },
        "hue": {
            id: "hue",
            title: strings.STYLE.BLEND.HUE,
            hidden: true
        },
        "saturation": {
            id: "saturation",
            title: strings.STYLE.BLEND.SATURATION,
            hidden: true
        },
        "color": {
            id: "color",
            title: strings.STYLE.BLEND.COLOR,
            hidden: true
        },
        "luminosity": {
            id: "luminosity",
            title: strings.STYLE.BLEND.LUMINOSITY,
            hidden: true
        }
    });

    var BlendMode = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            var getRelevantProps = function (props) {
                return collection.pluckAll(props.layers, ["id", "blendMode"]);
            };

            return !Immutable.is(getRelevantProps(this.props), getRelevantProps(nextProps));
        },

        getDefaultProps: function () {
            // The id is used to distinguish among Dialog instances
            return {
                id: "main"
            };
        },

        /**
         * Set the blend mode of the selected layers
         *
         * @private
         * @param {string} mode
         */
        _handleChange: function (mode) {
            this.getFlux().actions.layers
                .setBlendModeThrottled(this.props.document, this.props.layers, mode);
        },

        render: function () {
            var layers = this.props.layers,
                modes = collection.pluck(layers, "blendMode"),
                mode = collection.uniformValue(modes),
                title = _blendModes.has(mode) ? _blendModes.get(mode).title :
                    (modes.size > 1 ? strings.TRANSFORM.MIXED : mode),
                allGroups = layers.every(function (layer) {
                    return layer.kind === layer.layerKinds.GROUP;
                }),
                // Remove Pass Through option if any of the layers are not a group
                modesToShow = _blendModes.update("passThrough", function (item) {
                    item.hidden = !allGroups;
                    return item;
                }).toList();
            
            // Hack to disable the Fill BlendMode instance
            if (this.props.disabled) {
                title = null;
            }

            var listID = "blendmodes-" + this.props.id + "-" + this.props.document.id;

            return (
                <Datalist
                    list={listID}
                    disabled={this.props.disabled}
                    className="dialog-blendmodes"
                    options={modesToShow}
                    value={title}
                    defaultSelected={mode}
                    size="column-9"
                    onChange={this._handleChange}
                    onFocus={this.props.onFocus} />
            );
        }
    });

    module.exports = BlendMode;
});
