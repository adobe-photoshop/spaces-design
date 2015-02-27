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

    var ps = require("adapter/ps"),
        ui = require("adapter/ps/ui");

    var events = require("js/events"),
        locks = require("js/locks"),
        system = require("js/util/system"),
        log = require("js/util/log");

    var macMenuJSON = require("text!static/menu-mac.json"),
        winMenuJSON = require("text!static/menu-win.json"),
        menuActionsJSON = require("text!static/menu-actions.json");

    /**
     * Execute a native Photoshop menu command.
     * 
     * @param {{commandID: number}} payload
     * @return {Promise}
     */
    var nativeCommand = function (payload) {
        if (!payload.hasOwnProperty("commandID")) {
            log.error("Missing native menu command ID");
            return;
        }

        var commandID = payload.commandID;
        return ps.performMenuCommand(commandID);
    };

    /**
     * Temporary helper function to easily open the testrunner. This should
     * eventually replaced with a action that opens the testrunner in a new
     * window.
     */
    var runTestsCommand = function () {
        if (window.__PG_DEBUG__) {
            var href = location.href,
                baseHref = href.substring(0, href.lastIndexOf("src/index.html")),
                testHref = baseHref + "test/index.html";

            window.setTimeout(function () {
                location.href = testHref;
            }, 0);
        }

        return Promise.resolve();
    };

    /**
     * Resolve an action path into a callable action function
     *
     * @private
     * @param {string} actionPath
     * @return {function()}
     */
    var _resolveAction = function (actionPath) {
        var actionNameParts = actionPath.split("."),
            actionModuleName = actionNameParts[0],
            actionName = actionNameParts[1];

        return this.flux.actions[actionModuleName][actionName].bind(this);
    };

    /**
     * Loads menu descriptors, installs menu handlers and a menu store listener
     * to reload menus
     * 
     * @return {Promise}
     */
    var beforeStartupCommand = function () {
        var rawMenuJSON = system.isMac ? macMenuJSON : winMenuJSON,
            rawMenuObj = JSON.parse(rawMenuJSON),
            rawMenuActions = JSON.parse(menuActionsJSON);

        // Menu item clicks come to us from Photoshop through this event
        ui.on("menu", function (payload) {
            var command = payload.command,
                menuStore = this.flux.store("menu"),
                descriptor = menuStore.getApplicationMenu().getMenuAction(command);

            if (!descriptor) {
                log.error("Unknown menu command:", command);
                return;
            }

            var action = _resolveAction.call(this, descriptor.$action),
                $payload = descriptor.$payload;

            if (!$payload || !$payload.preserveFocus) {
                document.activeElement.blur();
            }

            action($payload);
        }.bind(this));

        // We listen to menu store directly from this action
        // and reload menus, menu store emits change events
        // only when the menus actually have changed
        this.flux.store("menu").on("change", function () {
            var menuStore = this.flux.store("menu"),
                menuDescriptor = menuStore.getApplicationMenu().getMenuDescriptor();

            ui.installMenu(menuDescriptor);
        });

        // Menu store waits for this event to parse descriptors
        this.dispatch(events.menus.INIT_MENUS, {
            menus: rawMenuObj,
            actions: rawMenuActions
        });

        return Promise.resolve();
    };

    var native = {
        command: nativeCommand,
        reads: locks.ALL_PS_LOCKS,
        writes: locks.ALL_PS_LOCKS
    };

    var nativeModal = {
        command: nativeCommand,
        reads: locks.ALL_PS_LOCKS,
        writes: locks.ALL_PS_LOCKS,
        modal: true
    };

    var runTests = {
        command: runTestsCommand
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        reads: [locks.JS_MENU],
        writes: [locks.PS_MENU]
    };

    exports.native = native;
    exports.nativeModal = nativeModal;
    exports.runTests = runTests;
    exports.beforeStartup = beforeStartup;
});
