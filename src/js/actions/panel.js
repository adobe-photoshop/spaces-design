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

import * as Promise from "bluebird";

import * as adapter from "adapter";

var descriptor = adapter.ps.descriptor,
    adapterUI = adapter.ps.ui,
    adapterOS = adapter.os,
    appLib = adapter.lib.application;

import * as events from "js/events";
import * as locks from "js/locks";
import * as preferences from "./preferences";
import * as synchronization from "js/util/synchronization";
import * as headlights from "js/util/headlights";
import * as uiUtil from "js/util/ui";

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
 * Key for accessing the reference point from preferences storage.
 *
 * @const
 * @private
 * @type {string}
 */
var REFERENCE_POINT_PREFS_KEY = "referencePoint";

/**
 * The default reference point set
 *
 * @const
 * @private
 * @type {string}
 */
var DEFAULT_REFERENCE_POINT = "lt";

/**
 * Globally enable tooltips.
 *
 * @return {Promise}
 */
export var enableTooltips = function () {
    return adapter.setPropertyValue(TOOLTIP_TIME_KEY, DEFAULT_TOOLTIP_TIME);
};
enableTooltips.action = {
    writes: [locks.PS_APP]
};

/**
 * Globally disable tooltips and clear any current tooltip.
 *
 * @return {Promise}
 */
export var disableTooltips = function () {
    return adapter.setPropertyValue(TOOLTIP_TIME_KEY, DISABLED_TOOLTIP_TIME).then(function () {
        adapterOS.setTooltip("");
    });
};
disableTooltips.action = {
    writes: [locks.PS_APP]
};

/**
 * Toggle pinned toolbar
 *
 * @return {Promise}
 */
export var togglePinnedToolbar = function () {
    var preferenceState = this.flux.store("preferences").getState(),
        toolbarPinned = preferenceState.get("toolbarPinned", true);

    var newToolbarPinned = !toolbarPinned;

    return this.transfer(preferences.setPreference, "toolbarPinned", newToolbarPinned);
};
togglePinnedToolbar.action = {
    reads: [],
    writes: [locks.JS_PREF],
    transfers: [preferences.setPreference]
};

/**
* Toggle small screen mode
*
* @return {Promise}
*/
export var toggleSingleColumnMode = function () {
    var preferenceState = this.flux.store("preferences").getState(),
        singleColumnModeEnabled = preferenceState.get("singleColumnModeEnabled", false);

    var newsingleColumnModeEnabled = !singleColumnModeEnabled;

    headlights.logEvent("user-interface", "panels", "single-column-mode-" + newsingleColumnModeEnabled);

    return this.transfer(preferences.setPreference, "singleColumnModeEnabled", newsingleColumnModeEnabled);
};
toggleSingleColumnMode.action = {
    reads: [],
    writes: [locks.JS_PREF],
    transfers: [preferences.setPreference]
};

/**
 * Using the center offsets, creates a cloaking rectangle on the canvas outside panels
 * that will be blitted out during scroll events
 *
 * @return {Promise}
 */
export var setOverlayCloaking = function () {
    var panelStore = this.flux.store("panel"),
        cloakRect = panelStore.getCloakRect();

    return adapterUI.setOverlayCloaking(cloakRect, ["scroll"], "afterPaint");
};
setOverlayCloaking.action = {
    reads: [locks.JS_PANEL],
    writes: [locks.PS_APP],
    modal: true
};

/**
 * Cloak the non-UI portion of the screen immediately, redrawing on the
 * next repaint.
 *
 * @return {Promise}
 */
export var cloak = function () {
    var panelStore = this.flux.store("panel"),
        cloakRect = panelStore.getCloakRect();

    return adapterUI.setOverlayCloaking(cloakRect, "immediate", "afterPaint");
};
cloak.action = {
    reads: [locks.JS_PANEL],
    writes: [locks.PS_APP],
    hideOverlays: true
};

/**
 * Parse the panel size information and dispatch the PANELS_RESIZED ui event
 *
 * @param {{toolbarWidth: number=, panelWidth: number=, headerHeight: number=}} sizes
 * @return {Promise}
 */
export var updatePanelSizes = function (sizes) {
    var transformPromise = this.transfer("ui.updateTransform"),
        dispatchPromise = this.dispatchAsync(events.panel.PANELS_RESIZED, sizes)
        .bind(this)
            .then(function () {
                var centerOffsets = this.flux.store("panel").getState().centerOffsets;
                return adapterUI.setOverlayOffsets(centerOffsets);
            })
            .then(function () {
                return this.transfer(setOverlayCloaking);
            });

    return Promise.join(transformPromise, dispatchPromise);
};
updatePanelSizes.action = {
    reads: [],
    writes: [locks.JS_PANEL, locks.PS_APP],
    transfers: [setOverlayCloaking, "ui.updateTransform"],
    modal: true
};

