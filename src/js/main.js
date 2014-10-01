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

    var Designshop = require("jsx!js/jsx/DesignShop"),
        photoshopEvent = require("adapter/lib/photoshopEvent"),
        stores = require("./stores/index"),
        actions = require("./actions/index"),
        descriptor = require("adapter/ps/descriptor"),
        log = require("js/util/log"),
        ui = require("adapter/ps/ui");
        
    if (window.__PG_DEBUG__ === true) {
        Promise.longStackTraces();
        Promise.onPossiblyUnhandledRejection(function (err) {
            throw err;
        });
    }

    /**
     * Register event listeners for tool selection change events, and initialize
     * the currently selected tool.
     * 
     * @private
     * @param {Fluxxor} flux
     * @return {Promise}
     */
    var _initTools = function (flux) {
        descriptor.addListener("select", function (event) {
            var toolStore = flux.store("tool"),
                psToolName = photoshopEvent.targetOf(event),
                tool = toolStore.inferTool(psToolName);

            if (!tool) {
                log.warn("Failed to infer tool from native tool", psToolName);
                tool = toolStore.getDefaultTool();
            }

            flux.actions.tools.select(tool);
        });

        return flux.actions.tools.initialize();
    };

    /**
     * Register event listeners for active and open document change events, and
     * initialize the active and open document lists.
     * 
     * @private
     * @param {Fluxxor} flux
     * @return {Promise}
     */
    var _initDocuments = function (flux) {
        descriptor.addListener("make", function (event) {
            if (photoshopEvent.targetOf(event) === "document") {
                flux.actions.documents.updateDocumentList();
            }
        });
        
        descriptor.addListener("select", function (event) {
            if (photoshopEvent.targetOf(event) === "document") {
                flux.actions.documents.updateDocumentList();
            }
        });
        
        return flux.actions.documents.updateDocumentList();
    };

    var _setup = function () {
        var flux = new Fluxxor.Flux(stores, actions),
            props = {
                flux: flux
            };

        // Hide OWL UI
        ui.setClassicChromeVisibility(false);

        _initTools(flux);
        _initDocuments(flux);
        
        React.renderComponent(new Designshop(props), document.body);
    };

    if (document.readyState === "complete") {
        _setup();
    } else {
        window.addEventListener("load", _setup);
    }
});
