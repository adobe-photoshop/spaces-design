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

    var Promise = require("bluebird"),
        _ = require("lodash");

    var adapter = require("adapter"),
        ps = require("adapter").ps,
        ui = require("adapter").ps.ui,
        descriptor = require("adapter").ps.descriptor;

    var events = require("js/events"),
        locks = require("js/locks"),
        system = require("js/util/system"),
        objUtil = require("js/util/object"),
        log = require("js/util/log"),
        headlights = require("js/util/headlights"),
        policyActions = require("./policy");

    var macMenuJSON = require("static/menu-mac.json"),
        winMenuJSON = require("static/menu-win.json"),
        rawShortcuts = require("js/util/shortcuts"),
        rawMenuActions = require("static/menu-actions.json"),
        rawTemplates = require("static/templates.json"),
        rawMenuObj = system.isMac ? macMenuJSON : winMenuJSON,
        rawMenuShortcuts = rawShortcuts.MENU;
        
    // On debug builds, we always enable cut/copy/paste so they work in dev tools
    if (__PG_DEBUG__) {
        rawMenuActions.EDIT.CUT["$enable-rule"] = "always";
        rawMenuActions.EDIT.COPY["$enable-rule"] = "always";
        rawMenuActions.EDIT.PASTE["$enable-rule"] = "always";
    }

    /**
     * List of place command menu IDs.
     *
     * @private
     * @type {number}
     */
    var _PLACE_LINKED_MENU_ID = 3090,
        _PLACE_EMBEDDED_MENU_ID = 1032;

    /**
     * Execute a native Photoshop menu command.
     * 
     * @param {{commandID: number, waitForCompletion: boolean=}} payload
     * @return {Promise}
     */
    var native = function (payload) {
        if (!payload.hasOwnProperty("commandID")) {
            var error = new Error("Missing native menu command ID");
            return Promise.reject(error);
        }

        var isPlaceCommand = payload.commandID === _PLACE_LINKED_MENU_ID ||
                payload.commandID === _PLACE_EMBEDDED_MENU_ID;
        
        return Promise.bind(this)
            .then(function () {
                // This is a hack for the place linked/embedded menu commands which do not
                // seem to promptly emit a toolModalStateChanged:enter event
                if (isPlaceCommand) {
                    this.dispatch(events.menus.PLACE_COMMAND, { executing: true });
                    
                    if (!this.flux.store("policy").areAllSuspended()) {
                        return this.transfer(policyActions.suspendAllPolicies);
                    }
                }
            })
            .then(function () {
                // Photoshop expects commandId with a lower case d, so convert here
                payload.commandId = payload.commandID;
                
                return ps.performMenuCommand(payload);
            })
            .then(function (success) {
                if (__PG_DEBUG__ && !success) {
                    log.error("Menu command not available: " + payload.commandID);
                }
                
                // Return the menu command result for outer promise chain.
                return success;
            })
            .catch(function (error) {
                if (isPlaceCommand) {
                    // Call the handler for any exceptions to make sure
                    // the policies are restored and relevent event is dispatched.
                    return this.transfer(handleExecutedPlaceCommand);
                }
                
                // Re-throw the error
                throw error;
            });
    };
    native.action = {
        reads: locks.ALL_NATIVE_LOCKS,
        writes: locks.ALL_NATIVE_LOCKS,
        transfers: [policyActions.suspendAllPolicies, "menu.handleExecutedPlaceCommand"]
    };

    /**
     * Execute a native Photoshop menu command modally.
     * 
     * @param {{commandID: number, waitForCompletion: boolean?}} payload
     * @return {Promise}
     */
    var nativeModal = function (payload) {
        return native.call(this, payload);
    };
    nativeModal.action = {
        reads: locks.ALL_NATIVE_LOCKS,
        writes: locks.ALL_NATIVE_LOCKS,
        modal: true
    };

    /**
     * Open a URL in the user's default browser.
     * 
     * @param {{url: string, category: string, subcategory: string, eventName: string}} payload
     * @return {Promise}
     */
    var openURL = function (payload) {
        if (!payload.hasOwnProperty("url")) {
            var error = new Error("Missing URL");
            return Promise.reject(error);
        }
        if (payload.category !== null && payload.subcategory !== null && payload.eventName !== null) {
            headlights.logEvent(payload.category, payload.subcategory, payload.eventName);
        }

        return adapter.openURLInDefaultBrowser(payload.url);
    };
    openURL.action = {
        reads: [],
        writes: [],
        modal: true
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
            actionName = actionNameParts[1],
            actionNameThrottled = actionName + "Throttled",
            actionThrottled = objUtil.getPath(this.flux.actions, actionModuleName)[actionNameThrottled];

        return actionThrottled;
    };

    /**
     * Call action for menu command
     *
     * @param {string} commandID 
     */
    var _playMenuCommand = function (commandID) {
        var menuStore = this.flux.store("menu"),
            descriptor = menuStore.getApplicationMenu().getMenuAction(commandID);

        if (!descriptor) {
            log.error("Unknown menu command:", commandID);
            return;
        }

        descriptor = descriptor.toObject();

        var action = _resolveAction.call(this, descriptor.$action),
            $payload = descriptor.$payload,
            $dontLog = descriptor.$dontLog || false,
            menuKeys = commandID.split("."),
            subcategory = menuKeys.shift(),
            event = menuKeys.pop();

        if (!$payload || !$payload.preserveFocus) {
            window.document.activeElement.blur();
        }

        if (!$dontLog) {
            headlights.logEvent("menu", subcategory, _.kebabCase(event));
        }

        action($payload);
    };
    
    /**
     * This handler will be triggered when the user confirm or cancel the new layer 
     * created from the place-linked or place-embedded menu item.
     *
     * @return {Promise}
     */
    var handleExecutedPlaceCommand = function () {
        return this.dispatchAsync(events.menus.PLACE_COMMAND, { executing: false })
            .bind(this)
            .then(function () {
                if (this.flux.store("policy").areAllSuspended()) {
                    return this.transfer(policyActions.restoreAllPolicies);
                }
            });
    };
    handleExecutedPlaceCommand.action = {
        reads: [],
        writes: [locks.JS_MENU, locks.PS_MENU],
        transfers: [policyActions.restoreAllPolicies]
    };

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _menuChangeHandler,
        _adapterMenuHandler,
        _toolModalStateChangedHandler;

    /**
     * Loads menu descriptors, installs menu handlers and a menu store listener
     * to reload menus
     * 
     * @return {Promise}
     */
    var beforeStartup = function () {
        // We listen to menu store directly from this action
        // and reload menus, menu store emits change events
        // only when the menus actually have changed
        _menuChangeHandler = function () {
            var menuStore = this.flux.store("menu"),
                appMenu = menuStore.getApplicationMenu();

            if (appMenu !== null) {
                var menuDescriptor = appMenu.getMenuDescriptor();
                ui.installMenu(menuDescriptor)
                    .catch(function (err) {
                        log.warn("Failed to install menu: ", err, menuDescriptor);
                    });
            }
        }.bind(this);

        this.flux.store("menu").on("change", _menuChangeHandler);
        
        if (!__PG_DEBUG__) {
            var debugMenuIndex = rawMenuObj.menu.findIndex(function (menu) {
                return menu.id === "DEBUG";
            });

            rawMenuObj.menu.splice(debugMenuIndex, 1);
        }

        // Menu store waits for this event to parse descriptors
        this.dispatch(events.menus.INIT_MENUS, {
            menus: rawMenuObj,
            shortcuts: rawMenuShortcuts,
            templates: rawTemplates,
            actions: rawMenuActions
        });

        // Menu item clicks come to us from Photoshop through this event
        var controller = this.controller;
        _adapterMenuHandler = function (payload) {
            if (!controller.active) {
                return;
            }
            
            _playMenuCommand.call(this, payload.command);
        }.bind(this);
        ui.on("menu", _adapterMenuHandler);
        
        _toolModalStateChangedHandler = function (event) {
            var isExecutingPlaceCommand = this.flux.store("menu").getState().isExecutingPlaceCommand,
                modalStateEnded = event.state && event.state._value === "exit";

            if (isExecutingPlaceCommand && modalStateEnded) {
                this.flux.actions.menu.handleExecutedPlaceCommand();
            }
        }.bind(this);
        descriptor.addListener("toolModalStateChanged", _toolModalStateChangedHandler);

        return Promise.resolve();
    };
    beforeStartup.action = {
        reads: [],
        writes: [locks.JS_MENU, locks.PS_MENU]
    };
    
    /**
     * Send info about menu commands to search store
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        return this.transfer("search.commands.registerMenuCommandSearch");
    };
    afterStartup.action = {
        reads: [],
        writes: [],
        transfers: ["search.commands.registerMenuCommandSearch"]
    };

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        ui.removeListener("menu", _adapterMenuHandler);
        this.flux.store("menu").removeListener("change", _menuChangeHandler);
        descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: []
    };

    exports.native = native;
    exports.nativeModal = nativeModal;
    exports.openURL = openURL;
    exports.handleExecutedPlaceCommand = handleExecutedPlaceCommand;
    exports._playMenuCommand = _playMenuCommand;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;
});
