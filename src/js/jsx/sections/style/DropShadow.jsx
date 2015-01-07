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


define(function (require, exports) {
    "use strict";

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        Immutable = require("immutable"),
        _ = require("lodash");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Button = require("jsx!js/jsx/shared/Button"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * DropShadow Component displays information of a single dropShadow for a given layer or 
     * set of layers.
     */
    var DropShadow = React.createClass({
        mixins: [FluxMixin],

        /**
         * Produce a set of arrays of separate dropShadow display properties, 
         * transformed and ready for the sub-components
         *
         * @private
         * @param {Array.<DropShadow>} dropShadows
         * @return {DropShadow}
         */
        _downsampleDropShadows: function (dropShadows) {
            var colors = collection.pluck(dropShadows, "color"),
                enabledFlags = collection.pluck(dropShadows, "enabled"),
                propStrings = Immutable.List(dropShadows.reduce(function (strings, dropShadow) {
                    if (dropShadow) {
                        var propString = [
                            dropShadow.x,
                            dropShadow.y,
                            dropShadow.blur,
                            dropShadow.spread
                        ].join(",");

                        strings.push(propString);
                    }
                    return strings;
                }, []));

            return {
                colors: colors,
                enabledFlags: enabledFlags,
                propStrings: propStrings
            };
        },

        render: function () {
            var downsample = this._downsampleDropShadows(this.props.dropShadows);

            var dropShadowClasses = React.addons.classSet({
                "drop-shadow-list__drop-shadow": true,
                "drop-shadow-list__drop-shadow__disabled": this.props.readOnly
            });

            return (
                <div className={dropShadowClasses}>
                    <ul>
                        <li className="formline">
                            <Gutter />
                            <ColorInput
                                id="drop-shadow"
                                context={collection.pluck(this.props.document.layers.selected, "id")}
                                title={strings.TOOLTIPS.SET_DROP_SHADOW_COLOR}
                                editable={!this.props.readOnly}
                                defaultValue={downsample.colors}
                                onChange={_.noop}
                                onClick={!this.props.readOnly ? _.noop : _.noop}
                            />
                            <Gutter />
                            <TextInput
                                value={collection.uniformValue(downsample.propStrings) || ""}
                                onChange={_.noop}
                                editable={!this.props.readOnly}
                                size="column-2"
                            />
                            <Gutter />
                            <ToggleButton
                                title={strings.TOOLTIPS.TOGGLE_DROP_SHADOW}
                                name="toggleDropShadowEnabled"
                                selected={downsample.enabledFlags}
                                onClick={!this.props.readOnly ? _.noop : _.noop}
                            />
                            <Gutter />
                        </li>
                    </ul>
                </div>
            );
        }
    });

    /**
     * DropShadowList Component maintains a set of dropShadows components for the selected Layer(s)
     */
    var DropShadowList = React.createClass({
        mixins: [FluxMixin],

        render: function () {
            //short circuit when no active document
            var document = this.props.document;
            if (!document) {
                return null;
            }

            var activeLayers = document.layers.selected,
                readOnly = true;

            // Group into arrays of dropShadows, by position in each layer
            var dropShadowGroups = collection.zip(collection.pluck(activeLayers, "dropShadows"));

            var dropShadowList = dropShadowGroups.map(function (dropShadows, index) {
                return (
                    <DropShadow {...this.props}
                        key={index}
                        index={index}
                        readOnly={readOnly} 
                        dropShadows={dropShadows} />
                );
            }, this);

            // Add a "new dropShadow" button if not read only
            var newButton = null;
            if (!readOnly && dropShadowGroups.size < 1) {
                newButton = (
                    <Button 
                        className="button-plus"
                        onClick = {_.noop}>
                        +
                    </Button>
                );
            }
            
            // Temporarily don't include drop shadow if there are none
            if (dropShadowList.size === 0) {
                return null;
            }

            return (
                <div className="dropShadow-list__container">
                    <header className="dropShadow-list__header sub-header">
                        <h3>
                            {strings.STYLE.DROP_SHADOW.TITLE}
                        </h3>
                        {newButton}
                    </header>
                    <div className="dropShadow-list__list-container">
                        {dropShadowList.toArray()}
                    </div>
                </div>
            );
        }
    });

    exports.DropShadow = DropShadow;
    exports.DropShadowList = DropShadowList;
});
