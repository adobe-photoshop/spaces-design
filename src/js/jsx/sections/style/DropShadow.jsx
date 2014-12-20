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
        FluxMixin = Fluxxor.FluxMixin(React);

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Button = require("jsx!js/jsx/shared/Button"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        ColorPicker = require("jsx!js/jsx/shared/ColorPicker"),
        strings = require("i18n!nls/strings"),
        collectionUtil = require("js/util/collection"),
        _ = require("lodash");

    /**
     * Return a default color object for new dropShadows
     *
     * @private
     * @return {Color}
     */
    var _getDefaultColor = function() {
        return {r: 0, g: 0, b: 0, a: 1};
    };   

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
            if (_.size(dropShadows) === 0) {
                return {};
            }
            return dropShadows.reduce(function (downsample, dropShadow) {
                    if (!_.isEmpty(dropShadow)) {
                        downsample.colors.push(dropShadow.color);
                        downsample.propString.push(
                            [dropShadow.x, dropShadow.y, dropShadow.blur, dropShadow.spread].join(","));
                        downsample.enabledFlags.push(dropShadow.enabled);
                    } else {
                        downsample.colors.push(null);
                        downsample.propString.push(null);
                        downsample.enabledFlags.push(false);
                    }
                    return downsample;
                },
                {
                    colors : [],
                    propString : [],
                    enabledFlags : []
                }
            );
            
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
                                title={strings.TOOLTIPS.SET_DROP_SHADOW_COLOR}
                                editable={!this.props.readOnly}
                                defaultColor={downsample.colors}
                                onChange={this._colorChanged}
                                onClick={!this.props.readOnly ? _.noop : _.noop}
                            />
                            <Dialog ref="dialog"
                                id="colorpicker-dropShadow"
                                dismissOnDocumentChange
                                dismissOnSelectionTypeChange
                                dismissOnWindowClick>
                                <ColorPicker
                                    color={_.size(downsample.colors) > 0 && downsample.colors[0] || _getDefaultColor()}
                                    onChange={_.noop.bind(this, null)} />
                            </Dialog>
                            <Gutter />
                            <TextInput
                                value={collectionUtil.uniformValue(downsample.propString) || ""}
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
            if (!this.props.document) {
                return null;
            }

            var activeLayers = this.props.layers,
                readOnly = true;

            // Group into arrays of dropShadows, by position in each layer
            var dropShadowGroups = _.zip(_.pluck(activeLayers, "dropShadows"));

            var dropShadowList = _.map(dropShadowGroups, function (dropShadows, index) {
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
            if (!readOnly && _.size(dropShadowGroups) < 1) {
                newButton = (
                    <Button 
                        className="button-plus"
                        onClick = {_.noop}>
                        +
                    </Button>
                );
            }
            
            // Temporarily don't include drop shadow if there are none
            if (dropShadowList.length === 0) {
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
                        {dropShadowList}
                    </div>
                </div>
            );
        }
    });

    exports.DropShadow = DropShadow;
    exports.DropShadowList = DropShadowList;
});
