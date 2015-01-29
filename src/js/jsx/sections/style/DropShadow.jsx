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
        _ = require("lodash");

    var Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection"),
        synchronization = require("js/util/synchronization");

    /**
     * DropShadow Component displays information of a single dropShadow for a given layer or 
     * set of layers.
     */
    var DropShadow = React.createClass({
        mixins: [FluxMixin],

        /**
         * A debounced version of actions
         * 
         * @type {?function}
         */
        _setColorDebounced: null,
        _setXDebounced: null,
        _setYDebounced: null,
        _setBlurDebounced: null,
        _setSpreadDebounced: null,

        componentWillMount: function() {
            this._setColorDebounced = synchronization.debounce(this.getFlux().actions.layerEffects.setDropShadowColor);
            this._setXDebounced = synchronization.debounce(this.getFlux().actions.layerEffects.setDropShadowX);
            this._setYDebounced = synchronization.debounce(this.getFlux().actions.layerEffects.setDropShadowY);
            this._setBlurDebounced = synchronization.debounce(this.getFlux().actions.layerEffects.setDropShadowBlur);
            this._setSpreadDebounced = 
                synchronization.debounce(this.getFlux().actions.layerEffects.setDropShadowSpread);
        },

        /**
         * Handle the change of the Drop Shadow color
         *
         * @private
         * @param {Color} color new drop shadow color
         */
        _colorChanged: function (color) {
            this._setColorDebounced(this.props.document, this.props.document.layers.selected, this.props.index, color);
        },

        /**
         * Handle the change of the Drop Shadow x coordinate
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {x} x new drop shadow x coordinate
         */
        _xChanged: function (event, x) {
            this._setXDebounced(this.props.document, this.props.document.layers.selected, this.props.index, x);
        },

        /**
         * Handle the change of the Drop Shadow y coordinate
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {y} y new drop shadow y coordinate
         */
        _yChanged: function (event, y) {
            this._setYDebounced(this.props.document, this.props.document.layers.selected, this.props.index, y);
        },

        /**
         * Handle the change of the Drop Shadow blur value in pixels
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {blur} blur new drop shadow blur value in pixels
         */
        _blurChanged: function (event, blur) {
            this._setBlurDebounced(this.props.document, this.props.document.layers.selected, this.props.index, blur);
        },

        /**
         * Handle the change of the Drop Shadow spread value in pixels
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {spread} spread new drop shadow spread value in pixels
         */
        _spreadChanged: function (event, spread) {
            this._setSpreadDebounced(
                this.props.document, this.props.document.layers.selected, this.props.index, spread);
        },

        /**
         * Handle the change of the Drop Shadow enabled state
         *
         * @param {SyntheticEvent} event
         * @param {boolean} enabled new enabled state
         */
        _enabledChanged: function (event, enabled) {
            this.getFlux().actions.layerEffects.setDropShadowEnabled(
                this.props.document, this.props.document.layers.selected, this.props.index, enabled);
        },

        /**
         * Produce a set of arrays of separate dropShadow display properties, 
         * transformed and ready for the sub-components
         *
         * @private
         * @param {Array.<DropShadow>} dropShadows
         * @return {object}
         */
        _downsampleDropShadows: function (dropShadows) {
            return {
                colors: collection.pluck(dropShadows, "color"),
                enabledFlags: collection.pluck(dropShadows, "enabled"),
                xPositions: collection.pluck(dropShadows, "x"),
                yPositions: collection.pluck(dropShadows, "y"),
                blurs: collection.pluck(dropShadows, "blur"),
                spreads: collection.pluck(dropShadows, "spread")
            };
        },

        render: function () {
            var downsample = this._downsampleDropShadows(this.props.dropShadows);

            var dropShadowClasses = React.addons.classSet({
                "drop-shadow-list__drop-shadow": true,
                "drop-shadow-list__drop-shadow__disabled": this.props.readOnly
            });

            var dropShadowOverlay = function (colorTiny) {
                var dropShadowStyle = {
                };
                if (colorTiny) {
                    dropShadowStyle.WebkitBoxShadow = collection.uniformValue(downsample.xPositions, 5) + "px "
                                                    + collection.uniformValue(downsample.yPositions, 5) + "px "
                                                    + collection.uniformValue(downsample.blurs, 0) + "px "
                                                    + collection.uniformValue(downsample.spreads, 0) + "px "
                                                    + colorTiny.toRgbString();
                }

                return (
                    <div
                        className="drop-shadow__preview">
                        <div
                            className="drop-shadow__square"
                            style={dropShadowStyle}/>
                    </div>
                    );
            };

            return (
                <div className={dropShadowClasses}>
                        <div className="formline">
                            <Gutter />
                            <ColorInput
                                id="drop-shadow"
                                context={collection.pluck(this.props.document.layers.selected, "id")}
                                title={strings.TOOLTIPS.SET_DROP_SHADOW_COLOR}
                                editable={!this.props.readOnly}
                                defaultValue={downsample.colors}
                                onChange={this._colorChanged}
                                swatchOverlay={dropShadowOverlay}>
                            
                                <div className="compact-stats__body">
                                    <div className="compact-stats__body__column">
                                        <Label
                                            title={strings.TOOLTIPS.SET_DROP_SHADOW_X_POSITION}
                                            size="column-1">
                                            {strings.STYLE.DROP_SHADOW.X_POSITION}
                                        </Label>
                                        <NumberInput
                                            value={downsample.xPositions}
                                            onChange={this._xChanged}
                                            disabled={this.props.readOnly}
                                            size="column-3" />
                                    </div>
                                    <div className="compact-stats__body__column">
                                        <Label
                                            title={strings.TOOLTIPS.SET_DROP_SHADOW_Y_POSITION}
                                            size="column-1">
                                            {strings.STYLE.DROP_SHADOW.Y_POSITION}
                                        </Label>
                                        <NumberInput
                                            value={downsample.yPositions}
                                            onChange={this._yChanged}
                                            disabled={this.props.readOnly}
                                            size="column-3" />
                                    </div>
                                    <div className="compact-stats__body__column">
                                        <Label
                                            title={strings.TOOLTIPS.SET_DROP_SHADOW_BLUR}
                                            size="column-2">
                                            {strings.STYLE.DROP_SHADOW.BLUR}
                                        </Label>
                                        <NumberInput
                                            value={downsample.blurs}
                                            onChange={this._blurChanged}
                                            disabled={this.props.readOnly}
                                            size="column-3" />
                                    </div>
                                    <div className="compact-stats__body__column">
                                        <Label
                                            title={strings.TOOLTIPS.SET_DROP_SHADOW_SPREAD}
                                            size="column-4">
                                            {strings.STYLE.DROP_SHADOW.SPREAD}
                                        </Label>
                                        <NumberInput
                                            value={downsample.spreads}
                                            onChange={this._spreadChanged}
                                            disabled={this.props.readOnly}
                                            size="column-3" />
                                    </div>
                                </div>
                            </ColorInput>
                            <Gutter />
                            <ToggleButton
                                title={strings.TOOLTIPS.TOGGLE_DROP_SHADOW}
                                name="toggleDropShadowEnabled"
                                buttonType="layer-visibility"
                                selected={downsample.enabledFlags}
                                onClick={!this.props.readOnly ? this._enabledChanged : _.noop}
                            />
                            <Gutter />
                        </div>
                </div>
            );
        }
    });

    /**
     * DropShadowList Component maintains a set of dropShadows components for the selected Layer(s)
     */
    var DropShadowList = React.createClass({
        mixins: [FluxMixin],

        /**
         * Handle a NEW Drop Shadow
         *
         * @private
         */
        _addDropShadow: function () {
            this.getFlux().actions.layerEffects.addDropShadow(this.props.document, this.props.document.layers.selected);
        },

        render: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            if (layers.isEmpty()) {
                return null;
            }

            // Group into arrays of dropShadows, by position in each layer
            var dropShadowGroups = collection.zip(collection.pluck(layers, "dropShadows")),
                readOnly = document.layers.selectedLocked,
                dropShadowList = dropShadowGroups.map(function (dropShadows, index) {
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
            if (!readOnly && dropShadowGroups.isEmpty()) {
                newButton = (
                    <Button 
                        className="button-plus"
                        onClick = {this._addDropShadow}>
                        +
                    </Button>
                );
            }

            return (
                <div className="dropShadow-list__container">
                    <header className="dropShadow-list__header sub-header">
                        <h3>
                            {strings.STYLE.DROP_SHADOW.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule"/>
                        <Gutter />
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
