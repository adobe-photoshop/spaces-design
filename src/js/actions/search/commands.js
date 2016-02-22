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

    var _ = require("lodash"),
        Immutable = require("immutable"),
        keyUtil = require("js/util/key"),
        mathUtil = require("js/util/math"),
        system = require("js/util/system"),
        nls = require("js/util/nls");

    var events = require("js/events"),
        locks = require("js/locks"),
        menuActions = require("js/actions/menu"),
        shortcutActions = require("js/actions/shortcuts");

    /**
     * Get a localized label for the full path of the given menu entry ID
     * inserting > character between parent names
     *
     * @private
     * @param {string} id
     * @return {string}
     */
    var _getLabelForEntry = function (id) {
        var parts = id.split("."),
            resultPath = "",
            nlsPath = "menu",
            menuTree;

        parts.forEach(function (part) {
            if (!_.isNumber(mathUtil.parseNumber(part, 10))) {
                nlsPath = nlsPath + "." + part;
                menuTree = nls.localize(nlsPath);

                if (menuTree === undefined) {
                    resultPath = null;
                    return false;
                }

                if (menuTree.$MENU) {
                    resultPath += menuTree.$MENU + " > ";
                } else {
                    resultPath += menuTree;
                }
            }
        });

        return resultPath;
    };
    
    /**
     * Get a shortcut as a string for menu entry shortcut object
     *
     * @private
     * @param {object} fullShortcut
     * @return {string}
     */
    var _getMenuCommandString = function (fullShortcut) {
        var modifierBits = fullShortcut.modifiers,
            keyChar = fullShortcut.keyChar,
            keyCode = fullShortcut.keyCode,
            modifierStrings = nls.localize("strings.SEARCH.MODIFIERS"),
            shortcut = "";

        var modifierChars = {
            "command": "\u2318",
            "control": system.isMac ? "^" : modifierStrings.CONTROL,
            "alt": system.isMac ? "\u2325" : modifierStrings.ALT,
            "shift": "\u21E7"
        };

        if (modifierBits) {
            var modifiers = keyUtil.bitsToModifiers(modifierBits);
            
            _.forEach(Object.keys(modifiers), function (key) {
                if (modifiers[key]) {
                    shortcut += modifierChars[key];
                }
            });
        }

        if (keyChar) {
            shortcut += keyChar.toString().toUpperCase();
        }

        if (keyCode) {
            shortcut += nls.localize("strings.KEYCODE." + keyCode);
        }

        return " " + shortcut + "\u00a0\u00a0\u00a0\u00a0";
    };
    
    /**
     * Make list of shortcut commands info so search store can create search options
     * 
     * @private
     * @return {Immutable.List.<object>}
    */
    var _menuCommandSearchOptions = function () {
        var menuStore = this.flux.store("menu"),
            menu = menuStore.getApplicationMenu(),
            roots = menu.roots.reverse();

        var menuCommands = [];
        roots.forEach(function (root) {
            var nodes = [root],
                currItem;

            while (nodes.length > 0) {
                currItem = nodes.pop();
                if (currItem.submenu && currItem.enabled) {
                    nodes = nodes.concat(currItem.submenu.toArray());
                } else if (currItem.enabled) {
                    var id = currItem.id,
                        ancestry = _getLabelForEntry(id),
                        shortcut = "";
                    
                    if (currItem.shortcut) {
                        shortcut = _getMenuCommandString(currItem.shortcut);
                    }

                    if (ancestry) {
                        menuCommands.push({
                            id: currItem.id,
                            name: currItem.label,
                            pathInfo: shortcut + ancestry,
                            iconID: "menu-commands",
                            category: ["MENU_COMMAND"]
                        });
                    }
                }
            }
        });

        return Immutable.List(menuCommands.reverse());
    };
 
    /**
     * Perform menu command when its item is confirmed in search
     *
     * @private
     * @param {string} id ID of menu command
    */
    var _confirmMenuCommand = function (id) {
        menuActions._playMenuCommand.call(this, id);
    };

    /**
     * Translates the modifiers and key to a string for the UI
     *
     * @private
     * @param {object} fullShortcut
     * @return {string}
     */
    var _getGlobalShortcutString = function (fullShortcut) {
        var modifierBits = fullShortcut.modifiers,
            key = fullShortcut.key,
            modifierStrings = nls.localize("strings.SEARCH.MODIFIERS"),
            shortcut = "";

        if (modifierBits.command) {
            shortcut += "\u2318";
        }

        if (modifierBits.control) {
            shortcut += system.isMac ? "^" : modifierStrings.CONTROL;
        }

        if (modifierBits.alt) {
            shortcut += system.isMac ? "\u2325" : modifierStrings.ALT;
        }

        if (modifierBits.shift) {
            shortcut += "\u21E7";
        }

        if (key) {
            shortcut += key.toString().toUpperCase();
        }

        return " " + shortcut + "\u00a0\u00a0\u00a0\u00a0";
    };
    
    /**
     * Make list global shortcuts so search store can create search options
     * 
     * @private
     * @return {Immutable.List.<object>}
    */
    var _globalShortcutSearchOptions = function () {
        var shortcutStore = this.flux.store("shortcut");
        var shortcuts = shortcutStore.getState().shortcuts;
        var shortcutCommands = [];

        shortcuts.forEach(function (shortcut) {
            var shortcutUI = _getGlobalShortcutString(shortcut);
            // Presence of a name indicates it not a contextual global shortcut
            if (shortcut.name) {
                shortcutCommands.push({
                    // Symbol() is often used as the id for shortcuts if no id is explicitly dictated.
                    // The ids are used as keys in a flattened list of search results, therefore must be a unique string
                    id: shortcut.name,
                    // Shown in the UI
                    name: shortcut.name,
                    // Shown in the UI
                    pathInfo: shortcutUI,
                    iconID: "menu-commands",
                    category: ["GLOBAL_SHORTCUT"]
                });
            }
        });

        return Immutable.List(shortcutCommands);
    };
 
    /**
     * Perform menu command when its item is confirmed in search
     *
     * @private
     * @param {string} id ID of menu command
    */
    var _confirmShortcut = function (id) {
        shortcutActions._executeShortcut.call(this, id);
    };

    /**
     * Find SVG class for menu commands
     * If this needs to vary based on the item, use category list as parameter 
     * (see getSVGCallback type in search store)
     * 
     * @return {string}
    */
    var _getSVGClass = function () {
        return "menu-commands";
    };
    
    /**
     * Register menu commands and associated shortcuts for search
     */
    var registerMenuCommandSearch = function () {
        var menuCommandPayload = {
            "type": "MENU_COMMAND",
            "getOptions": _menuCommandSearchOptions.bind(this),
            "filters": Immutable.List.of("MENU_COMMAND"),
            "handleExecute": _confirmMenuCommand.bind(this),
            "shortenPaths": false,
            "getSVGClass": _getSVGClass
        };

        return this.dispatchAsync(events.search.REGISTER_SEARCH_PROVIDER, menuCommandPayload);
    };
    registerMenuCommandSearch.action = {
        reads: [],
        writes: [locks.JS_SEARCH]
    };

    /**
     * Register global shortcut info for search
     */
    var registerGlobalShortcutSearch = function () {
        var globalShortcutPayload = {
            "type": "GLOBAL_SHORTCUT",
            "getOptions": _globalShortcutSearchOptions.bind(this),
            "filters": Immutable.List.of("GLOBAL_SHORTCUT"),
            "handleExecute": _confirmShortcut.bind(this),
            "shortenPaths": false,
            "getSVGClass": _getSVGClass
        };

        return this.dispatchAsync(events.search.REGISTER_SEARCH_PROVIDER, globalShortcutPayload);
    };
    registerGlobalShortcutSearch.action = {
        reads: [],
        writes: [locks.JS_SEARCH]
    };

    exports.registerGlobalShortcutSearch = registerGlobalShortcutSearch;
    exports.registerMenuCommandSearch = registerMenuCommandSearch;
});
