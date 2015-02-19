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
        _ = require("lodash");

    var strings = require("i18n!nls/strings"),
        log = require("js/util/log"),
        keyutil = require("js/util/key");

    /**
     * Represents the application menu bar and items in it
     * 
     * @constructor
     */
    var MenuBar = function () {
        this._shortcutTable = {};
        this._enableRules = {};
        this._menuItems = {};
        this._mainMenu = null;
    };

    /**
     * Map of menu item ID to menu items for quick access
     * @type {{string: MenuItem}}
     */
    MenuBar.prototype._menuItems = null;

    /**
     * Root of the menu tree
     * @type {object}
     */
    MenuBar.prototype._mainMenu = null;

    /**
     * Keeps track of currently used shortcuts
     *
     * @type {object}
     */
    MenuBar.prototype._shortcutTable = null;

    /**
     * Keeps track of enable rules for each menu item
     * We can't keep this in _menuItems because Photoshop doesn't like
     * having unknown keys in objects
     *
     * @type {object}
     */
    MenuBar.prototype._enableRules = null;

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
    MenuBar.prototype._processMenuDescriptor = function (rawMenu, prefix) {
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
                return this._processMenuDescriptor(rawSubMenu);
            }, this);
            return processedMenu;
        }

        var entryID;
        if (prefix === undefined) {
            entryID = rawMenu.id;
        } else {
            entryID = prefix + "." + rawMenu.id;
        }

        if (rawMenu.hasOwnProperty("submenu")) {
            processedMenu.label = this._getLabelForSubmenu(entryID);
            processedMenu.submenu = rawMenu.submenu.map(function (rawSubMenu) {
                return this._processMenuDescriptor(rawSubMenu, entryID);
            }, this);
            // Menus/submenus are always defined by default
            this._enableRules[entryID] = ["always"];
        } else {
            processedMenu.label = this._getLabelForEntry(entryID);
            processedMenu.command = entryID;
            // Initialize to "not-defined" here, actions will set them if
            // provided
            this._enableRules[entryID] = ["not-defined"];

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
            if (!this._shortcutTable.hasOwnProperty(shortcutTableKey)) {
                this._shortcutTable[shortcutTableKey] = {};
            }

            if (this._shortcutTable[shortcutTableKey][rawModifierBits]) {
                throw new Error("Menu entry shortcut duplicate: " + shortcutTableKey);
            } else {
                this._shortcutTable[shortcutTableKey][rawModifierBits] = true;
            }
        }

        this._menuItems[entryID] = processedMenu;

        return processedMenu;
    };

    /**
     * Get a localized label for the given menu entry ID
     *
     * @private
     * @param {string} id
     * @return {string|Object.<string, string>}
     */
    MenuBar.prototype._getLabelForEntry = function (id) {
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
    MenuBar.prototype._getLabelForSubmenu = function (id) {
        var labels = this._getLabelForEntry(id);

        if (!labels.hasOwnProperty("$MENU")) {
            throw new Error("Missing label for menu: " + id);
        }

        return labels.$MENU;
    };

    /**
     * Map a raw menu action descriptor into callable actions and
     * add them to overall menu items
     *
     * @private
     * @param {object} rawActions
     * @param {string} prefix
     */
    MenuBar.prototype._processMenuActions = function (rawActions, prefix) {
        _.forEach(rawActions, function (descriptor, prop) {
            var entryID;
            if (prefix === undefined) {
                entryID = prop;
            } else {
                entryID = prefix + "." + prop;
            }

            if (descriptor.hasOwnProperty("$action")) {
                this._menuItems[entryID].action = {
                    $action: descriptor.$action
                };

                if (descriptor.hasOwnProperty("$payload")) {
                    this._menuItems[entryID].action.$payload = descriptor.$payload;
                }

                if (descriptor.hasOwnProperty("enable-rule")) {
                    var rules = descriptor["enable-rule"];

                    this._enableRules[entryID] = rules.split(",");
                } else {
                    this._enableRules[entryID] = ["not-defined"];
                }
            } else {
                this._processMenuActions(descriptor, entryID);
            }
        }, this);
    };

    /**
     * Checks the given rules for a menu item against the current document
     * Determining whether the menu item should be enabled or not
     * Current rules are:
     *  - "always"
     *  - "have-document"
     *  - "layer-selected"
     *  - "multiple-layers"
     *  - "not-defined"
     * 
     * @private
     * @param {Array.<string>} rules
     * @param {Document} document current document model
     * @return {boolean} Whether the menu is enabled or not
     */
    MenuBar.prototype._runEnableRules = function (rules, document) {
        return rules.reduce(function (enabled, rule) {
            switch (rule) {
            case "always":
                enabled = true;
                break;
            case "have-document":
                enabled = enabled && document;
                break;
            case "layer-selected":
                enabled = enabled && document && document.layers &&
                    (document.layers.selected.size !== 0);
                break;
            case "multiple-layers":
                enabled = enabled && document && document.layers &&
                    (document.layers.selected.size > 1);
                break;
            case "not-defined":
                enabled = false;
                break;
            }

            return !!enabled;
        }, true);
    };

    /**
     * Given the document, runs enable checks on all menu items
     * to update them
     *
     * @param {Document} document
     */
    MenuBar.prototype.updateMenuItems = function (document) {
        _.forEach(this._enableRules, function (rules, itemID) {
            var menuItem = this._menuItems[itemID],
                enabled = this._runEnableRules(rules, document);

            menuItem.enabled = enabled;
        }, this);
    };

    /**
     * Returns the menu action given menu item ID
     *
     * @param {string} menuID dot delimited string
     *
     * @return {{$action:function(), $payload:object}} [description]
     */
    MenuBar.prototype.getMenuAction = function (menuID) {
        var menuItem = this._menuItems[menuID];

        if (!menuItem) {
            log.error("Unknown menu ID:", menuID);
            return null;
        }

        return this._menuItems[menuID].action;
    };

    /**
     * Returns the menu list as one object ready to be passed into Photoshop
     * @return {Array.<EventPolicy>}
     */
    MenuBar.prototype.getMasterMenuList = function () {
        return this._mainMenu;
    };

    /**
     * Given raw JSON objects describing menu items and menu actions
     * loads them to internal data structures
     * 
     * @param {object} menuObj
     * @param {object} menuActionsObj
     */
    MenuBar.prototype.loadMenus = function (menuObj, menuActionsObj) {
        this._mainMenu = this._processMenuDescriptor(menuObj);

        this._processMenuActions(menuActionsObj);
    };

    module.exports = MenuBar;
});
