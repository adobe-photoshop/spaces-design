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
        Fluxxor = require("fluxxor");

    var Designshop = require("jsx!js/jsx/DesignShop"),
        stores = require("./stores/index"),
        actions = require("./actions/index"),
        descriptor = require("adapter/ps/descriptor"),
        log = require("./util/log");
        
    if (window.__PG_DEBUG__ === true) {
        window._PSDevEchoEvents = function () {
            /* DEV ONLY */
            descriptor.on("all", function (eventID, obj) {
                var str = "('" + eventID + "', " + JSON.stringify(obj, null, " ") + ");";
                log.info(str);
            });
        };
    }

    var _setup = function () {
        var flux = new Fluxxor.Flux(stores, actions),
            props = {
                flux: flux
            };

        
        /* jshint newcap:false */
        React.renderComponent(Designshop(props), document.body, function () {
            log.info("Main component mounted");
        });
        
        flux.actions.documents.startListening();
        /* jshint newcap:true */
    };

    if (document.readyState === "complete") {
        _setup();
    } else {
        window.addEventListener("load", _setup);
    }
});
