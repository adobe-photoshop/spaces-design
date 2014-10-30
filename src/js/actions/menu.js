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

    var locks = require("js/locks"),
        system = require("js/util/system"),
        os = require("adapter/os"),
        ps = require("adapter/ps"),
        ui = require("adapter/ps/ui"),
        log = require("js/util/log"),
        strings = require("i18n!nls/strings");

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
     * Get a localized label for the given menu entry ID
     *
     * @private
     * @param {string} id
     * @return {string|Object.<string, string>}
     */
    var _getLabelForEntry = function (id) {
        var parts = id.split("."),
            labels = strings.MENU;

        parts.forEach(function (part) {
            if (!labels.hasOwnProperty(part)) {
                throw new Error("Missing label for menu entry: " + id);
            }

            labels = labels[part];
        });

        return labels;
    };

    /**
     * Get a localized label for the given submenu ID
     *
     * @private
     * @param {string} id
     * @return {string}
     */
    var _getLabelForSubmenu = function (id) {
        var labels = _getLabelForEntry(id);

        if (!labels.hasOwnProperty("$MENU")) {
            throw new Error("Missing label for menu: " + id);
        }

        return labels.$MENU;
    };

    /**
     * Process a high-level menu description into a low-level menu description
     * that can be submitted to the adapter for installation. Ensures that each
     * menu item has the correct command ID and localized label.
     *
     * @private
     * @param {object} rawMenu
     * @param {string=} prefix
     * @return {object}
     */
    var _processMenuDescriptor = function (rawMenu, prefix) {
        var processedMenu = {};

        if (rawMenu.separator) {
            processedMenu.type = "separator";
            return processedMenu;
        }

        if (!rawMenu.hasOwnProperty("id")) {
            throw new Error("Missing menu id");
        }
        processedMenu.id = rawMenu.id;

        if (rawMenu.hasOwnProperty("menu")) {
            processedMenu.menu = rawMenu.menu.map(function (rawSubMenu) {
                return _processMenuDescriptor(rawSubMenu);
            });
            return processedMenu;
        }

        var entryID;
        if (prefix === undefined) {
            entryID = rawMenu.id;
        } else {
            entryID = prefix + "." + rawMenu.id;
        }

        if (rawMenu.hasOwnProperty("submenu")) {
            processedMenu.label = _getLabelForSubmenu(entryID);
            processedMenu.submenu = rawMenu.submenu.map(function (rawSubMenu) {
                return _processMenuDescriptor(rawSubMenu, entryID);
            });
        } else {
            processedMenu.label = _getLabelForEntry(entryID);
            processedMenu.command = entryID;
        }

        if (rawMenu.hasOwnProperty("shortcut")) {
            processedMenu.shortcut = {
                key: rawMenu.shortcut.key
            };

            if (typeof rawMenu.shortcut.modifiers === "object") {
                processedMenu.shortcut.modifiers = Object.keys(rawMenu.shortcut.modifiers)
                    .reduce(function (sum, modifier) {
                        if (rawMenu.shortcut.modifiers[modifier]) {
                            sum += os.eventModifiers[modifier.toUpperCase()];
                        }
                        return sum;
                    }, 0);
            } else {
                processedMenu.modifiers = 0;
            }
        }

        return processedMenu;
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
     * Map a raw menu action description into one with callable actions
     *
     * @private
     * @param {object} rawActions
     * @return {object}
     */
    var _resolveMenuActions = function (rawActions) {
        var allActions = {},
            prop,
            descriptor;

        for (prop in rawActions) {
            if (rawActions.hasOwnProperty(prop)) {
                descriptor = rawActions[prop];

                if (descriptor.hasOwnProperty("$action")) {
                    allActions[prop] = {
                        $action: _resolveAction.call(this, descriptor.$action)
                    };

                    if (descriptor.hasOwnProperty("$payload")) {
                        allActions[prop].$payload = descriptor.$payload;
                    }
                } else {
                    allActions[prop] = _resolveMenuActions.call(this, descriptor);
                }
            }
        }

        return allActions;
    };

    /**
     * Collapse a hierarchical table of menu actions into a flat table.
     *
     * @private
     * @param {object} descriptors The hierarchical table
     * @param {string=} prefix Summary of ancestors keys into the table
     * @param {object=} result An accumulation parameter
     * @return {Object.<string, {action: function(), payload: object}>}
     */
    var _flattenMenuActions = function (descriptors, prefix, result) {
        if (result === undefined) {
            result = {};
        }

        var prop,
            descriptor,
            entryID;

        for (prop in descriptors) {
            if (descriptors.hasOwnProperty(prop)) {
                descriptor = descriptors[prop];

                if (prefix === undefined) {
                    entryID = prop;
                } else {
                    entryID = prefix + "." + prop;
                }

                if (descriptor.hasOwnProperty("$action")) {
                    result[entryID] = descriptor;
                } else {
                    _flattenMenuActions(descriptor, entryID, result);
                }
            }
        }

        return result;
    };

    /**
     * Process the raw menu actions description, both resolving the actions into
     * callable functions, and flattening the hierarchical definitions into a
     * single lookup table. 
     * 
     * @private
     * @param {object} rawActions
     * @return {Object.<string, {action: function(), payload: object}>}
     */
    var _processMenuActions = function (rawActions) {
        var resolvedActions = _resolveMenuActions.call(this, rawActions);

        return _flattenMenuActions(resolvedActions);
    };

    /**
     * Install the menu bar, process the menu actions, and install a menu
     * actions handler.
     * 
     * @return {Promise}
     */
    var onStartupCommand = function () {
        var rawMenuJSON = system.isMac ? macMenuJSON : winMenuJSON,
            rawMenuObj = JSON.parse(rawMenuJSON),
            rawMenuActions = JSON.parse(menuActionsJSON),
            menuObj = _processMenuDescriptor(rawMenuObj),
            menuActions = _processMenuActions.call(this, rawMenuActions);

        ui.on("menu", function (payload) {
            var command = payload.command,
                descriptor = menuActions[command];

            if (!descriptor) {
                log.error("Unknown menu command:", command);
                return;
            }

            descriptor.$action(descriptor.$payload);
        });

        return ui.installMenu(menuObj);
    };

    var native = {
        command: nativeCommand,
        reads: locks.ALL_PS_LOCKS,
        writes: locks.ALL_PS_LOCKS
    };

    var onStartup = {
        command: onStartupCommand,
        reads: [locks.JS_APP],
        writes: [locks.PS_APP]
    };

    exports.onStartup = onStartup;
    exports.native = native;
});
