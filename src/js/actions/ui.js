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
            .then( function(transform) {
                return [transform[0].toWindow, transform[1].value];
            })
            .catch(function (err) {
                debugger;
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
     * Register event listeners for UI change events, and initialize the UI.
     * 
     * @private
     * @return {Promise}
     */
    var onStartupCommand = function () {
        var DEBOUNCE_DELAY = 500;

        // Handles zoom and pan events
        var setTransformDebounced = synchronization.debounce(function (event) {
            if (event.transform) {
                return this.flux.actions.ui.updateTransform();
                // FIXME: the transform value in the event is incorrect when the
                // event is caused by document creation. When that bug is fixed,
                // the updateTransform call should be replaced with the following
                // setTransform call.
                // return this.flux.actions.ui.setTransform(event.transform.value);
            }
        }, this, DEBOUNCE_DELAY);
        descriptor.addListener("scroll", setTransformDebounced);

        // Handles window resize events
        var updateTransformDebounced = synchronization
            .debounce(this.flux.actions.ui.updateTransform, this, DEBOUNCE_DELAY);
        window.addEventListener("resize", updateTransformDebounced);

        // Enable over-scroll mode
        var osPromise = adapterUI.setOverscrollMode(adapterUI.overscrollMode.ALWAYS_OVERSCROLL);

        // Hide OWL UI
        var owlPromise = adapterUI.setClassicChromeVisibility(false);

        // Initialize the window transform
        var transformPromise = this.transfer(updateTransform);

        return Promise.join(osPromise, owlPromise, transformPromise);
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

    var onStartup = {
        command: onStartupCommand,
        reads: [locks.PS_APP],
        writes: [locks.JS_APP]
    };

    exports.updateTransform = updateTransform;
    exports.setTransform = setTransform;
    exports.onStartup = onStartup;
});
