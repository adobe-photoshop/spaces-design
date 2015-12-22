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

    var Promise = require("bluebird"),
        _ = require("lodash");

    var descriptor = require("adapter").ps.descriptor,
        documentLib = require("adapter").lib.document,
        adapterUI = require("adapter").ps.ui,
        adapterOS = require("adapter").os;

    var Bounds = require("js/models/bounds"),
        events = require("js/events"),
        locks = require("js/locks"),
        shortcuts = require("./shortcuts"),
        synchronization = require("js/util/synchronization"),
        system = require("js/util/system");

    /**
     * List of zoom increments to fit into
     * when using zoom in/out
     *
     * @type {Array.<number>}
     */
    var ZOOM_INCREMENTS = [
        0.0025, 0.005, 0.01, 0.05, 0.0625,
        0.0833, 0.125, 0.1667, 0.25, 0.333, 0.50, 0.67,
        1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 32
    ];

    /**
     * Document properties needed to update the window transform
     *
     * @private
     * @const
     * @type {Array.<string>}
     */
    var _transformProperties = [
        "viewTransform",
        "zoom"
    ];

    /**
     * Query Photoshop for the curent window transform and emit a
     * TRANSFORM_UPDATED event with that value.
     *
     * @return {Promise}
     */
    var updateTransform = function () {
        var currentDocument = this.flux.store("application").getCurrentDocument();

        // If there is no document open, skip the round trip
        if (!currentDocument) {
            var nullPayload = {
                transformMatrix: null,
                zoom: null
            };

            return this.dispatchAsync(events.ui.TRANSFORM_UPDATED, nullPayload);
        }

        var docRef = documentLib.referenceBy.id(currentDocument.id);

        // Despite the misleading property name, this array appears to
        // encode an affine transformation from the window coordinate
        // space to the document canvas cooridinate space.

        return descriptor.multiGetOptionalProperties(docRef, _transformProperties)
            .bind(this)
            .then(function (result) {
                var payload = {
                    transformMatrix: result.viewTransform,
                    zoom: result.zoom._value
                };

                return this.dispatch(events.ui.TRANSFORM_UPDATED, payload);
            });
    };
    updateTransform.action = {
        reads: [locks.PS_APP, locks.JS_APP],
        writes: [locks.JS_UI],
        hideOverlays: true
    };

    /**
     * Directly emit a TRANSFORM_UPDATED event with the given value.
     * NOTE: This action is currently dead and may be removed.
     *
     * @return {Promise}
     */
    var setTransform = function (transformObject) {
        return descriptor.getProperty("document", "zoom")
            .bind(this)
            .get("_value")
            .catch(function () {
                return null;
            })
            .then(function (zoom) {
                var payload = {
                    transformObject: transformObject,
                    zoom: zoom
                };

                return this.dispatch(events.ui.TRANSFORM_UPDATED, payload);
            });
    };
    setTransform.action = {
        reads: [locks.PS_APP],
        writes: [locks.JS_UI],
        modal: true,
        hideOverlays: true
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
        var incrementsLen = ZOOM_INCREMENTS.length;
        if (zoom < ZOOM_INCREMENTS[0]) {
            zoom = ZOOM_INCREMENTS[0];
        } else if (zoom > ZOOM_INCREMENTS[incrementsLen - 1]) {
            zoom = ZOOM_INCREMENTS[incrementsLen - 1];
        }

        return {
            x: zoom * bounds.xCenter / factor + (offset.right - offset.left) / 2,
            y: zoom * bounds.yCenter / factor + (offset.bottom - offset.top) / 2,
            z: zoom,
            resize: true,
            animate: false
        };
    };

    /**
     * Changes Photoshop pan and zoom to center the given bounds on the app window
     * Takes the HTML panel into account
     *
     * @param {Bounds} bounds Bounds we're trying to fit into
     * @return {Promise}
     */
    var centerBounds = function (bounds, zoomInto) {
        var factor = window.devicePixelRatio,
            flux = this.flux,
            uiState = flux.store("ui").getState(),
            panelState = flux.store("panel").getState(),
            offsets = panelState.centerOffsets,
            zoom = 1;

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

        var panZoom = _calculatePanZoom(bounds, offsets, zoom, factor);
        return descriptor.play("setPanZoom", panZoom)
            .bind(this)
            .then(function () {
                return this.transfer(updateTransform);
            });
    };
    centerBounds.action = {
        reads: [locks.JS_UI, locks.JS_PANEL],
        writes: [locks.PS_APP],
        transfers: [updateTransform],
        hideOverlays: true
    };

    /**
     * Centers on the given item, zooming in if desired to fit it on screen
     * Options for key "on" are "document", "selection"
     * If zoomInto is provided, will zoom into the selection as well
     *
     * @param {{on: "document"|"selection", zoomInto: boolean}} payload
     * @return {Promise}
     */
    var centerOn = function (payload) {
        var currentDoc = this.flux.store("application").getCurrentDocument(),
            targetBounds;

        if (!currentDoc) {
            return Promise.resolve();
        }

        var selection;
        switch (payload.on) {
        case "selection":
            selection = true;
            break;
        case "document":
            selection = false;
            break;
        default:
            selection = !currentDoc.layers.selected.isEmpty();
        }

        if (selection) {
            targetBounds = currentDoc.layers.selectedAreaBounds;
            if (!targetBounds || targetBounds.empty) {
                targetBounds = currentDoc.visibleBounds;
            }
        } else {
            targetBounds = currentDoc.visibleBounds;
        }

        return this.transfer(centerBounds, targetBounds, payload.zoomInto);
    };
    centerOn.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [],
        transfers: [centerBounds]
    };

    /**
     * Sets zoom to the value in the payload
     * Centering on the selection, pan is on by default
     *
     * @param {{zoom: number}} payload
     * @return {Promise}
     */
    var zoom = function (payload) {
        var flux = this.flux,
            uiStore = flux.store("ui"),
            panelStore = this.flux.store("panel"),
            panelState = panelStore.getState(),
            document = this.flux.store("application").getCurrentDocument(),
            zoom = payload.zoom,
            bounds = document.layers.selectedAreaBounds;

        if (!bounds || bounds.width === 0) {
            var cloakRect = panelStore.getCloakRect(),
                tl = uiStore.transformWindowToCanvas(cloakRect.left, cloakRect.top),
                br = uiStore.transformWindowToCanvas(cloakRect.right, cloakRect.bottom),
                model = {
                    left: tl.x,
                    top: tl.y,
                    right: br.x,
                    bottom: br.y
                };
                
            bounds = new Bounds(model);
        }

        var factor = window.devicePixelRatio,
            offsets = panelState.centerOffsets,
            panZoomDescriptor = _calculatePanZoom(bounds, offsets, zoom, factor);

        return descriptor.play("setPanZoom", panZoomDescriptor)
            .bind(this)
            .then(function () {
                return this.transfer(updateTransform);
            });
    };
    zoom.action = {
        reads: [locks.JS_APP, locks.JS_UI, locks.JS_PANEL],
        writes: [locks.PS_APP],
        transfers: [updateTransform],
        hideOverlays: true
    };

    /**
     * Zooms in or out into the document, fitting into one of the
     * defined increments, staying within the zoom bounds
     *
     * @param {{zoomIn: boolean}} payload True if zooming in
     * @return {Promise}
     */
    var zoomInOut = function (payload) {
        var zoomFactor = this.flux.store("ui").getState().zoomFactor,
            zoomIndex = payload.zoomIn ?
                _.findIndex(ZOOM_INCREMENTS, function (zoom) {
                    return zoom > zoomFactor;
                }) :
                _.findLastIndex(ZOOM_INCREMENTS, function (zoom) {
                    return zoom < zoomFactor;
                });

        if (zoomIndex === -1) {
            return Promise.resolve();
        }
        
        return this.transfer(zoom, { zoom: ZOOM_INCREMENTS[zoomIndex] });
    };
    zoomInOut.action = {
        reads: [locks.JS_UI],
        writes: [],
        transfers: [zoom]
    };

    /**
     * Emit a DISPLAY_CHANGED event.
     */
    var handleDisplayConfigurationChanged = function () {
        return this.dispatchAsync(events.ui.DISPLAY_CHANGED);
    };
    handleDisplayConfigurationChanged.action = {
        reads: [],
        writes: [locks.JS_UI],
        transfers: [],
        modal: true,
        hideOverlays: true
    };

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _scrollHandler,
        _displayConfigurationChangedHandler;

    /**
     * @const
     * @type {number}
     */
    var EVENT_DEBOUNCE_DELAY = 200;

    /**
     * Register event listeners for UI change events, and initialize the UI.
     *
     * @return {Promise}
     */
    var beforeStartup = function () {
        var scrolling = false,
            updateTransformDebounced = synchronization.debounce(function () {
                return this.flux.actions.ui.updateTransform()
                    .bind(this)
                    .then(function () {
                        // Consider the scroll to be inactive
                        scrolling = false;

                        // Reenable overlays
                        this.dispatch(events.panel.END_CANVAS_UPDATE);
                    });
            }, this, EVENT_DEBOUNCE_DELAY, false);

        // Handles spacebar + drag, scroll and window resize events
        _scrollHandler = function (event) {
            if (!event.transform) {
                return;
            }

            // When scrolling begins, cloak the canvas
            if (!scrolling) {
                // Only cloak once while scrolling is active
                scrolling = true;

                // Disable overlays
                this.dispatch(events.panel.START_CANVAS_UPDATE);
            }

            updateTransformDebounced();
        }.bind(this);
        descriptor.addListener("scroll", _scrollHandler);

        _displayConfigurationChangedHandler = synchronization.debounce(
            this.flux.actions.ui.handleDisplayConfigurationChanged, this, EVENT_DEBOUNCE_DELAY);
        adapterOS.addListener("displayConfigurationChanged", _displayConfigurationChangedHandler);

        // Enable over-scroll mode
        var osPromise = adapterUI.setOverscrollMode(adapterUI.overscrollMode.ALWAYS_OVERSCROLL);

        // Hide OWL UI, status bar and scroll bars
        var owlPromise = adapterUI.setClassicChromeVisibility(false);

        // Enable target path suppression
        var pathPromise = adapterUI.setSuppressTargetPaths(false);

        return Promise.join(osPromise, owlPromise, pathPromise);
    };
    beforeStartup.action = {
        reads: [],
        writes: [locks.PS_APP],
        transfers: [],
        modal: true
    };

    /**
     * Initialize the window transform, but only after documents have been
     * initialized because otherwise updateTransform aborts early.
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        // Add additional shortcut CMD=, so that CMD+ and CMD= both work for zoom in.
        var zoomShortcutModifier = system.isMac ? { "command": true } : { "control": true },
            zoomInShortcutPromise = this.transfer(shortcuts.addShortcut, "=", zoomShortcutModifier, function () {
                return this.flux.actions.ui.zoomInOut({ "zoomIn": true, "preserveFocus": true });
            }.bind(this));

        var updateTransformPromise = this.transfer(updateTransform);

        return Promise.join(zoomInShortcutPromise, updateTransformPromise);
    };
    afterStartup.action = {
        reads: [],
        writes: [],
        transfers: ["shortcuts.addShortcut", updateTransform]
    };

    /**
     * Remove event handlers.
     *
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("scroll", _scrollHandler);
        adapterOS.removeListener("displayConfigurationChanged", _displayConfigurationChangedHandler);

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: [],
        modal: true
    };

    exports.updateTransform = updateTransform;
    exports.setTransform = setTransform;
    exports.centerBounds = centerBounds;
    exports.centerOn = centerOn;
    exports.zoomInOut = zoomInOut;
    exports.zoom = zoom;
    exports.handleDisplayConfigurationChanged = handleDisplayConfigurationChanged;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;

    // This module must have a higher priority than the tool action module.
    // Tool select handlers assume the presence of defaults first set in
    // tools.onBeforeStartup.
    exports._priority = 99;
});
