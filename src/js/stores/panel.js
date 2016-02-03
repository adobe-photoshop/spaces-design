/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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
    
    var Fluxxor = require("fluxxor"),
        _ = require("lodash");
    
    var events = require("../events"),
        log = require("js/util/log");

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
         * Flag to tell whether Scrim should draw any of the SVG overlays or not
         *
         * @private
         * @type {boolean}
         */
        _overlaysEnabled: null,

        /**
         * A count of current number of requests to disable the overlays.
         *
         * @private
         * @type {number}
         */
        _overlayCount: 0,

        /**
         * Flag to tell if the scrim should be drawing a marquee
         *
         * @private
         * @type {boolean}
         */
        _marqueeEnabled: null,

        /**
         * Marquee start location
         *
         * @private
         * @type {{x: number, y: number}}
         */
        _marqueeStart: null,

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

        /**
         * Reference point for a layer when adjusting W and H
         * Default is "lt" for left, top
         *
         * @private
         * @type {string}
         */
        _referencePoint: null,

        /**
         * UI color stop. Must be one of "ORIGINAL", "LIGHT", "MEDIUM" or "DARK".
         *
         * @private
         * @type {string}
         */
        _colorStop: null,

        /**
         * The coordinates of the current mouse position if it's being tracked; otherwise null.
         *
         * @private
         * @type {?{currentMouseX: number, currentMouseY: number}}
         */
        _currentMousePosition: null,

        /**
         * A bound, debounced version of _setOverlays,
         *
         * @type {function}
         */
        _enableOverlaysDebounced: null,

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.panel.PANELS_RESIZED, this._handlePanelResize,
                events.panel.SUPERSELECT_MARQUEE, this._handleMarqueeStart,
                events.panel.REFERENCE_POINT_CHANGED, this._handleReferencePointChanged,
                events.panel.COLOR_STOP_CHANGED, this._handleColorStopChanged,
                events.panel.MOUSE_POSITION_CHANGED, this._handleMousePositionChanged,
                events.panel.START_CANVAS_UPDATE, this._handleStartCanvasUpdate,
                events.panel.END_CANVAS_UPDATE, this._handleEndCanvasUpdate
            );

            this._enableOverlaysDebounced = _.debounce(this._setOverlays.bind(this), 100);

            // HACK: Do not reset panel sizes because they should remain constant.
            this._panelWidth = 0;
            this._columnCount = 0;
            this._iconBarWidth = 0;
            this._headerHeight = 0;
            this._toolbarWidth = 0;

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._overlayCount = 0;
            this._overlaysEnabled = true;
            this._marqueeEnabled = false;
            this._marqueeStart = null;
            this._referencePoint = "lt";
            this._colorStop = null;
            this._currentMousePosition = null;
        },
        
        /** @ignore */
        getState: function () {
            return {
                centerOffsets: this.getCenterOffsets(),
                overlaysEnabled: this._overlaysEnabled,
                marqueeEnabled: this._marqueeEnabled,
                marqueeStart: this._marqueeStart,
                referencePoint: this._referencePoint
            };
        },
        
        /**
         * Calculate the overlay offsets, optionally taking into account a
         * (future) number of open columns.
         *
         * @return {{top: number, right: number, bottom: number, left: number}}
         */
        getCenterOffsets: function (columns) {
            var preferences = this.flux.store("preferences").getState(),
                singleColumn = preferences.get("singleColumnModeEnabled", false),
                right = (columns !== undefined && singleColumn) ? 0 :
                    this._iconBarWidth;

            if (singleColumn) {
                right += this._panelWidth;
            } else if (columns === undefined || columns === this._columnCount) {
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
        },

        /**
         * Update the overlaysEnabled property based on the current overlayCount.
         *
         * @private
         */
        _setOverlays: function () {
            var nextEnabled = this._overlayCount === 0;

            if (nextEnabled !== this._overlaysEnabled) {
                this._overlaysEnabled = nextEnabled;
                this.emit("change");
            }
        },

        /**
         * Increase the overlay count and immediately update overlaysEnabled
         * when starting a canvas update.
         *
         * @private
         */
        _handleStartCanvasUpdate: function () {
            this._overlayCount++;
            this._setOverlays();
            this._enableOverlaysDebounced.cancel();
        },

        /**
         * Decrease the overlay count and update overlaysEnabled once the
         * overlay count has quiesced.
         *
         * @private
         */
        _handleEndCanvasUpdate: function () {
            if (this._overlayCount === 0) {
                return;
            }

            this._overlayCount--;
            this._enableOverlaysDebounced();
        },

        /**
         * Updates the marquee start location and flag
         *
         * @param {{x: number, y: number, enabled: boolean}} payload
         */
        _handleMarqueeStart: function (payload) {
            this._marqueeEnabled = payload.enabled;
            this._marqueeStart = payload.enabled ? {
                x: payload.x,
                y: payload.y
            } : null;
            
            this.emit("change");
        },

        /**
         * Set the size-adjustment reference point.
         *
         * @private
         * @param {{referencePoint: string}} payload
         */
        _handleReferencePointChanged: function (payload) {
            this._referencePoint = payload.referencePoint;
            this.emit("change");
        },

        /**
         * Set the UI color stop.
         *
         * @private
         * @param {{stop: string}} payload
         */
        _handleColorStopChanged: function (payload) {
            this._colorStop = payload.stop;
            this.emit("change");
        },

        /**
         * Update the current mouse position.
         *
         * @private
         * @param {?{currentMouseX: number, currentMouseY: number}} payload
         */
        _handleMousePositionChanged: function (payload) {
            this._currentMousePosition = payload;
        },

        /**
         * Get the current mouse position if it's being tracked; otherwise null.
         * 
         * @return {?{currentMouseX: number, currentMouseY: number}}
         */
        getCurrentMousePosition: function () {
            return this._currentMousePosition;
        },

        /**
         * Get the current UI color stop.
         *
         * @return {?string} An element of the enum appLib.colorStops
         */
        getColorStop: function () {
            return this._colorStop;
        }
    });

    module.exports = PanelStore;
});
