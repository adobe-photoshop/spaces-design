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
    
    var Fluxxor = require("fluxxor");
    
    var events = require("../events"),
        log = require("js/util/log"),
        math = require("js/util/math");

    /**
     * Panel/column identifiers.
     *
     * @const
     * @type {object}
     */
    var UI_COMPONENTS = Object.freeze({
        LAYERS_LIBRARY_COL: "layersLibrariesVisible",
        PROPERTIES_COL: "propertiesVisible",
        TRANSFORM_PANEL: "transformVisible",
        STYLES_PANEL: "stylesVisible",
        APPEARANCE_PANEL: "appearanceVisible",
        EFFECTS_PANEL: "effectsVisible",
        EXPORT_PANEL: "exportVisible",
        LAYERS_PANEL: "layersVisible",
        LIBRARIES_PANEL: "libraryVisible"
    });

    var PanelStore = Fluxxor.createStore({
        /**
         * Panel set width
         *
         * @private
         * @type {number}
         */
        _panelWidth: null,

        /**
         * Icon bar width
         *
         * @private
         * @type {number}
         */
        _iconBarWidth: null,
        
        /**
         * Document header height
         *
         * @private
         * @type {number}
         */
        _headerHeight: null,
        
        /**
         * Toolbar width, 0 if it's not pinned
         *
         * @private
         * @type {number}
         */
        _toolbarWidth: null,

        /**
         * Constants used to refer to different panels/columns.
         * 
         * @const
         * @type {object}
         */
        components: UI_COMPONENTS,

        initialize: function () {
            this.bindActions(
                events.ui.PANELS_RESIZED, this._handlePanelResize,
            );

            // HACK: Do not reset panel sizes because they should remain constant.
            this._panelWidth = 0;
            this._columnCount = 0;
            this._iconBarWidth = 0;
            this._headerHeight = 0;
            this._toolbarWidth = 0;
        },

        /** @ignore */
        getState: function () {
            return {
                centerOffsets: this.getCenterOffsets(),
            };
        },
        
        /**
         * Calculate the overlay offsets, optionally taking into account a
         * (future) number of open columns.
         *
         * @param {number=} columns
         * @return {{top: number, right: number, bottom: number, left: number}}
         */
        getCenterOffsets: function (columns) {
            var preferences = this.flux.store("preferences").getState(),
                singleColumn = preferences.get("singleColumnModeEnabled", false),
                right = (columns !== undefined && singleColumn) ? 0 :
                    this._iconBarWidth;

            if (columns === undefined || columns === this._columnCount) {
                right += this._panelWidth;
            } else if (columns > 0) {
                if (columns === 1 && this._columnCount === 2) {
                    right += (this._panelWidth / 2);
                } else if (columns === 2 && this._columnCount === 1) {
                    right += (this._panelWidth * 2);
                } else {
                    log.warn("Unable to infer enter offsets for " + columns +
                        " columns from " + this._columnCount);
                }
            }

            return {
                top: this._headerHeight,
                right: right,
                left: this._toolbarWidth,
                bottom: 0
            };
        },

        /**
         * Get the current cloaking rectangle, which omits the static UI.
         *
         * @return {?{top: number, right: number, left: number, bottom: number}}
         */
        getCloakRect: function () {
            var centerOffsets = this.getCenterOffsets(),
                windowWidth = window.document.body.clientWidth,
                windowHeight = window.document.body.clientHeight;
            
            return {
                left: centerOffsets.left,
                top: centerOffsets.top,
                bottom: windowHeight - centerOffsets.bottom,
                right: windowWidth - centerOffsets.right
            };
        },

        /**
         * Updates the center offsets when they change.
         *
         * @private
         * @param {{panelWidth: number=, headerHeight: number=, toolbarWidth: number=}} payload
         */
        _handlePanelResize: function (payload) {
            var changed;
            if (payload.hasOwnProperty("panelWidth") && payload.panelWidth !== this._panelWidth) {
                this._panelWidth = payload.panelWidth;
                changed = true;
            }

            if (payload.hasOwnProperty("columnCount") && payload.columnCount !== this._columnCount) {
                this._columnCount = payload.columnCount;
                changed = true;
            }

            if (payload.hasOwnProperty("iconBarWidth") && payload.iconBarWidth !== this._iconBarWidth) {
                this._iconBarWidth = payload.iconBarWidth;
                changed = true;
            }

            if (payload.hasOwnProperty("headerHeight") && payload.headerHeight !== this._headerHeight) {
                this._headerHeight = payload.headerHeight;
                changed = true;
            }

            if (payload.hasOwnProperty("toolbarWidth") && payload.toolbarWidth !== this._toolbarWidth) {
                this._toolbarWidth = payload.toolbarWidth;
                changed = true;
            }

            if (changed) {
                this.emit("change");
            }
        }
    });

    module.exports = PanelStore;
});
