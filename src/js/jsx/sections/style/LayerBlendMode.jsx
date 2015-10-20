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

    var BlendMode = require("jsx!./BlendMode"),
        strings = require("i18n!nls/strings"),
        headlights = require("js/util/headlights"),
        collection = require("js/util/collection");

    var LayerBlendMode = React.createClass({
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
            headlights.logEvent("edit", "layer-blendmode-input", mode);
        },

        render: function () {
            var layers = this.props.layers,
                modes = collection.pluck(layers, "blendMode"),
                allGroups = layers.every(function (layer) {
                    return layer.kind === layer.layerKinds.GROUP;
                }),
                disabled = this.props.disabled || layers.every(function (layer) {
                    return layer.isBackground;
                });

            var listID = "blendmodes-" + this.props.id + this.props.containerType + "-" + this.props.document.id;

            return (
                <BlendMode
                    disabled={disabled}
                    listID={listID}
                    modes={modes}
                    handleChange={this._handleChange}
                    mixedTitle={strings.TRANSFORM.MIXED}
                    allGroups={allGroups} />
            );
        }
    });

    module.exports = LayerBlendMode;
});
