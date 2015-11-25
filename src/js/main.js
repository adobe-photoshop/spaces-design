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

    var React = require("react"),
        Promise = require("bluebird"),
        adapter = require("adapter");

    var MainCl = require("jsx!js/jsx/Main"),
        FluxController = require("./fluxcontroller"),
        log = require("js/util/log"),
        nls = require("js/util/nls"),
        global = require("js/util/global");

    /**
     * The application controller. Holds the internal Fluxxor.Flux instance.
     *
     * @private
     * @type {?FluxController}
     */
    var _controller;

    /**
     * Handle error events from the FluxController instance. These errors are
     * fatal, so they're handled by aborting and returning to Classic.
     *
     * @private
     * @param {{cause: Error}} event
     */
    var _handleControllerError = function (event) {
        var err = event.cause,
            message = err instanceof Error ? (err.stack || err.message) : err;

        log.error("Unrecoverable error:", message);

        if (global.debug) {
            shutdown();
        } else {
            var dialogMessage = nls.localize("strings.ERR.UNRECOVERABLE");
            adapter.abort({ message: dialogMessage }, function (err) {
                var message = err instanceof Error ? (err.stack || err.message) : err;

                log.error("Abort failed:", message);
            });
        }
    };

    /**
     * Format a version object a string.
     *
     * @private
     * @param {{major: number=, minor: number=, patch: number=}} version
     * @return {string}
     */
    var _formatVersion = function (version) {
        return [version.major, version.minor, version.patch].join(".");
    };

    /**
     * Start up the application.
     */
    var startup = function () {
        var startTime = Date.now(),
            version = adapter.version;

        log.info("Spaces plugin version: %d.%d.%d",
            version.major, version.minor, version.patch);

        // Assert plugin compatibility
        if (!adapter.isPluginCompatible()) {
            var message = "Plugin version " + _formatVersion(adapter.version) +
                " is incompatible with the required version, " +
                 _formatVersion(adapter.compatiblePluginVersion);

            if (global.debug) {
                log.error(message);
            } else {
                throw new Error(message);
            }
        }

        var Main = React.createFactory(MainCl);

        _controller = new FluxController();
        _controller.on("error", _handleControllerError);

        var props = {
            controller: _controller,
            flux: _controller.flux
        };

        var startupPromises = _controller.start()
            .then(function () {
                log.debug("Actions loaded: %dms", Date.now() - startTime);
            });

        var renderPromise = new Promise(function (resolve) {
            React.render(new Main(props), window.document.body, function () {
                log.debug("Main component mounted: %dms", Date.now() - startTime);
                resolve();
            });
        });

        Promise.join(renderPromise, startupPromises, function () {
            log.info("Startup complete: %dms", Date.now() - startTime);
        });
    };

    /**
     * Shut down the application.
     */
    var shutdown = function () {
        _controller.off("error", _handleControllerError);
        _controller.stop();
    };

    /**
     * Get a reference to the FluxController instance.
     *
     * @return {FluxController}
     */
    var getController = function () {
        return _controller;
    };

    // TODO: Currently it is VERY hard to pinpoint the origin of Bluebird
    // warnings. When that improves, we should enable this and then fix the
    // sources of the warnings.
    Promise.config({
        warnings: false
    });

    if (global.debug) {
        Promise.longStackTraces();
        Promise.onPossiblyUnhandledRejection(function (err) {
            throw err;
        });

        React.addons.Perf.start();

        /* global _spaces */
        _spaces._debug.enableDebugContextMenu(true, function () {});
    }

    exports.startup = startup;
    exports.shutdown = shutdown;
    exports.getController = getController;
});
