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
        system = require("js/util/system"),
        strings = require("i18n!nls/strings"),
        menuLabels = require("i18n!nls/menu");

    var events = require("js/events");

    var menuActions = require("js/actions/menu");

    /**
     * Get a localized label for the full path of the given menu entry ID
     *
     * @private
     * @param {string} id
     * @return {string}
     */
    var _getLabelForEntry = function (id) {
        var parts = id.split("."),
            path = "",
            currMenuLabels = menuLabels;

        parts.forEach(function (part) {
            if (currMenuLabels[part] === undefined) {
                path = null;
                return false;
            }

            if (currMenuLabels[part].$MENU) {
                path += currMenuLabels[part].$MENU + ">";
                currMenuLabels = currMenuLabels[part];
            } else {
                path += currMenuLabels[part];
            }
        });

        return path;
    };
    
    /**
     * Get a shortcut as a string for the given menu entry shortcut object
     *
     * @private
     * @param {object} fullShortcut
     * @return {string}
     */
    var _getShortcut = function (fullShortcut) {
        var modifierBits = fullShortcut.modifiers,
            keyChar = fullShortcut.keyChar,
            keyCode = fullShortcut.keyCode,
            modifierStrings = strings.SEARCH.MODIFIERS,
            keyCodeStrings = strings.KEYCODE,
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
            shortcut += keyCodeStrings[keyCode];
        }

        return " " + shortcut + "\u00a0\u00a0\u00a0\u00a0";
    };
    
    /**
     * Make list of recent documents info so search store can create search options
     * 
     * @private
     * @return {Immutable.List.<object>}
    */
    var _menuCommandSearchOptions = function () {
        var menuStore = this.flux.store("menu"),
            menu = menuStore.getApplicationMenu(),
            menuMap = menu.rootMap,
            roots = menu.roots.reverse();

        var menuCommands = [];
        roots.forEach(function (root) {
            var currRoot = menuMap.get(root.id),
                nodes = [currRoot],
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
                        shortcut = _getShortcut(currItem.shortcut);
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

    /*
     * Find SVG class for menu commands
     * If this needs to vary based on the item, use category list as parameter 
     * (see getSVGCallback type in search store)
     * 
     * @return {string}
    */
    var _getSVGClass = function () {
        return "menu-commands";
    };
    
    /*
     * Register recent document info for search
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

        this.dispatch(events.search.REGISTER_SEARCH_PROVIDER, menuCommandPayload);
    };

    exports.registerMenuCommandSearch = registerMenuCommandSearch;
});
