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
        strings = require("i18n!nls/strings"),
        global = require("js/util/global");

    var Main = React.createFactory(MainCl),
        controller = new FluxController();

    /**
     * Handle error events from the FluxController instance. These errors are
     * fatal, so they're handled by aborting and returning to Classic.
     *
     * @private
     * @param {{cause: Error}} event
     */
    var _handleControllerError = function (event) {
        if (global.debug) {
            var cause = event.cause;
            log.error("Unrecoverable error", cause);
            _shutdown();
        } else {
            var message = strings.ERR.UNRECOVERABLE;
            adapter.abort({message: message}, function (err) {
                log.error("Abort failed", err);
            });
        }
    };

    /**
     * Start up the application.
     * 
     * @private
     */
    var _startup = function () {

        var startTime = Date.now(),
            version = adapter.version;

        log.info("Spaces adapter version: %d.%d.%d",
            version.major, version.minor, version.patch);

        controller.on("error", _handleControllerError);

        var props = {
            controller: controller,
            flux: controller.flux
        };

        var startupPromises = controller.start()
            .then(function () {
                log.debug("Actions loaded: %dms", Date.now() - startTime);
            });

        var renderPromise = new Promise(function (resolve) {
            React.render(new Main(props), document.body, function () {
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
     * 
     * @private
     */
    var _shutdown = function () {
        controller.off("error", _handleControllerError);
        controller.stop();
    };

    if (global.debug) {
        Promise.longStackTraces();
        Promise.onPossiblyUnhandledRejection(function (err) {
            throw err;
        });

        React.addons.Perf.start();

        /* global _spaces */
        _spaces._debug.enableDebugContextMenu(true, function () {});
    }

    if (document.readyState === "complete") {
        _startup();
    } else {
        window.addEventListener("load", _startup);
    }

    window.addEventListener("beforeunload", _shutdown);

    exports.controller = controller;
});
