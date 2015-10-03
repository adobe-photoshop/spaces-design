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

define(function (require) {
    "use strict";

    var Promise = require("bluebird");

    var ui = require("./util/ui"),
        main = require("./main");

    var mainLess = require("text!style/main.less");

    // HACK: we need to fix our imports to support this kind of dynamic loading?
    mainLess = mainLess.replace(/@import \".\//g, "@import \"./style/");

    var windowReady = new Promise(function (resolve) {
        if (window.document.readyState === "complete") {
            resolve();
        } else {
            window.addEventListener("load", resolve);
        }
    });

    var stylesReady = ui.getPSColorStop()
        .then(function (stop) {
            return window.less.render(mainLess, {
                globalVars: {
                    "stop": stop
                }
            });
        })
        .then(function (result) {
            var style = window.document.createElement("style");

            style.type = "text/css";
            style.innerHTML = result.css;

            var stylePromise = new Promise(function (resolve) {
                style.addEventListener("load", resolve);
            });

            window.document.head.appendChild(style);

            return stylePromise;
        });

    Promise.join(windowReady, stylesReady, function () {
        main.startup();
        window.addEventListener("beforeunload", main.shutdown.bind(main));
    });
});
