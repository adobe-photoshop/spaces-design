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

define(function (require, exports, module) {
    "use strict";

    var os = require("adapter").os,
        _ = require("lodash"),
        Immutable = require("immutable");

    var UI = require("adapter").ps.ui;

    var nls = require("js/util/nls"),
        keyutil = require("js/util/key"),
        global = require("js/util/global");
    
    /**
     * A model of a menu item
     *
     * @constructor
     */
    var MenuItem = Immutable.Record({
        /**
         * "separator" for separators, unused otherwise
         * @type {string} 
         */
        type: null,

        /**
         * ID of the menu item, building up from Root
         * @type {string} 
         */
        id: null,

        /**
         * In-place identifier of menu item
         * @type {string} 
         */
        itemID: null,

        /**
         *  Localized label to show for this item
         * @type {string}
         */
        label: null,

        /**
         * @type {Immutable.List.<MenuItem>}
         */
        submenu: null,

        /**
         * Maps from itemID to submenus, sans separators
         * @type {Immutable.Map.<string, MenuItem>} 
         */
        submenuMap: null,

        /**
         * @type {string}
         */
        command: null,

        /**
         * @type {string}
         */
        commandKind: null,

        /**
         * @type {{modifiers: number=, keyCode: number}}
         */
        shortcut: null,

        /**
         * @type {boolean}
         */
        enabled: null,

        /**
         * @type {number}
         */
        checked: null
    });

    /**
     * Get a localized label for the given menu entry ID
     * Helper to nls.localize, prepending "menus." to the menu item ID
     *
     * @private
     * @param {string} id
     * @return {string|Object.<string, string>}
     */
    var _getLabelForEntry = function (id) {
        return nls.localize("menus." + id);
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
     * @param {object} rawMenu
     * @param {string=} prefix
     * @param {Object.<string, Object.<number, boolean>>} shortcutTable Existence check for shortcuts
     * @return {MenuItem}
     */
    MenuItem.fromDescriptor = function (rawMenu, prefix, shortcutTable) {
        if (shortcutTable === undefined) {
            shortcutTable = {};
        }

        var processedMenu = {};

        if (rawMenu.separator) {
            processedMenu.type = "separator";
            return new MenuItem(processedMenu);
        }

        if (!rawMenu.hasOwnProperty("id")) {
            throw new Error("Missing menu id");
        }
        processedMenu.id = rawMenu.id;

        var id;
        if (prefix === undefined) {
            id = rawMenu.id;
        } else {
            id = prefix + "." + rawMenu.id;
        }

        processedMenu.id = id;
        processedMenu.itemID = rawMenu.id;

        if (rawMenu.hasOwnProperty("enabled")) {
            processedMenu.enabled = rawMenu.enabled;
        }

        if (rawMenu.hasOwnProperty("submenu")) {
            processedMenu.label = _getLabelForSubmenu(id);

            var submenuMap = new Map(),
                rawSubMenu = rawMenu.submenu;

            // Filter out debug-only menu entries in non-debug mode
            if (!global.debug) {
                rawSubMenu = rawSubMenu.filter(function (subMenu) {
                    return !subMenu.debug;
                });
            }

            rawSubMenu = rawSubMenu.map(function (rawSubMenu) {
                var menuItem = MenuItem.fromDescriptor(rawSubMenu, id, shortcutTable);

                // Add all non separator sub menu items to the map
                if (menuItem.type !== "separator") {
                    submenuMap.set(menuItem.itemID, menuItem);
                }

                return menuItem;
            }, this);

            processedMenu.submenuMap = Immutable.Map(submenuMap);
            processedMenu.submenu = Immutable.List(rawSubMenu);
        } else {
            processedMenu.label = _getLabelForEntry(id);
            processedMenu.command = id;
        }

        if (rawMenu.hasOwnProperty("commandKind")) {
            processedMenu.commandKind = UI.commandKind[rawMenu.commandKind];
        }
        
        if (rawMenu.hasOwnProperty("shortcut")) {
            var rawKeyChar = rawMenu.shortcut.keyChar,
                rawKeyCode = rawMenu.shortcut.keyCode,
                rawModifiers = rawMenu.shortcut.modifiers || {},
                rawModifierBits = keyutil.modifiersToBits(rawModifiers),
                shortcutTableKey;

            processedMenu.shortcut = {
                modifiers: rawModifierBits
            };

            if (rawKeyChar && rawKeyCode) {
                throw new Error("Menu entry specifies both key char and code");
            }

            if (rawKeyChar) {
                processedMenu.shortcut.keyChar = rawKeyChar;
                shortcutTableKey = "char-" + rawKeyChar;
            } else if (rawKeyCode) {
                if (!os.eventKeyCode.hasOwnProperty(rawKeyCode)) {
                    throw new Error("Menu entry specifies unknown key code: " + rawKeyCode);
                }

                processedMenu.shortcut.keyCode = os.eventKeyCode[rawKeyCode];
                shortcutTableKey = "code-" + rawKeyCode;
            } else {
                throw new Error("Menu entry does not specify a key for its shortcut");
            }

            // Check for conflicting menu shortcuts
            if (!shortcutTable.hasOwnProperty(shortcutTableKey)) {
                shortcutTable[shortcutTableKey] = {};
            }

            if (shortcutTable[shortcutTableKey][rawModifierBits]) {
                throw new Error("Menu entry shortcut duplicate: " + shortcutTableKey);
            } else {
                shortcutTable[shortcutTableKey][rawModifierBits] = true;
            }
        }

        return new MenuItem(processedMenu);
    };

    /**
     * Exports a Photoshop readable object of this menu item
     * Omits the null values
     *
     * @return {object}
     */
    MenuItem.prototype.exportDescriptor = function () {
        var itemObj = _.omit(this.toObject(), _.isNull);

        delete itemObj.submenuMap;

        if (this.submenu !== null) {
            // Disable submenus with no items in them
            if (this.submenu.isEmpty()) {
                itemObj.enabled = false;
            }

            itemObj.submenu = this.submenu.map(function (submenuItem) {
                return submenuItem.exportDescriptor();
            }).toArray();
        }

        return itemObj;
    };

    /**
     * Merge the given props into the submenu item with the given ID
     *
     * @param {string} submenuID string ID of the menu item within the submenu
     * @param {object} props object with properties to merge in to the MenuItem
     * @return {MenuItem}
     */
    MenuItem.prototype.updateSubmenuProps = function (submenuID, props) {
        var menuItem = this.submenuMap.get(submenuID),
            menuIndex = this.submenu.indexOf(menuItem);
     
        menuItem = menuItem.merge(props);

        // Immutable.List.merge does not play well with sparse arrays, so there did not seem to be a way to 
        // use a single merge command with a POJSO
        return this
            .setIn(["submenu", menuIndex], menuItem)
            .setIn(["submenuMap", submenuID], menuItem);
    };

    /**
     * Updates the menu item's children and then the menu item
     * Right now we only update enabled, but later on dynamic updating can be done here
     *
     * @param {Immutable.Map.<string, Immutable.List.<string>>} enablers
     * @param {Immutable.Map.<string, boolean>} rules
     *
     * @return {MenuItem}
     */
    MenuItem.prototype._update = function (enablers, rules) {
        var newSubmenu = null,
            newSubmenuMap = new Map();
            
        if (this.submenu !== null) {
            newSubmenu = this.submenu.map(function (subMenuItem) {
                var newItem = subMenuItem._update(enablers, rules);
                newSubmenuMap.set(newItem.itemID, newItem);
                return newItem;
            });
        }

        var itemRules = enablers.get(this.id, Immutable.List()),
            newEnabled;

        if (itemRules.isEmpty()) {
            newEnabled = false;
        } else {
            newEnabled = itemRules.every(function (rule) {
                return rules[rule];
            });
        }
        
        return this.merge({
            enabled: newEnabled,
            submenu: newSubmenu,
            submenuMap: newSubmenuMap
        });
    };

    module.exports = MenuItem;
});
