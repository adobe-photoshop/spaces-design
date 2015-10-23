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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Immutable = require("immutable"),
        _ = require("lodash"),
        classnames = require("classnames");

    var os = require("adapter/os");

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        Dialog = require("jsx!js/jsx/shared/Dialog"),
        DropShadowList = require("jsx!./ShadowList").DropShadowList,
        InnerShadowList = require("jsx!./ShadowList").InnerShadowList,
        ColorOverlayList = require("jsx!./ColorOverlayList"),
        StrokeList = require("jsx!./StrokeList"),
        LayerEffect = require("js/models/effects/layereffect"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection"),
        headlights = require("js/util/headlights"),
        synchronization = require("js/util/synchronization"),
        UnsupportedEffectList = require("jsx!./UnsupportedEffectList");

    /**
     * @const
     * @type {number} The maximum allowed number of effects of a given kind per layer
     */
    var MAX_EFFECT_COUNT = 10;

    var EffectsPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("style")],

        /**
         * A throttled version of os.setTooltip
         *
         * @type {?function}
         */
        _setTooltipThrottled: null,

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
        },

        /**
         * Selects the content of the input on focus.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleFocus: function (event) {
            event.target.scrollIntoViewIfNeeded();
            if (this.props.onFocus) {
                this.props.onFocus(event);
            }
        },

        /**
         * Handler which stops propagation of the given event
         *
         * @private
         * @param {Event} event
         */
        _blockInput: function (event) {
            event.stopPropagation();
        },

        shouldComponentUpdate: function (nextProps) {
            if (this.props.disabled !== nextProps.disabled ||
                this.props.active !== nextProps.active) {
                return true;
            }

            if (!Immutable.is(this.props.document.layers.selected,
                nextProps.document.layers.selected)) {
                return true;
            }

            if (!nextProps.visible && !this.props.visible) {
                return false;
            }

            return true;
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                styleStore = flux.store("style"),
                clipboardEffects = styleStore.getClipboardEffects();

            return {
                clipboard: clipboardEffects
            };
        },

        /**
         * Workaround a CEF bug by clearing any active tooltips when scrolling.
         * More details here: https://github.com/adobe-photoshop/spaces-design/issues/444
         *
         * @private
         */
        _handleScroll: function () {
            this._setTooltipThrottled("");
        },

        /**
         * If currently invisible, force to visible by calling the parent's onVisibilityToggle
         */
        _forceVisible: function () {
            if (!this.props.visible && this.props.onVisibilityToggle) {
                this.props.onVisibilityToggle();
            }
        },

        /**
         * Calls action to copy currently selected layer's style
         * 
         * @private
         */
        _handleStyleCopy: function (event) {
            var document = this.props.document,
                source = document.layers.selected.first();

            this.getFlux().actions.sampler.copyLayerEffects(document, source);
            event.stopPropagation();
            headlights.logEvent("tools", "sampler", "copy-all-effects");
        },

        /**
         * Calls action to paste the clipboard style to selected layers
         *
         * @private
         */
        _handleStylePaste: function (event) {
            var document = this.props.document,
                targetLayers = this.props.document.layers.selected;

            this.getFlux().actions.sampler.pasteLayerEffects(document, targetLayers);
            event.stopPropagation();
            headlights.logEvent("tools", "sampler", "paste-all-effects");
        },

        /**
         * Toggles Effect Popover
         *
         * @param {Event} event
         */
        _toggleEffectPopover: function (event) {
            var dialog = this.refs.dialog;
            dialog.toggle(event);
        },

        /**
         * Adds a new effect based on selection from list
         *
         * @param {string} effectType for new effect to be added        
         * @param {Event} event
         */
        _handleEffectListClick: function (effectType, event) {
            var dialog = this.refs.dialog,
                layers = this.props.document.layers.selected;

            dialog.toggle(event);
            this._forceVisible();
            this.getFlux().actions.layerEffects.addEffect(this.props.document, layers, effectType);

            headlights.logEvent("effect", "create", _.kebabCase(effectType));
        },
        
        /**
         * True if user can add new effect to the selected layers.
         *
         * @private
         * @param {string} effectName - accept: strokeEffects, colorOverlays, innerShadows, dropShadows
         * @return {boolean}
         */
        _canAddEffect: function (effectName) {
            var effects = collection.pluck(this.props.document.layers.selected, effectName);
            
            // Return false if any of the selected layers reach maximum effect count.
            return collection.zip(effects).size < MAX_EFFECT_COUNT;
        },
        
        render: function () {
            if (this.props.document.layers.selected.isEmpty()) {
                return null;
            }
            
            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "effects": true,
                "section": true,
                "section__active": this.props.active,
                "section__collapsed": !this.props.visible,
                "section__sibling-collapsed": !this.props.visibleSibling,
                "section__expand": this.props.shouldPanelGrow
            });

            var selectedLayers = this.props.document ? this.props.document.layers.selected : new Immutable.List(),
                hasBackgroundLayer = selectedLayers.some(function (l) { return l.isBackground; }),
                addStyleDisabled = this.props.disabled || hasBackgroundLayer || selectedLayers.size === 0,
                copyStyleDisabled = this.props.disabled || hasBackgroundLayer || selectedLayers.size !== 1,
                pasteStyleDisabled = this.props.disabled || hasBackgroundLayer ||
                    !(this.state.clipboard && selectedLayers.size > 0),
                addStyleClasses = classnames({
                    "style-button": true,
                    "style-button__disabled": addStyleDisabled
                }),
                copyStyleClasses = classnames({
                    "style-button": true,
                    "style-button__disabled": copyStyleDisabled
                }),
                pasteStyleClasses = classnames({
                    "style-button": true,
                    "style-button__disabled": pasteStyleDisabled
                });

            var containerContents = this.props.document && this.props.visible && !this.props.disabled && (
                <div>
                    <StrokeList
                        document={this.props.document}
                        layers={this.props.document.layers.selected}
                        disabled={this.props.disabled}/>
                    <ColorOverlayList
                        document={this.props.document}
                        layers={this.props.document.layers.selected}
                        disabled={this.props.disabled}/>
                    <InnerShadowList {...this.props}
                        onFocus={this._handleFocus}/>
                    <DropShadowList {...this.props}
                        onFocus={this._handleFocus}/>
                    <UnsupportedEffectList
                        document={this.props.document}
                        layers={this.props.document.layers.selected}
                        disabled={this.props.disabled}/>
                </div>
            );
            
            var canAddStroke = this._canAddEffect("strokeEffects"),
                canAddColorOverlay = this._canAddEffect("colorOverlays"),
                canAddInnerShadow = this._canAddEffect("innerShadows"),
                canAddDropShadow = this._canAddEffect("dropShadows"),
                strokeMenuClasses = classnames("popover-list__item",
                    { "popover-list__item-disabled": !canAddStroke }),
                colorOverlayMenuClasses = classnames("popover-list__item",
                    { "popover-list__item-disabled": !canAddColorOverlay }),
                innerShadowMenuClasses = classnames("popover-list__item",
                    { "popover-list__item-disabled": !canAddInnerShadow }),
                dropShadowMenuClasses = classnames("popover-list__item",
                    { "popover-list__item-disabled": !canAddDropShadow });

            return (
                <section
                    className={sectionClasses}
                    onScroll={this._handleScroll}>
                    <TitleHeader
                        title={strings.TITLE_EFFECTS}
                        visible={this.props.visible}
                        disabled={this.props.disabled}
                        onDoubleClick={this.props.onVisibilityToggle}>
                        <div className="workflow-buttons"
                            onDoubleClick={this._blockInput}>
                            <Button
                                className={addStyleClasses}
                                title={strings.TOOLTIPS.ADD_EFFECT}
                                disabled={addStyleDisabled}
                                onClick={this._toggleEffectPopover}>
                                <SVGIcon
                                    CSSID="add-new" />
                            </Button>
                            <Button
                                className={copyStyleClasses}
                                title={strings.STYLE.COPY}
                                disabled={copyStyleDisabled}
                                onClick={this._handleStyleCopy}>
                                <SVGIcon
                                    viewbox="0 0 24 24"
                                    CSSID="style-copy" />
                            </Button>
                            <Button
                                className={pasteStyleClasses}
                                title={strings.STYLE.PASTE}
                                disabled={pasteStyleDisabled}
                                onClick={this._handleStylePaste}>
                                <SVGIcon
                                    viewbox="0 0 24 24"
                                    CSSID="style-paste" />
                            </Button>
                        </div>
                    </TitleHeader>
                    <div className={containerClasses}>
                        {containerContents}
                    </div>
                    <Dialog
                        ref="dialog"
                        id={"effects-popover-" + this.props.document.id}
                        className={"dialog-effects-popover"}>
                        <ul className="popover-list">
                            <li className={strokeMenuClasses}
                                onClick={canAddStroke &&
                                    this._handleEffectListClick.bind(this, LayerEffect.STROKE)}>
                                {strings.STYLE.STROKE_EFFECT.TITLE_SINGLE}
                            </li>
                            <li className={colorOverlayMenuClasses}
                                onClick={canAddColorOverlay &&
                                    this._handleEffectListClick.bind(this, LayerEffect.COLOR_OVERLAY)}>
                                {strings.STYLE.COLOR_OVERLAY.TITLE_SINGLE}
                            </li>
                            <li className={innerShadowMenuClasses}
                                onClick={canAddInnerShadow &&
                                    this._handleEffectListClick.bind(this, LayerEffect.INNER_SHADOW)}>
                                {strings.STYLE.INNER_SHADOW.TITLE_SINGLE}
                            </li>
                            <li className={dropShadowMenuClasses}
                                onClick={canAddDropShadow &&
                                    this._handleEffectListClick.bind(this, LayerEffect.DROP_SHADOW)}>
                                {strings.STYLE.DROP_SHADOW.TITLE_SINGLE}
                            </li>
                        </ul>
                    </Dialog>
                </section>
            );
        }
    });

    module.exports = EffectsPanel;
});
