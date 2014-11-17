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

define(function (require) {
    "use strict";

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        Promise = require("bluebird");

    var MainCl = require("jsx!js/jsx/Main"),
        storeIndex = require("./stores/index"),
        actionIndex = require("./actions/index");

    var Main = React.createFactory(MainCl);

    /** 
     * The main Fluxxor instance.
     * @private
     * @type {?Fluxxor.Flux}
     */
    var _flux = null;

    /**
     * Start up the application.
     * 
     * @private
     */
    var _startup = function () {
        var stores = storeIndex.create(),
            flux = new Fluxxor.Flux(stores, actionIndex),
            props = {
                flux: flux
            };

        Object.keys(flux.actions).forEach(function (module) {
            var mod = flux.actions[module];

            if (mod.hasOwnProperty("onStartup")) {
                flux.actions[module].onStartup();
            }
        });

        React.render(new Main(props), document.body, function () {
            _flux = flux;
        });
    };

    /**
     * Shut down the application.
     * 
     * @private
     */
    var _shutdown = function () {
        if (!_flux) {
            return;
        }

        Object.keys(_flux.actions).forEach(function (module) {
            var mod = _flux.actions[module];

            if (mod.hasOwnProperty("onShutdown")) {
                _flux.actions[module].onShutdown();
            }
        });

        _flux = null;
    };

    if (window.__PG_DEBUG__ === true) {
        Promise.longStackTraces();
        Promise.onPossiblyUnhandledRejection(function (err) {
            throw err;
        });

        /* global _playground */
        _playground._debug.enableDebugContextMenu(true, function () {});
    }

    if (document.readyState === "complete") {
        _startup();
    } else {
        window.addEventListener("load", _startup);
    }

    window.addEventListener("beforeunload", _shutdown);
});
