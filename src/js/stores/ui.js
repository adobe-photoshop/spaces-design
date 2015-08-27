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
    
    var Fluxxor = require("fluxxor"),
        _ = require("lodash");
    
    var events = require("../events"),
        log = require("js/util/log"),
        math = require("js/util/math");

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
         * Center offsets to be applied to zoom calculations
         *
         * @type {{top: number, left: number, bottom: number, right: number}}
         */
        _centerOffsets: null,

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
         * A set of unique document IDs that are centered after panel resized. If a document's id is not in the set,
         * it will be centered when it is selected.
         *
         * @private
         * @type {Set.<number>}
         */
        _centeredDocumentIDs: null,

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.ui.TRANSFORM_UPDATED, this._transformUpdated,
                events.ui.PANELS_RESIZED, this._handlePanelResize,
                events.ui.TOOLBAR_PINNED, this._handleToolbarPin,
                events.ui.SUPERSELECT_MARQUEE, this._handleMarqueeStart,
                events.ui.TOGGLE_OVERLAYS, this._handleOverlayToggle,
                events.document.DOCUMENT_UPDATED, this._handleLayersUpdated,
                events.document.RESET_LAYERS, this._handleLayersUpdated,
                events.document.RESET_BOUNDS, this._handleLayersUpdated,
                events.document.history.nonOptimistic.RESET_BOUNDS, this._handleLayersUpdated,
                events.document.SELECT_DOCUMENT, this._handleSelectDocument,
                events.document.CLOSE_DOCUMENT, this._handleCloseDocument
            );

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
            this._centerOffsets = null;
            this._transformMatrix = null;
            this._inverseTransformMatrix = null;
            this._centeredDocumentIDs = new Set();

            this._panelWidth = 0;
            this._headerHeight = 0;
            this._toolbarWidth = 0;
        },

        getState: function () {
            return {
                transformMatrix: this._transformMatrix,
                inverseTransformMatrix: this._inverseTransformMatrix,
                zoomFactor: this._zoom,
                centerOffsets: this._centerOffsets,
                overlaysEnabled: this._overlaysEnabled,
                marqueeEnabled: this._marqueeEnabled,
                marqueeStart: this._marqueeStart
            };
        },

        zoomWindowToCanvas: function (x) {
            return x * this._zoom;
        },

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
         * Get the current cloaking rectangle, which omits the static UI.
         *
         * @private
         * @return {{top: number, right: number, left: number, bottom: number}}
         */
        getCloakRect: function () {
            var centerOffsets = this._centerOffsets,
                windowWidth = window.document.body.clientWidth,
                windowHeight = window.document.body.clientHeight;

            if (!centerOffsets) {
                return null;
            }
            
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
         * Recalculates center offset given all the HTML panel sizes. 
         *
         * @private
         * @return {boolean} true if the offset is updated
         */
        _recalculateCenterOffset: function () {
            var nextCenterOffsets = {
                top: this._headerHeight,
                right: this._panelWidth,
                left: this._toolbarWidth,
                bottom: 0
            };
            
            if (_.isEqual(this._centerOffsets, nextCenterOffsets)) {
                return false;
            }
            
            this._centerOffsets = nextCenterOffsets;
            return true;
            
            // We don't emit offset change because we don't react to it
        },

        /**
         * Updates the center offsets when they change.
         *
         * @private
         * @param {{panelWidth: number, headerHeight: number}} payload
         */
        _handlePanelResize: function (payload) {
            this._panelWidth = payload.panelWidth;
            if (payload.hasOwnProperty("headerHeight")) {
                this._headerHeight = payload.headerHeight;
            }
            
            if (this._recalculateCenterOffset()) {
                this._centerCurrentDocumentOnce();
            }
        },
        
        /**
         * Center the selected document if panel-resize event occurse. 
         * 
         * @private
         */
        _handleSelectDocument: function () {
            this.waitFor(["application"], function () {
                this._centerCurrentDocumentOnce();
            });
        },
        
        /**
         * Handle document close by removing its ID from centered documents list.
         * 
         * @private
         * @param {{documentID: number}} payload
         */
        _handleCloseDocument: function (payload) {
            this._centeredDocumentIDs.delete(payload.documentID);
        },
        
        /**
         * Center the selected document once.
         *
         * @private
         */
        _centerCurrentDocumentOnce: function () {
            var applicationStore = this.flux.store("application"),
                currentDocId = applicationStore.getCurrentDocumentID();
            
            if (currentDocId && !this._centeredDocumentIDs.has(currentDocId)) {
                this._centeredDocumentIDs.add(currentDocId);
                this.flux.actions.ui.centerOn({ on: "document", zoomInto: true, preserveFocus: true });
            }
        },

        /**
         * Updates the left center offset when toolbar is pinned
         *
         * @private
         * @param {{toolbarWidth: number}} payload
         */
        _handleToolbarPin: function (payload) {
            this._toolbarWidth = payload.toolbarWidth;

            this._recalculateCenterOffset();
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
        }
    });

    module.exports = UIStore;
});
