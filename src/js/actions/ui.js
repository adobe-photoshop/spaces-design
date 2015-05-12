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
        adapterUI = require("adapter/ps/ui");

    var events = require("js/events"),
        locks = require("js/locks"),
        synchronization = require("js/util/synchronization");


    /**
     * Toggle pinned toolbar
     *    
     * @return {Promise}
     */
    var togglePinnedToolbarCommand = function () {
        var preferences = this.flux.store("preferences").getState(),
            toolbarPinned = preferences.get("toolbarPinned", true);
            
        var newToolbarPinned = !toolbarPinned;

        return this.flux.actions.preferences.setPreference("toolbarPinned", newToolbarPinned);
    };
    
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
        return this.dispatchAsync(events.ui.PANELS_RESIZED, sizes)
            .bind(this)
            .then(function () {
                var centerOffsets = this.flux.store("ui").getState().centerOffsets;
                return adapterUI.setOverlayOffsets(centerOffsets);
            });
    };

    /**
     * Updates the center offsets being sent to PS
     *
     * @private
     * @param {number} toolbarWidth
     * @return {Promise}
     */
    var updateToolbarWidthCommand = function (toolbarWidth) {
        return this.dispatchAsync(events.ui.TOOLBAR_PINNED, {toolbarWidth: toolbarWidth})
            .bind(this)
            .then(function () {
                var centerOffsets = this.flux.store("ui").getState().centerOffsets;
                return adapterUI.setOverlayOffsets(centerOffsets);
            });
    };

    /**
     * Calculates the panZoom descriptor given bounds, panel width, zoom and uiFactor
     *
     * @param {Bounds} bounds
     * @param {{top: number, left: number, bottom: number, right: number}} offset Center Offset
     * @param {number} zoom 1 is 100%
     * @param {number} factor UI Scale factor
     *
     * @return {{x: number, y: number, z: number}}
     */
    var _calculatePanZoom = function (bounds, offset, zoom, factor) {
        return {
            x: zoom * bounds.xCenter / factor + (offset.right - offset.left) / 2,
            y: zoom * bounds.yCenter / factor + (offset.bottom - offset.top) / 2,
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
            offsets = uiState.centerOffsets,
            zoom = 1;

        var dispatchPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, {enabled: false});

        if (zoomInto) {
            var padding = 50,
                verticalOffset = offsets.top + offsets.bottom,
                horizontalOffset = offsets.left + offsets.right,
                bodyWidth = window.document.body.clientWidth - horizontalOffset - padding * 2,
                bodyHeight = window.document.body.clientHeight - verticalOffset - padding * 2,
                widthRatio = bounds.width / bodyWidth,
                heightRatio = bounds.height / bodyHeight;

            zoom = factor / Math.max(widthRatio, heightRatio);
        } else {
            zoom = uiState.zoomFactor;
        }

        var panZoom = _calculatePanZoom(bounds, offsets, zoom, factor),
            centerPromise = Promise.delay(50)
                .bind(this)
                .then(function () {
                    return descriptor.play("setPanZoom", panZoom);
                })
                .then(function () {
                    return this.transfer(updateTransform);
                });

        return Promise.join(dispatchPromise, centerPromise);
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
                if (!targetBounds || targetBounds.empty) {
                    targetBounds = currentDoc.bounds;
                }
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

        this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: false});

        if (bounds && bounds.width === 0) {
            // If selected layers don't have any bounds (happens with empty pixel layers)
            // Don't pan
            pan = false;
        }
        
        // We only add these to descriptor if we want to pan, without them, PS will only zoom.
        if (pan && bounds) {
            var factor = window.devicePixelRatio,
                offsets = uiState.centerOffsets;

            var panDescriptor = _calculatePanZoom(bounds, offsets, zoom, factor);

            panZoomDescriptor.x = panDescriptor.x;
            panZoomDescriptor.y = panDescriptor.y;
        }

        return Promise.delay(50)
            .bind(this)
            .then(function () {
                return descriptor.play("setPanZoom", panZoomDescriptor);
            })
            .then(function () {
                return this.transfer(updateTransform);
            });
    };

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _scrollHandler,
        _resizeHandler;
    
    /**
     * Register event listeners for UI change events, and initialize the UI.
     * 
     * @private
     * @param {boolean} reset Indicates whether this is being called as part of a reset
     * @return {Promise}
     */
    var beforeStartupCommand = function (reset) {
        var DEBOUNCE_DELAY = 200;

        var setTransformDebounced = synchronization.debounce(function (event) {
            if (event.transform) {
                return this.flux.actions.ui.setTransform(event.transform.value);
            }
        }, this, DEBOUNCE_DELAY, false);

        // Handles spacebar + drag, scroll and window resize events
        _scrollHandler = function (event) {
            this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: false});
            setTransformDebounced(event);
        }.bind(this);
        descriptor.addListener("scroll", _scrollHandler);

        var windowResizeDebounced = synchronization.debounce(function () {
            return this.flux.actions.tools.resetSuperselect();
        }, this, DEBOUNCE_DELAY, false);

        // Handles window resize for resetting superselect tool policies
        _resizeHandler = function (event) {
            windowResizeDebounced(event);
        };
        window.addEventListener("resize", _resizeHandler);

        // Enable over-scroll mode
        var osPromise = adapterUI.setOverscrollMode(adapterUI.overscrollMode.ALWAYS_OVERSCROLL);

        // Hide OWL UI, status bar and scroll bars      
        var owlPromise = adapterUI.setClassicChromeVisibility(false);

        // Enable target path suppression
        var pathPromise = adapterUI.setSuppressTargetPaths(true);

        // Initialize the window transform
        var transformPromise = this.transfer(updateTransform);

        return Promise.join(osPromise, owlPromise, pathPromise, transformPromise)
            .return(reset);
    };

    /**
     * Center the document after startup.
     *
     * @private
     * @param {boolean} reset Indicates whether this is being called as part of a reset
     * @return {Promise}
     */
    var afterStartupCommand = function (reset) {
        var document = this.flux.store("application").getCurrentDocument();

        if (document && !reset) {
            // Flag sets whether to zoom to fit app window or not
            return this.transfer(centerBounds, document.bounds, false);
        } else {
            return Promise.resolve();
        }
    };

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onResetCommand = function () {
        descriptor.removeListener("scroll", _scrollHandler);
        window.removeEventListener("resize", _resizeHandler);

        return Promise.resolve();
    };

    /**
     * Transform update action
     * @type {Action}
     */
    var updateTransform = {
        command: updateTransformCommand,
        reads: [locks.PS_APP],
        writes: [locks.JS_UI]
    };

    /**
     * Transform set action
     * @type {Action}
     */
    var setTransform = {
        command: setTransformCommand,
        reads: [],
        writes: [locks.JS_UI],
        modal: true
    };

    /**
     * Centers the bounds with the correct zoom in app window
     *
     * @type {Action}
     */
    var centerBounds = {
        command: centerBoundsCommand,
        reads: [locks.PS_APP, locks.JS_DOC],
        writes: [locks.JS_UI]
    };

    /**
     * Centers on the document or selection, zooming in if needed
     *
     * @type {Action}
     */
    var centerOn = {
        command: centerOnCommand,
        reads: [locks.PS_APP, locks.JS_DOC],
        writes: [locks.JS_UI]
    };

    /**
     * Updates the panel size information stored for certain UI actions
     *
     * @type {Action}
     */
    var updatePanelSizes = {
        command: updatePanelSizesCommand,
        reads: [locks.JS_APP],
        writes: [locks.JS_UI]
    };

    /**
     * Updates the toolbar width information
     *
     * @type {Action}
     */
    var updateToolbarWidth = {
        command: updateToolbarWidthCommand,
        reads: [locks.JS_APP],
        writes: [locks.JS_UI]
    };

    /** 
     * Doubles or halves the current zoom
     * 
     * @type {Action}
     */
    var zoomInOut = {
        command: zoomInOutCommand,
        reads: [locks.JS_APP],
        writes: [locks.JS_UI, locks.PS_APP]
    };

    /**
     * Sets zoom to given value
     *
     * @type {Action}
     */
    var zoom = {
        command: zoomCommand,
        reads: [locks.JS_APP],
        writes: [locks.JS_UI, locks.PS_APP]
    };

    var togglePinnedToolbar = {
        command: togglePinnedToolbarCommand,
        reads: [],
        writes: []
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        reads: [],
        writes: [locks.JS_UI, locks.PS_APP]
    };

    var afterStartup = {
        command: afterStartupCommand,
        reads: [locks.PS_APP, locks.JS_DOC],
        writes: [locks.JS_UI]
    };

    var onReset = {
        command: onResetCommand,
        reads: [],
        writes: []
    };

    
    exports.togglePinnedToolbar = togglePinnedToolbar;
    exports.updateTransform = updateTransform;
    exports.setTransform = setTransform;
    exports.updatePanelSizes = updatePanelSizes;
    exports.updateToolbarWidth = updateToolbarWidth;
    exports.centerBounds = centerBounds;
    exports.centerOn = centerOn;
    exports.zoomInOut = zoomInOut;
    exports.zoom = zoom;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;

    // This module must have a higher priority than the tool action module.
    // Tool select handlers assume the presence of defaults first set in
    // tools.onBeforeStartup.
    exports._priority = 99;
});
