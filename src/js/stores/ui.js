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

    var UIStore = Fluxxor.createStore({

        /**
         * The current window-to-canvas transform represented as a 2d matrix
         *
         * @private
         * @type {?Array.<number>}
         */
        _transformMatrix: null,

        /**
         * The current canvas-to-window transform represented as a 2d matrix
         *
         * @private
         * @type {?Array.<number>}
         */
        _inverseTransformMatrix: null,

        /**
         * Current zoom factor
         *
         * @private
         * @type {Number}
         */
        _zoom: null,

        /**
         * Flag to tell whether Scrim should draw any of the SVG overlays or not
         *
         * @private
         * @type {boolean}
         */
        _overlaysEnabled: null,

        /**
         * Current root font size, which is used to calculated rem units
         *
         * @private
         * @type {number}
         */
        _rootSize: null,

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

        _referencePoint: null,

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.ui.TRANSFORM_UPDATED, this._transformUpdated,
                events.ui.PANELS_RESIZED, this._handlePanelResize,
                events.ui.SUPERSELECT_MARQUEE, this._handleMarqueeStart,
                events.ui.TOGGLE_OVERLAYS, this._handleOverlayToggle,
                events.ui.REFERENCE_POINT_CHANGED, this._handleReferencePointChanged,
                events.document.DOCUMENT_UPDATED, this._handleLayersUpdated,
                events.document.RESET_LAYERS, this._handleLayersUpdated,
                events.document.RESET_BOUNDS, this._handleLayersUpdated,
                events.document.history.nonOptimistic.RESET_BOUNDS, this._handleLayersUpdated
            );

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
            this._setRootSize();
            this._overlaysEnabled = true;
            this._marqueeEnabled = false;
            this._marqueeStart = null;
            this._zoom = null;
            this._transformMatrix = null;
            this._inverseTransformMatrix = null;
            this._referencePoint = "a";
        },
        
        /** @ignore */
        getState: function () {
            return {
                transformMatrix: this._transformMatrix,
                inverseTransformMatrix: this._inverseTransformMatrix,
                zoomFactor: this._zoom,
                centerOffsets: this.getCenterOffsets(),
                overlaysEnabled: this._overlaysEnabled,
                marqueeEnabled: this._marqueeEnabled,
                marqueeStart: this._marqueeStart,
                referencePoint: this._referencePoint
            };
        },

        getReferencePoint: function () {
            return {
                referencePoint: this._referencePoint
            };
        },
        
        /** @ignore */
        zoomWindowToCanvas: function (x) {
            return x * this._zoom;
        },

        /** @ignore */
        zoomCanvasToWindow: function (x) {
            return x / this._zoom;
        },

        /**
         * Map (x,y) coordinates in window space to canvas space.
         *
         * @private
         * @param {number} x Offset from the left window edge
         * @param {number} y Offset from the top window edge
         * @return {{x: number, y: number}} A point that describes the offset
         *  from the top-left corner of the canvas.
         */
        transformWindowToCanvas: function (x, y) {
            if (!this._transformMatrix) {
                return {
                    x: 0,
                    y: 0
                };
            }
            var transform = this._transformMatrix,
                xx = transform[0],
                yx = transform[1],
                xy = transform[2],
                yy = transform[3],
                x0 = transform[4],
                y0 = transform[5];

            var xt = xx * x + yx * y + x0,
                yt = xy * x + yy * y + y0;

            return {
                x: xt,
                y: yt
            };
        },

        /**
         * Map (x,y) coordinates in canvas space to window space.
         *
         * @private
         * @param {number} x Offset from the left canvas edge
         * @param {number} y Offset from the top canvas edge
         * @return {{x: number, y: number}} A point that describes the offset
         *  from the top-left corner of the window.
         */
        transformCanvasToWindow: function (x, y) {
            if (!this._inverseTransformMatrix) {
                return {
                    x: 0,
                    y: 0
                };
            }
            var transform = this._inverseTransformMatrix,
                xx = transform[0],
                yx = transform[1],
                xy = transform[2],
                yy = transform[3],
                x0 = transform[4],
                y0 = transform[5];

            var xt = xx * x + xy * y + x0,
                yt = yx * x + yy * y + y0;

            return {
                x: xt,
                y: yt
            };
        },

        /**
         * Calculate the overlay offsets, optionally taking into account a
         * (future) number of open columns.
         *
         * @return {{top: number, right: number, bottom: number, left: number}}
         */
        getCenterOffsets: function (columns) {
            var right = this._iconBarWidth;

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
         * Inverts the given affine transformation matrix
         *
         * @private
         * @param  {Array.<number>} matrix
         * @return {Array.<number>} Inverted matrix
         */
        _inverseOf: function (matrix) {
            var xx = matrix[0],
                xy = matrix[1],
                yx = matrix[2],
                yy = matrix[3],
                x0 = matrix[4],
                y0 = matrix[5],

                det = xx * yy - xy * yx;

            if (!det) {
                log.warn("Window to canvas matrix not invertable.");
                return null;
            }

            det = 1.0 / det;

            return [
                yy * det,
                -yx * det,
                -xy * det,
                xx * det,
                (xy * y0 - yy * x0) * det,
                (yx * x0 - xx * y0) * det
            ];
        },

        /**
         * Set the current transform from a transformation object.
         *
         * @private
         * @param {{xx: number, yx: number, xy: number, yy: number, tx: number, ty: number}} transformObj
         */
        _setTransformObject: function (transformObj) {
            if (transformObj) {
                this._transformMatrix = [
                    transformObj.xx,
                    transformObj.yx,
                    transformObj.xy,
                    transformObj.yy,
                    transformObj.tx,
                    transformObj.ty
                ];
                this._inverseTransformMatrix = this._inverseOf(this._transformMatrix);
            } else {
                this._transformMatrix = null;
                this._inverseTransformMatrix = null;
            }
        },

        /**
        * Get the root font size
        * @return {number}
        */
        getRootSize: function () {
            return this._rootSize;
        },

        /**
         * Converts a pixel value to a rem value based on
         * root font size
         * 16 px is 1 rem, so if our font-size is 62.5% (10px)
         * all our UI should be shrunk to that as well
         * 
         * @return {number}
         */
        pxToRem: function (px) {
            return px * this._rootSize / 16;
        },

        /**
        * Set the root size based on the document root element font size
        *
        * @private
        */
        _setRootSize: function () {
            var computedStyle = window.getComputedStyle(window.document.documentElement);
            this._rootSize = math.pixelDimensionToNumber(computedStyle.fontSize);
        },

        /**
         * Set the current transform from a 2d matrix. The format of this array
         * is described here:
         * http://cairographics.org/manual/cairo-cairo-matrix-t.html
         *
         * @private
         * @param {Array.<number>} transformMatrix
         */
        _setTransformMatrix: function (transformMatrix) {
            this._transformMatrix = transformMatrix;
            this._inverseTransformMatrix = this._inverseOf(transformMatrix);
        },

        /**
         * Reset the current window-to-canvas transform
         *
         * @private
         * @param {{transformMatrx: Array.<number>=, transformObject: object=}} payload
         */
        _transformUpdated: function (payload) {
            if (payload.transformMatrix) {
                this._setTransformMatrix(payload.transformMatrix);
            } else {
                this._setTransformObject(payload.transformObject);
            }

            this._zoom = payload.zoom;
            this._overlaysEnabled = true;

            this.emit("change");
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
         * Updates the overlays enabled flag
         *
         * @private
         * @param {{enabled: boolean}} payload
         */
        _handleOverlayToggle: function (payload) {
            this._overlaysEnabled = payload.enabled;
            this.emit("change");
        },

        /**
         * Re-enables the overlays once document layers are updated.
         *
         * @private
         */
        _handleLayersUpdated: function () {
            this.waitFor(["document"], function () {
                this._overlaysEnabled = true;
                this.emit("change");
            });
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
        }
    });

    module.exports = UIStore;
});
