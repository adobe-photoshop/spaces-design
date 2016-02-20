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

    var descriptor = require("adapter").ps.descriptor,
        appLib = require("adapter").lib.application;

    var ui = require("./util/ui"),
        nls = require("./util/nls");

    var stylesReady = ui.getPSColorStop(),
        localeReady = nls.initLocaleInfo(),
        windowReady = new Promise(function (resolve) {
            if (window.document.readyState === "complete") {
                resolve();
            } else {
                window.addEventListener("load", resolve);
            }
        });

    var appRef = appLib.referenceBy.current,
        rangeOpts = {
            range: "document",
            index: 1
        };

    descriptor.getPropertyRange(appRef, rangeOpts, "documentID", {
        cache: {
            id: "documentIDs",
            set: true
        }
    });

    require(["./main"], function (main) {
        Promise.join(stylesReady, localeReady, windowReady, function (stop) {
            main.startup(stop);
            window.addEventListener("beforeunload", main.shutdown.bind(main));
        });
    });
});
