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

    var adapter = require("adapter"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        adapterUI = require("adapter/ps/ui"),
        adapterOS = require("adapter/os");

    var Bounds = require("js/models/bounds"),
        events = require("js/events"),
        locks = require("js/locks"),
        shortcuts = require("./shortcuts"),
        preferences = require("./preferences"),
        synchronization = require("js/util/synchronization"),
        system = require("js/util/system"),
        tools = require("./tools");

    /**
     * Tooltip property key that determines the delay until tooltips are shown.
     *
     * @const
     * @private
     * @type {number}
     */
    var TOOLTIP_TIME_KEY = "ui.tooltip.delay.coldToHot";

    /**
     * The default value for the tooltip coldToHot delay
     *
     * @const
     * @private
     * @type {number}
     */
    var DEFAULT_TOOLTIP_TIME = 0.75;

    /**
     * A "sufficiently" large value tooltip coldToHot value which effectively
     * disables tooltips.
     *
     * @const
     * @private
     * @type {number}
     */
    var DISABLED_TOOLTIP_TIME = 9999;

    /**
     * List of zoom increments to fit into
     * when using zoom in/out
     *
     * @type {Array.<number>}
     */
    var ZOOM_INCREMENTS = [
        0.05, 0.0625, 0.0833, 0.125, 0.1667, 0.25, 0.333, 0.50, 0.67,
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
     * Globally enable tooltips.
     *
     * @return {Promise}
     */
    var enableTooltips = function () {
        return adapter.setPropertyValue(TOOLTIP_TIME_KEY, DEFAULT_TOOLTIP_TIME);
    };
    enableTooltips.writes = [locks.PS_APP];

    /**
     * Globally disable tooltips and clear any current tooltip.
     *
     * @return {Promise}
     */
    var disableTooltips = function () {
        return adapter.setPropertyValue(TOOLTIP_TIME_KEY, DISABLED_TOOLTIP_TIME).then(function () {
            adapterOS.setTooltip("");
        });
    };
    disableTooltips.writes = [locks.PS_APP];

    /**
     * Toggle pinned toolbar
     *
     * @return {Promise}
     */
    var togglePinnedToolbar = function () {
        var preferenceState = this.flux.store("preferences").getState(),
            toolbarPinned = preferenceState.get("toolbarPinned", true);

        var newToolbarPinned = !toolbarPinned;

        return this.transfer(preferences.setPreference, "toolbarPinned", newToolbarPinned);
    };
    togglePinnedToolbar.reads = [];
    togglePinnedToolbar.writes = [locks.JS_PREF];
    togglePinnedToolbar.transfers = [preferences.setPreference];

    /**
     * Query Photoshop for the curent window transform and emit a
     * TRANSFORM_UPDATED event with that value.
     *
     * @private
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

                this.dispatch(events.ui.TRANSFORM_UPDATED, payload);
                return this.transfer(tools.resetBorderPolicies);
            });
    };
    updateTransform.reads = [locks.PS_APP, locks.JS_APP];
    updateTransform.writes = [locks.JS_UI];
    updateTransform.transfers = [tools.resetBorderPolicies];

    /**
     * Using the center offsets, creates a cloaking rectangle on the canvas outside panels
     * that will be blitted out during scroll events
     *
     * @return {Promise}
     */
    var setOverlayCloaking = function () {
        var uiStore = this.flux.store("ui"),
            cloakRect = uiStore.getCloakRect();

        return adapterUI.setOverlayCloaking(cloakRect, ["scroll"], "afterPaint");
    };
    setOverlayCloaking.reads = [locks.JS_UI];
    setOverlayCloaking.writes = [locks.PS_APP];

    /**
     * Cloak the non-UI portion of the screen immediately, redrawing on the
     * next repaint.
     *
     * @return {Promise}
     */
    var cloak = function () {
        var uiStore = this.flux.store("ui"),
            cloakRect = uiStore.getCloakRect();

        return adapterUI.setOverlayCloaking(cloakRect, "immediate", "afterPaint");
    };
    cloak.reads = [locks.JS_UI];
    cloak.writes = [locks.PS_APP];

    /**
     * Directly emit a TRANSFORM_UPDATED event with the given value.
     *
     * @private
     * @return {Promise}
     */
    var setTransform = function (transformObject) {
        return descriptor.getProperty("document", "zoom")
            .get("_value")
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

                return this.transfer(tools.resetBorderPolicies);
            });
    };
    setTransform.reads = [locks.PS_APP];
    setTransform.writes = [locks.JS_UI];
    setTransform.transfers = [tools.resetBorderPolicies];
    setTransform.modal = true;

    /**
     * Parse the panel size information and dispatch the PANELS_RESIZED ui event
     *
     * @private
     * @param {{toolbarWidth: number=, panelWidth: number=, headerHeight: number=}} sizes
     * @return {Promise}
     */
    var updatePanelSizes = function (sizes) {
        return this.dispatchAsync(events.ui.PANELS_RESIZED, sizes)
            .bind(this)
            .then(function () {
                var centerOffsets = this.flux.store("ui").getState().centerOffsets;
                return adapterUI.setOverlayOffsets(centerOffsets);
            })
            .then(function () {
                return this.transfer(setOverlayCloaking);
            });
    };
    updatePanelSizes.reads = [];
    updatePanelSizes.writes = [locks.JS_UI, locks.PS_APP];
    updatePanelSizes.transfers = [setOverlayCloaking];
    updatePanelSizes.modal = true;

    /**
     * Updates the center offsets being sent to PS
     *
     * @private
     * @param {number} toolbarWidth
     * @return {Promise}
     */
    var updateToolbarWidth = function (toolbarWidth) {
        return this.transfer(updatePanelSizes, { toolbarWidth: toolbarWidth });
    };
    updateToolbarWidth.reads = [];
    updateToolbarWidth.writes = [];
    updateToolbarWidth.transfers = [updatePanelSizes];
    updateToolbarWidth.modal = true;

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
            z: zoom,
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
            uiState = this.flux.store("ui").getState(),
            offsets = uiState.centerOffsets,
            zoom = 1;

        var dispatchPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false });

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
            centerPromise = descriptor.play("setPanZoom", panZoom)
                .bind(this)
                .then(function () {
                    return this.transfer(updateTransform);
                });

        return Promise.join(dispatchPromise, centerPromise);
    };
    centerBounds.reads = [];
    centerBounds.writes = [locks.JS_UI, locks.PS_APP];
    centerBounds.transfers = [updateTransform];

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

        switch (payload.on) {
            case "selection":
                targetBounds = currentDoc.layers.selectedAreaBounds;
                if (!targetBounds || targetBounds.empty) {
                    targetBounds = currentDoc.bounds;
                }
                break;
            case "document":
                targetBounds = currentDoc.visibleBounds;
                break;
            default:
                throw new Error("Unexpected 'on' value");
        }

        return this.transfer(centerBounds, targetBounds, payload.zoomInto);
    };
    centerOn.reads = [locks.JS_APP, locks.JS_DOC];
    centerOn.writes = [];
    centerOn.transfers = [centerBounds];

    /**
     * Sets zoom to the value in the payload
     * Centering on the selection, pan is on by default
     *
     * @param {{zoom: number}} payload
     * @return {Promise}
     */
    var zoom = function (payload) {
        var uiStore = this.flux.store("ui"),
            uiState = uiStore.getState(),
            document = this.flux.store("application").getCurrentDocument(),
            zoom = payload.zoom,
            bounds = document.layers.selectedAreaBounds,
            panZoomDescriptor = {
                animate: false,
                resize: true,
                z: zoom
            };

        this.dispatch(events.ui.TOGGLE_OVERLAYS, { enabled: false });

        if (!bounds || bounds.width === 0) {
            var cloakRect = uiStore.getCloakRect(),
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
            offsets = uiState.centerOffsets,
            panDescriptor = _calculatePanZoom(bounds, offsets, zoom, factor);

        panZoomDescriptor.x = panDescriptor.x;
        panZoomDescriptor.y = panDescriptor.y;
    
        return descriptor.play("setPanZoom", panZoomDescriptor)
            .bind(this)
            .then(function () {
                return this.transfer(updateTransform);
            });
    };
    zoom.reads = [locks.JS_APP];
    zoom.writes = [locks.JS_UI, locks.PS_APP];
    zoom.transfers = [updateTransform];

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
    zoomInOut.reads = [locks.JS_UI];
    zoomInOut.writes = [];
    zoomInOut.transfers = [zoom];

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _scrollHandler,
        _activationChangeHandler,
        _resizeHandler;

    /**
     * Register event listeners for UI change events, and initialize the UI.
     *
     * @private
     * @param {boolean} reset Indicates whether this is being called as part of a reset
     * @return {Promise}
     */
    var beforeStartup = function (reset) {
        var DEBOUNCE_DELAY = 200;

        var setTransformDebounced = synchronization.debounce(function (event) {
            if (event.transform) {
                return this.flux.actions.ui.setTransform(event.transform);
            }
        }, this, DEBOUNCE_DELAY, false);

        // Handles spacebar + drag, scroll and window resize events
        _scrollHandler = function (event) {
            setTransformDebounced(event);
        }.bind(this);
        descriptor.addListener("scroll", _scrollHandler);

        // Handles Photoshop focus change events
        _activationChangeHandler = function (event) {
            this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: event.becameActive });
        }.bind(this);
        adapterOS.addListener("activationChanged", _activationChangeHandler);

        var windowResizeDebounced = synchronization.debounce(function () {
            return this.flux.actions.ui.setOverlayCloaking();
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

        // Add additional shortcut CMD=, so that CMD+ and CMD= both work for zoom in.
        var zoomShortcutModifier = system.isMac ? { "command": true } : { "control": true },
            zoomInShortcutPromise = this.transfer(shortcuts.addShortcut, "=", zoomShortcutModifier, function () {
                return this.flux.actions.ui.zoomInOut({ "zoomIn": true, "preserveFocus": true });
            }.bind(this));

        return Promise.join(osPromise, owlPromise, pathPromise, zoomInShortcutPromise)
            .return(reset);
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [locks.PS_APP];
    beforeStartup.transfers = [shortcuts.addShortcut];
    beforeStartup.modal = true;

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("scroll", _scrollHandler);
        adapterOS.removeListener("activationChanged", _activationChangeHandler);
        window.removeEventListener("resize", _resizeHandler);

        return Promise.resolve();
    };
    onReset.reads = [];
    onReset.writes = [];
    onReset.modal = true;

    exports.enableTooltips = enableTooltips;
    exports.disableTooltips = disableTooltips;
    exports.togglePinnedToolbar = togglePinnedToolbar;
    exports.updateTransform = updateTransform;
    exports.setTransform = setTransform;
    exports.setOverlayCloaking = setOverlayCloaking;
    exports.cloak = cloak;
    exports.updatePanelSizes = updatePanelSizes;
    exports.updateToolbarWidth = updateToolbarWidth;
    exports.centerBounds = centerBounds;
    exports.centerOn = centerOn;
    exports.zoomInOut = zoomInOut;
    exports.zoom = zoom;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;

    // This module must have a higher priority than the tool action module.
    // Tool select handlers assume the presence of defaults first set in
    // tools.onBeforeStartup.
    exports._priority = 99;
});
