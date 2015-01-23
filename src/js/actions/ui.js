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

    var Promise = require("bluebird");

    var descriptor = require("adapter/ps/descriptor"),
        adapterUI = require("adapter/ps/ui"),
        events = require("js/events"),
        locks = require("js/locks"),
        synchronization = require("js/util/synchronization");

    /**
     * Query Photoshop for the curent window transform and emit a
     * TRANSFORM_UPDATED event with that value.
     * 
     * @private
     * @return {Promise}
     */
    var updateTransformCommand = function () {
        // Despite the misleading property name, this array appears to
        // encode an affine transformation from the window coordinate
        // space to the document canvas cooridinate space. 
        return Promise.join(descriptor.get("transform"), descriptor.getProperty("document", "zoom"))
            .bind(this)
            .then(function (transform) {
                return [transform[0].toWindow, transform[1].value];
            })
            .catch(function () {
                // There is no open document, so unset the transform
                return [null, null];
            })
            .then(function (transformAndZoom) {
                var payload = {
                    transformMatrix: transformAndZoom[0],
                    zoom: transformAndZoom[1]
                };

                this.dispatch(events.ui.TRANSFORM_UPDATED, payload);
            });
    };

    /**
     * Directly emit a TRANSFORM_UPDATED event with the given value.
     *
     * @private
     * @return {Promise}
     */
    var setTransformCommand = function (transformObject) {
        return descriptor.getProperty("document", "zoom")
            .get("value")
            .bind(this)
            .catch(function () {
                return null;
            })
            .then(function (zoom) {
                var payload = {
                    transformObject: transformObject,
                    zoom: zoom
                };

                this.dispatch(events.ui.TRANSFORM_UPDATED, payload);
            });
    };

    /**
     * Parse the panel size information and dispatch the PANELS_RESIZED ui event
     *
     * @private
     * @return {Promise}
     */
    var updatePanelSizesCommand = function (sizes) {
        this.dispatch(events.ui.PANELS_RESIZED, sizes);

        return Promise.resolve();
    };

    /**
     * Calculates the panZoom descriptor given bounds, panel width, zoom and uiFactor
     *
     * @param {Bounds} bounds
     * @param {number} panel panelWidth
     * @param {number} zoom 1 is 100%
     * @param {number} factor UI Scale factor
     *
     * @return {x: <number>, y:<number>, z:<number>}
     */
    var _calculatePanZoom = function (bounds, panel, zoom, factor) {
        return {
            x: panel / 2 + zoom * bounds.xCenter / factor,
            y: zoom * bounds.yCenter / factor,
            z: zoom
        };
    };

    /**
     * Changes Photoshop pan and zoom to center the given bounds on the app window
     * Takes the HTML panel into account
     *
     * @param {Bounds} bounds Bounds we're trying to fit into
     * @return {Promise}
     */
    var centerBoundsCommand = function (bounds, zoomInto) {
        var factor = window.devicePixelRatio,
            uiState = this.flux.store("ui").getState(),
            panelWidth = uiState.panelWidth,
            zoom = 1;

        if (zoomInto) {
            var padding = 50,
                bodyWidth = document.body.clientWidth - panelWidth - padding * 2,
                bodyHeight = document.body.clientHeight - padding * 2,
                widthRatio = bounds.width / bodyWidth,
                heightRatio = bounds.height / bodyHeight;

            zoom = factor / Math.max(widthRatio, heightRatio);
        } else {
            zoom = uiState.zoomFactor;
        }

        var panZoom = _calculatePanZoom(bounds, panelWidth, zoom, factor);

        return descriptor.play("setPanZoom", panZoom)
            .bind(this)
            .then(function () {
                return this.transfer(updateTransform);
            });
    };

    /**
     * Centers on the given item, zooming in if desired to fit it on screen
     * Options for key "on" are "document", "selection"
     * If zoomInto is provided, will zoom into the selection as well
     *
     * @param {on: "document"|"selection", zoomInto: <boolean>} payload
     * @return {Promise}
     */
    var centerOnCommand = function (payload) {
        var currentDoc = this.flux.store("application").getCurrentDocument(),
            targetBounds;

        if (!currentDoc) {
            return Promise.resolve();
        }

        switch (payload.on) {
            case "selection":
                targetBounds = currentDoc.layers.selectedAreaBounds;
                break;
            case "document":
                targetBounds = currentDoc.bounds;
                break;
            default:
                throw new Error("Unexpected 'on' value");
        }

        return this.transfer(centerBounds, targetBounds, payload.zoomInto);
        
    };

    /**
     * Zooms in or out into the document
     * Right now doubles or halves the zoom depending on direction
     *
     * @param {zoomIn: <boolean>} payload True if zooming in
     * @return {Promise}
     */
    var zoomInOutCommand = function (payload) {
        var zoomFactor = this.flux.store("ui").getState().zoomFactor,
            newZoom = payload.zoomIn ? zoomFactor * 2 : zoomFactor / 2;

        return this.transfer(zoom, {zoom: newZoom});
    };

    /**
     * Sets zoom to the value in the payload
     * Centering on the selection, pan is on by default
     *
     * @param {zoom: <number>, pan: <boolean>} payload
     * @return {Promise}
     */
    var zoomCommand = function (payload) {
        var uiState = this.flux.store("ui").getState(),
            document = this.flux.store("application").getCurrentDocument(),
            zoom = payload.zoom,
            pan = payload.hasOwnProperty("pan") ? payload.pan : true,
            bounds = document.layers.selectedAreaBounds,
            panZoomDescriptor = {
                animate: true,
                resize: true,
                z: zoom
            };


        if (bounds && bounds.width === 0) {
            // If selected layers don't have any bounds (happens with empty pixel layers)
            // Don't pan
            pan = false;
        }
        
        // We only add these to descriptor if we want to pan, without them, PS will only zoom.
        if (pan && bounds) {
            var factor = window.devicePixelRatio,
                panelWidth = uiState.panelWidth;

            var panDescriptor = _calculatePanZoom(bounds, panelWidth, zoom, factor);

            panZoomDescriptor.x = panDescriptor.x;
            panZoomDescriptor.y = panDescriptor.y;
        }

        return descriptor.play("setPanZoom", panZoomDescriptor)
            .bind(this)
            .then(function () {
                return this.transfer(updateTransform);
            });
    };

    
    /**
     * Register event listeners for UI change events, and initialize the UI.
     * 
     * @private
     * @return {Promise}
     */
    var beforeStartupCommand = function () {
        var DEBOUNCE_DELAY = 500;

        // Handles zoom and pan events
        var setTransformDebounced = synchronization.debounce(function (event) {
            if (event.transform) {
                return this.flux.actions.ui.setTransform(event.transform.value);
            }
        }, this, DEBOUNCE_DELAY);
        descriptor.addListener("scroll", setTransformDebounced);

        // Handles window resize events
        var updateTransformDebounced = synchronization
            .debounce(this.flux.actions.ui.updateTransform, this, DEBOUNCE_DELAY);
        window.addEventListener("resize", updateTransformDebounced);

        // Enable over-scroll mode
        var osPromise = adapterUI.setOverscrollMode(adapterUI.overscrollMode.ALWAYS_OVERSCROLL);

        // Initialize the window transform
        var transformPromise = this.transfer(updateTransform);

        return Promise.join(osPromise, transformPromise);
    };

    var onResetCommand = function () {
        // Reset the window transform
        return this.transfer(updateTransform);
    };

    /**
     * Transform update action
     * @type {Action}
     */
    var updateTransform = {
        command: updateTransformCommand,
        reads: [locks.PS_APP],
        writes: [locks.JS_APP]
    };

    /**
     * Transform set action
     * @type {Action}
     */
    var setTransform = {
        command: setTransformCommand,
        reads: [],
        writes: [locks.JS_APP]
    };

    /**
     * Centers the bounds with the correct zoom in app window
     *
     * @type {Action}
     */
    var centerBounds = {
        command: centerBoundsCommand,
        reads: [locks.PS_APP, locks.JS_DOC],
        writes: [locks.JS_APP]
    };

    /**
     * Centers on the document or selection, zooming in if needed
     *
     * @type {Action}
     */
    var centerOn = {
        command: centerOnCommand,
        reads: [locks.PS_APP, locks.JS_DOC],
        writes: [locks.JS_APP]
    };

    /**
     * Updates the panel size information stored for certain UI actions
     *
     * @type {Action}
     */
    var updatePanelSizes = {
        command: updatePanelSizesCommand,
        reads: [locks.JS_APP],
        writes: [locks.JS_APP]
    };

    /** 
     * Doubles or halves the current zoom
     * 
     * @type {Action}
     */
    var zoomInOut = {
        command: zoomInOutCommand,
        reads: [locks.JS_APP],
        writes: [locks.JS_APP, locks.PS_APP]
    };

    /**
     * Sets zoom to given value
     *
     * @type {Action}
     */
    var zoom = {
        command: zoomCommand,
        reads: [locks.JS_APP],
        writes: [locks.JS_APP, locks.PS_APP]
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        reads: [locks.PS_APP],
        writes: [locks.JS_APP]
    };

    var onReset = {
        command: onResetCommand,
        reads: [locks.PS_APP],
        writes: [locks.JS_APP]
    };

    exports.updateTransform = updateTransform;
    exports.setTransform = setTransform;
    exports.updatePanelSizes = updatePanelSizes;
    exports.centerBounds = centerBounds;
    exports.centerOn = centerOn;
    exports.beforeStartup = beforeStartup;
    exports.zoomInOut = zoomInOut;
    exports.zoom = zoom;
    exports.onReset = onReset;
});
