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

import * as Promise from "bluebird";
import * as _ from "lodash";

import * as adapter from "adapter";

var ps = adapter.ps,
    ui = adapter.ps.ui,
    descriptor = adapter.ps.descriptor;

import * as events from "js/events";
import * as locks from "js/locks";
import * as system from "js/util/system";
import * as log from "js/util/log";
import * as global from "js/util/global";
import * as headlights from "js/util/headlights";
import * as policyActions from "./policy";
import * as preferencesActions from "./preferences";

import * as macMenuJSON from "static/menu-mac.json";
import * as winMenuJSON from "static/menu-win.json";
import * as rawShortcuts from "js/util/shortcuts";
import * as rawMenuActions from "static/menu-actions.json";
import * as rawTemplates from "static/templates.json";

var rawMenuObj = system.isMac ? macMenuJSON : winMenuJSON,
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
export var native = function (payload) {
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
            if (global.debug && !success) {
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
export var nativeModal = function (payload) {
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
export var openURL = function (payload) {
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
    writes: []
};

/**
 * Temporary helper function to easily open the testrunner. This should
 * eventually replaced with a action that opens the testrunner in a new
 * window.
 */
export var runTests = function () {
    if (global.debug) {
        var href = window.location.href,
            baseHref = href.substring(0, href.lastIndexOf("src/index.html")),
            testHref = baseHref + "test/index.html";

        window.setTimeout(function () {
            window.location.href = testHref;
        }, 0);
    }

    return Promise.resolve();
};
runTests.action = {
    reads: [],
    writes: []
};

/**
 * An action that always fails, for testing purposes.
 *
 * @private
 * @return {Promise}
 */
export var actionFailure = function () {
    return Promise.reject(new Error("Test: action failure"));
};
actionFailure.action = {
    reads: [],
    writes: []
};

/**
 * An action with a transfer that always fails, for testing purposes.
 *
 * @private
 * @return {Promise}
 */
export var transferFailure = function () {
    return this.transfer(actionFailure)
        .catch(function () {
            // Failed transfers always cause a controller reset, so
            // catching these failures doesn't really help.
        });
};
transferFailure.action = {
    reads: [],
    writes: [],
    transfers: [actionFailure]
};

/**
 * A flag for testing purposes which, if set, will cause onReset to fail.
 * 
 * @private
 * @type {boolean}
 */
var _failOnReset = false;

/**
 * An action that always fails, for testing purposes, and which causes onReset
 * to fail as well.
 *
 * @private
 * @return {Promise}
 */
export var resetFailure = function () {
    _failOnReset = true;
    return Promise.reject(new Error("Test: reset failure"));
};
resetFailure.action = {
    reads: [],
    writes: []
};

/**
 * An action that always fails, for testing purposes, and which causes onReset
 * to fail as well.
 *
 * @private
 * @return {Promise}
 */
export var corruptModel = function () {
    var applicationStore = this.flux.store("application"),
        documentStore = this.flux.store("document"),
        document = applicationStore.getCurrentDocument();

    if (document) {
        var index = document.layers.index,
            nextIndex = index.unshift(null),
            nextDocument = document.setIn(["layers", "index"], nextIndex);

        documentStore._openDocuments[document.id] = nextDocument;
    }

    return Promise.reject(new Error("Test: corrupt model"));
};
corruptModel.action = {
    reads: [],
    writes: []
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
        actionThrottled = this.flux.actions[actionModuleName][actionNameThrottled];

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
 * Reload the page.
 *
 * @private
 * @return {Promise}
 */
export var resetRecess = function () {
    window.location.reload();
    return Promise.resolve();
};
resetRecess.action = {
    reads: [],
    writes: []
};

/**
 * Debug only method to toggle pointer policy area visualization
 *
 * @return {Promise}
 */
export var togglePolicyFrames = function () {
    if (!global.debug) {
        return Promise.resolve();
    }

    var preferencesStore = this.flux.store("preferences"),
        preferences = preferencesStore.getState(),
        enabled = preferences.get("policyFramesEnabled");

    return this.transfer(preferencesActions.setPreference, "policyFramesEnabled", !enabled);
};
togglePolicyFrames.action = {
    reads: [],
    writes: [locks.JS_PREF],
    transfers: [preferencesActions.setPreference]
};

/**
 * Debug only method to toggle post condition verification
 *
 * @return {Promise}
 */
export var togglePostconditions = function () {
    if (!global.debug) {
        return Promise.resolve();
    }

    var preferencesStore = this.flux.store("preferences"),
        preferences = preferencesStore.getState(),
        enabled = preferences.get("postConditionsEnabled");

    return this.transfer(preferencesActions.setPreference, "postConditionsEnabled", !enabled);
};
togglePostconditions.action = {
    reads: [],
    writes: [locks.JS_PREF],
    transfers: [preferencesActions.setPreference]
};

/**
 * This handler will be triggered when the user confirm or cancel the new layer 
 * created from the place-linked or place-embedded menu item.
 *
 * @return {Promise}
 */
export var handleExecutedPlaceCommand = function () {
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
 * Debug-only method to toggle action transfer logging
 *
 * @return {Promise}
 */
export var toggleActionTransferLogging = function () {
    if (!global.debug) {
        return Promise.resolve();
    }

    var preferencesStore = this.flux.store("preferences"),
        preferences = preferencesStore.getState(),
        enabled = preferences.get("logActionTransfers");

    return this.transfer(preferencesActions.setPreference, "logActionTransfers", !enabled);
};
toggleActionTransferLogging.action = {
    reads: [],
    writes: [locks.JS_PREF],
    transfers: [preferencesActions.setPreference]
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
export var beforeStartup = function () {
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
export var afterStartup = function () {
    return this.transfer("searchCommands.registerMenuCommandSearch");
};
afterStartup.action = {
    reads: [],
    writes: [],
    transfers: ["searchCommands.registerMenuCommandSearch"]
};

/**
 * Remove event handlers.
 *
 * @private
 * @return {Promise}
 */
export var onReset = function () {
    ui.removeListener("menu", _adapterMenuHandler);
    this.flux.store("menu").removeListener("change", _menuChangeHandler);
    descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);

    // For debugging purposes only
    if (_failOnReset) {
        return Promise.reject();
    }

    return Promise.resolve();
};
onReset.action = {
    reads: [],
    writes: []
};
