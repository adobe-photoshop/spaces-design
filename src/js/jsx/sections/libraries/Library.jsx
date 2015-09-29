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
        classnames = require("classnames"),
        _ = require("lodash");

    var os = require("adapter/os"),
        synchronization = require("js/util/synchronization"),
        strings = require("i18n!nls/strings"),
        ui = require("js/util/ui"),
        librariesAction = require("js/actions/libraries");

    var Graphic = require("jsx!./assets/Graphic"),
        Color = require("jsx!./assets/Color"),
        CharacterStyle = require("jsx!./assets/CharacterStyle"),
        LayerStyle = require("jsx!./assets/LayerStyle"),
        ColorTheme = require("jsx!./assets/ColorTheme"),
        Scrim = require("jsx!js/jsx/Scrim");

    /**
     * List of asset types in the CC libraries packge.
     *
     * @private
     * @const
     */
    var _ELEMENT_NAME_TO_TYPE_MAP = {
        "color": librariesAction.ELEMENT_COLOR_TYPE,
        "graphic": librariesAction.ELEMENT_GRAPHIC_TYPE,
        "characterstyle": librariesAction.ELEMENT_CHARACTERSTYLE_TYPE,
        "layerstyle": librariesAction.ELEMENT_LAYERSTYLE_TYPE,
        "brush": librariesAction.ELEMENT_BRUSH_TYPE,
        "colortheme": librariesAction.ELEMENT_COLORTHEME_TYPE
    };
    
    /**
     * Invert of _ELEMENT_NAME_TO_TYPE_MAP
     *
     * @private
     * @const
     */
    var _ELEMENT_TYPE_TO_NAME_MAP = _.invert(_ELEMENT_NAME_TO_TYPE_MAP);

    var Library = React.createClass({
        propTypes: {
            library: React.PropTypes.object.isRequired
        },
        
        /**
         * Store the last locally created element. Used to determine whether the library list should scroll 
         * to reveal the new element.
         * 
         * @type {AdobeLibraryElement}
         */
        lastLocallyCreatedElement: null,
        
        /**
         * Store the last locally updated graphic element and modified time. Used to determine whether the 
         * library list should scroll to reveal the updated graphic.
         * 
         * @type {AdobeLibraryElement}
         */
        lastLocallyUpdatedGraphic: null,
        lastLocallyUpdatedGraphicModified: null,

        getInitialState: function () {
            return {
                selectedElement: null,
                hasDraggedItem: false
            };
        },

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
            this._libraryLastModified = this.props.library.modified;
        },
        
        componentDidUpdate: function () {
            var scrollTo = function (element) {
                // Scroll to reveal the newly created element.
                var typeName = _ELEMENT_TYPE_TO_NAME_MAP[element.type],
                    sectionClass = "libraries__assets__" + typeName,
                    graphicsListEle = window.document.getElementsByClassName(sectionClass)[0];
                    
                graphicsListEle.scrollIntoView();
            };
            
            if (this.lastLocallyCreatedElement !== this.props.lastLocallyCreatedElement) {
                this.lastLocallyCreatedElement = this.props.lastLocallyCreatedElement;
                scrollTo(this.lastLocallyCreatedElement);
            }
            
            if (this.lastLocallyUpdatedGraphic &&
                (this.lastLocallyUpdatedGraphic !== this.props.lastLocallyUpdatedGraphic ||
                 this.lastLocallyUpdatedGraphicModified !== this.props.lastLocallyUpdatedGraphic.modified)) {
                this.lastLocallyUpdatedGraphic = this.props.lastLocallyUpdatedGraphic;
                this.lastLocallyUpdatedGraphicModified = this.props.lastLocallyUpdatedGraphic.modified;
                
                if (this.lastLocallyUpdatedGraphic.library === this.props.library) {
                    scrollTo(this.lastLocallyUpdatedGraphic);
                }
            }
        },
        
        shouldComponentUpdate: function (nextProps, nextState) {
            // Library's modified time reflects itself and its elements, so there is no need to check its element's 
            // modified time.
            return this.props.library !== nextProps.library ||
                this._libraryLastModified !== nextProps.library.modified ||
                !_.isEqual(this.state, nextState);
        },
        
        componentWillUpdate: function () {
            this._libraryLastModified = this.props.library.modified;
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
         * Handle drag start event of graphic asset.
         *
         * @private
         */
        _handleDragStart: function () {
            // If user is dragging any asset, we set "hasDraggedItem" 
            // to true to prevent unexpected scrolling. 
            this.setState({ hasDraggedItem: true });
        },
        
        /**
         * Handle drag stop event of graphic asset.
         *
         * @private
         */
        _handleDragStop: function () {
            this.setState({ hasDraggedItem: false });
        },

        /**
         * Render asset components based on type.
         *
         * @private
         * @param {string} name
         * @param {string} title
         * @param {Component} AssetComponent
         * @return {?ReactComponent}
         */
        _renderAssets: function (name, title, AssetComponent) {
            var elements = this.props.library.getFilteredElements(_ELEMENT_NAME_TO_TYPE_MAP[name]);

            if (elements.length === 0) {
                return null;
            }

            var components;
            if (name === "brush") {
                var brushDescription = strings.LIBRARIES.BRUSHES_UNSUPPORTED;

                components = (<div className="libraries__asset-brush">{brushDescription}</div>);
            } else {
                components = elements
                    .sort(function (a, b) { return b.modified - a.modified; })
                    .map(function (element) {
                        return React.createElement(AssetComponent, {
                            key: element.id,
                            element: element,
                            keyObject: element,
                            zone: Scrim.DROPPABLE_ZONE,
                            onSelect: this._handleSelectElement,
                            selected: element === this.state.selectedElement,
                            onDragStart: this._handleDragStart,
                            onDragStop: this._handleDragStop
                        });
                    }.bind(this));
            }
            
            var classNames = "libraries__assets libraries__assets__" + name;

            return (
                <div className={classNames}>
                    <div className="libraries__assets__title">
                        {title}
                    </div>
                    {components}
                </div>
            );
        },

        /**
         * Handle select element event. Element will be unselect if already selected.
         *
         * @private
         */
        _handleSelectElement: function (element) {
            this.setState({
                selectedElement: this.state.selectedElement === element ? null : element
            });
        },

        /** @ignore */
        _getLibraryItems: function () {
            if (!this.props.library) {
                return null;
            }

            var elements = this._getColorAssets(this.props.library);

            return elements;
        },
        
        /**
         * Handle click on list background.
         * 
         * @private
         */
        _handleClick: function () {
            this.setState({ selectedElement: null });
        },

        render: function () {
            var library = this.props.library;

            if (!library || library.elements.length === 0) {
                return (
                    <div className="libraries__content panel__info">
                        <div className="panel__info__title">
                            {strings.LIBRARIES.INTRO_TITLE}
                        </div>
                        <div className="panel__info__body">
                            {strings.LIBRARIES.INTRO_BODY}
                        </div>
                        <div className="panel__info__link">
                            <a href="#" onClick={ui.openURL.bind(null, strings.LIBRARIES.INTRO_URL)}>
                                {strings.LIBRARIES.INTRO_LINK_TITLE}
                            </a>
                        </div>
                    </div>
                );
            }

            var colorAssets = this._renderAssets("color", strings.LIBRARIES.COLORS, Color),
                colorThemeAssets = this._renderAssets("colortheme", strings.LIBRARIES.COLOR_THEMES, ColorTheme),
                charStyleAssets = this._renderAssets("characterstyle", strings.LIBRARIES.CHAR_STYLES, CharacterStyle),
                layerStyleAssets = this._renderAssets("layerstyle", strings.LIBRARIES.LAYER_STYLES, LayerStyle),
                graphicAssets = this._renderAssets("graphic", strings.LIBRARIES.GRAPHICS, Graphic),
                brushAssets = this._renderAssets("brush", strings.LIBRARIES.BRUSHES);
            
            var classNames = classnames("libraries__content", {
                "libraries__content-drag": this.state.hasDraggedItem
            });

            return (
                <div className={classNames}
                     onClick={this._handleClick}>
                    {colorAssets}
                    {colorThemeAssets}
                    {charStyleAssets}
                    {layerStyleAssets}
                    {graphicAssets}
                    {brushAssets}
                </div>
            );
        }
    });

    module.exports = Library;
});