/**
 * Set the overlay offsets in PS in anticipation of opening/creating the
 * first document (i.e., from a state in which there are no open documents).
 * This is used, e.g., to ensure that the offsets account for the UI columns
 * that will be shown once the document is open. See #1999 for more details.
 *
 * @return {Promise}
 */
export var setOverlayOffsetsForFirstDocument = function () {
    var flux = this.flux,
        applicationStore = flux.store("application");

    if (applicationStore.getDocumentCount() > 0) {
        return Promise.resolve();
    }

    var preferencesStore = flux.store("preferences"),
        panelStore = flux.store("panel"),
        preferences = preferencesStore.getState(),
        columnCount = 0;

    if (preferences.get(panelStore.components.LAYERS_LIBRARY_COL, true)) {
        columnCount++;
    }

    if (preferences.get(panelStore.components.PROPERTIES_COL, true)) {
        columnCount++;
    }

    var centerOffsets = panelStore.getCenterOffsets(columnCount);

    return adapterUI.setOverlayOffsets(centerOffsets);
};
setOverlayOffsetsForFirstDocument.action = {
    reads: [locks.JS_PREF, locks.JS_APP, locks.JS_PANEL],
    writes: [locks.PS_APP],
    transfers: [],
    hideOverlays: true
};

/**
 * Set the global resize reference point.
 *
 * @param {string} referencePoint Two character string denoting the active reference point [lmr][tcb]
 * @return {Promise}
 */
export var setReferencePoint = function (referencePoint) {
    var dispatchPromise = this.dispatchAsync(events.panel.REFERENCE_POINT_CHANGED, {
        referencePoint: referencePoint
    });

    var preferencesPromise = this.transfer(preferences.setPreference,
        REFERENCE_POINT_PREFS_KEY, referencePoint);

    return Promise.join(dispatchPromise, preferencesPromise);
};
setReferencePoint.action = {
    reads: [],
    writes: [locks.JS_PANEL],
    transfers: [preferences.setPreference],
    modal: true
};

/**
 * Set the UI color stop.
 *
 * @param {{stop: string}} payload
 * @return {Promise}
 */
export var setColorStop = function (payload) {
    var stop = payload.stop,
        psStop = appLib.colorStops[stop],
        setColorStop = appLib.setColorStop(psStop),
        setColorStopPromise = descriptor.playObject(setColorStop),
        dispatchPromise = this.dispatchAsync(events.panel.COLOR_STOP_CHANGED, {
            stop: stop
        });

    return Promise.join(dispatchPromise, setColorStopPromise);
};
setColorStop.action = {
    reads: [],
    writes: [locks.PS_APP, locks.JS_PANEL],
    transfers: []
};

/**
 * Event handlers initialized in beforeStartup.
 *
 * @private
 * @type {function()}
 */
var _activationChangeHandler,
    _resizeHandler;

/**
 * Register event listeners for UI change events, and initialize the UI.
 *
 * @return {Promise}
 */
export var beforeStartup = function () {
    var DEBOUNCE_DELAY = 200;

    // Handles Photoshop focus change events
    _activationChangeHandler = function (event) {
        if (event.becameActive) {
            this.dispatch(events.panel.END_CANVAS_UPDATE);
        } else {
            this.dispatch(events.panel.START_CANVAS_UPDATE);
        }
    }.bind(this);
    adapterOS.addListener("activationChanged", _activationChangeHandler);

    var windowResizeDebounced = synchronization.debounce(function () {
        return this.flux.actions.panel.setOverlayCloaking();
    }, this, DEBOUNCE_DELAY, false);

    // Handles window resize for resetting superselect tool policies
    _resizeHandler = function (event) {
        windowResizeDebounced(event);
    };
    window.addEventListener("resize", _resizeHandler);

    // Initialize the reference point from preferences
    var preferences = this.flux.store("preferences"),
        referencePoint = preferences.get(REFERENCE_POINT_PREFS_KEY, DEFAULT_REFERENCE_POINT),
        setReferencePointPromise = this.transfer(setReferencePoint, referencePoint);

    // Initialize the UI color stop
    const colorStopPromise = uiUtil.getPSColorStop()
        .bind(this)
        .then(function (stop) {
            this.dispatch(events.panel.COLOR_STOP_CHANGED, {
                stop: stop
            });
        });

    return Promise.join(setReferencePointPromise, colorStopPromise);
};
beforeStartup.action = {
    reads: [],
    writes: [locks.JS_PANEL],
    transfers: [setReferencePoint],
    modal: true
};

/**
 * Remove event handlers.
 *
 * @return {Promise}
 */
export var onReset = function () {
    adapterOS.removeListener("activationChanged", _activationChangeHandler);
    window.removeEventListener("resize", _resizeHandler);

    return Promise.resolve();
};
onReset.action = {
    reads: [],
    writes: [],
    modal: true
};
