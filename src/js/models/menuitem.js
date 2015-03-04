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

    var os = require("adapter/os"),
        _ = require("lodash"),
        Immutable = require("immutable");

    var UI = require("adapter/ps/ui");

    var strings = require("i18n!nls/strings"),
        keyutil = require("js/util/key");

    
    /**
     * A model of a menu item
     *
     * @constructor
     */
    var MenuItem = Immutable.Record({
        /**
         * @type {string} "separator" for separators, unused otherwise
         */
        type: null,

        /**
         * @type {string} ID of the menu item, building up from Root
         */
        id: null,

        /**
         * @type {string} in place identifier of menu item
         */
        itemID: null,

        /**
         * @type {string} Localized label to show for this item
         */
        label: null,

        /**
         * @type {Immutable.List.<MenuItem>}
         */
        submenu: null,

        /**
         * @type {Immutable.Map.<string, MenuItem>} Maps from itemID to submenus, sans separators
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

        if (rawMenu.hasOwnProperty("submenu")) {
            processedMenu.label = _getLabelForSubmenu(id);

            var submenuMap = new Map(),
                rawSubMenu = rawMenu.submenu.map(function (rawSubMenu) {
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

        var itemRules = enablers.get(this.id, []),
            newEnabled = itemRules.every(function (rule) {
                return rules[rule];
            });
        
        return this.merge({
            enabled: newEnabled,
            submenu: newSubmenu,
            submenuMap: newSubmenuMap
        });
    };

    module.exports = MenuItem;
});
