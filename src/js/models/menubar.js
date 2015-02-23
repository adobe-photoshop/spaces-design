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

    var strings = require("i18n!nls/strings"),
        keyutil = require("js/util/key");

    /**
     * Record structures
     */
    
    /**
     * A model of a menu item
     *
     * @constructor
     */
    var MenuItem = Immutable.Record({
        /**
         * @type {string} "Separator" for separators, unused otherwise
         */
        type: null,

        /**
         * @type {string} ID of the menu item
         */
        id: null,

        /**
         * @type {string} Localized label to show for this item
         */
        label: null,

        /**
         * @type {[MenuItem]}
         */
        submenu: null,

        /**
         * @type {string}
         */
        command: null,

        /**
         * @type {modifiers: <number>, keyCode: <number>}
         */
        shortcut: null,

        /**
         * @type {boolean}
         */
        enabled: null
    });

    /**
     * A model for the menu bar application currently shows
     *
     * @constructor
     */
    var MenuBar = Immutable.Record({
        /**
         * Identifier for this menu bar
         *
         * @type {string}
         */
        id: null,

        /**
         * Root Menus (File/Edit/etc.)
         *
         * @type {Immutable.List.<MenuItem>}
         */
        roots: null,

        /**
         * All menu enablers
         *
         * @type {Immutable.Map.<string, Immutable.List.<string>}
         */
        enablers: null,

        /**
         * Map of menu item to called action data
         *
         * @type {Immutable.Map.<string, object>}
         */
        actions: null
    });

    /**
     * Helper functions
     */
    
    /**
     * Process the raw action descriptor into enablement rules
     * and action description and adds them to MenuBar's maps
     *
     * @private
     * @param {object} rawActions
     * @param {Map.<string,object>} actionMap Maps menu item ID to flux action identifiers 
     * @param {Map.<string, Array.<string>>} enablerMap Maps menu item ID to an array of rules for enablement
     * @param {string} prefix
     */
    var _processMenuActions = function (rawActions, actionMap, enablerMap, prefix) {
        _.forEach(rawActions, function (descriptor, prop) {
            var id;
            if (prefix === undefined) {
                id = prop;
            } else {
                id = prefix + "." + prop;
            }

            var ruleArray;
            if (descriptor.hasOwnProperty("enable-rule")) {
                var rules = descriptor["enable-rule"];
                
                ruleArray = rules.split(",");
            } else {
                ruleArray = [];
            }
            
            enablerMap.set(id, ruleArray);
            
            if (descriptor.hasOwnProperty("$action")) {
                var action = {
                    $action: descriptor.$action
                };

                if (descriptor.hasOwnProperty("$payload")) {
                    action.$payload = descriptor.$payload;
                }
                actionMap.set(id, action);
            } else {
                if (prop !== "enable-rule") {
                    _processMenuActions(descriptor, actionMap, enablerMap, id);
                }
            }
        }, this);
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
     * Updates rule results given document
     * Current rules are:
     *  - "always"
     *  - "have-document"
     *  - "layer-selected"
     *  - "multiple-layers-selected"
     * 
     * @private
     * @param {Document} document current document model
     * @return {Map.<string, boolean>} Result of each rule on current conditions
     */
    var _buildRuleResults = function (document) {
        return {
            "always": true,
            "have-document":
                (document !== null),
            "layer-selected":
                (document !== null) &&
                (document.layers !== null) &&
                (document.layers.selected.size !== 0),
            "multiple-layers-selected":
                (document !== null) &&
                (document.layers !== null) &&
                (document.layers.selected.size > 1)
        };
    };

    /**
     * Constructors
     */

    /**
     * Process a high-level menu description into a low-level menu description
     * that can be submitted to the adapter for installation. Ensures that each
     * menu item has the correct command ID and localized label.
     *
     * @constructor
     * @param {object} rawMenu
     * @param {string=} prefix
     * @param {number: {number: boolean}} shortcutTable Existence check for shortcuts
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

        if (rawMenu.hasOwnProperty("submenu")) {
            processedMenu.label = _getLabelForSubmenu(id);
            var rawSubMenu = rawMenu.submenu.map(function (rawSubMenu) {
                return MenuItem.fromDescriptor(rawSubMenu, id, shortcutTable);
            }, this);

            processedMenu.submenu = Immutable.List(rawSubMenu);
        } else {
            processedMenu.label = _getLabelForEntry(id);
            processedMenu.command = id;
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
     * Constructs the menu bar object from the JSON objects
     * Constructng MenuItems along the way
     *
     * @constructor
     * @param {object} menuObj Describes menu items
     * @param {object} menuActionsObj Describes menu item behavior
     *
     * @return {MenuBar}
     */
    MenuBar.fromJSONObjects = function (menuObj, menuActionsObj) {
        if (!menuObj.hasOwnProperty("id") ||
            !menuObj.hasOwnProperty("menu")) {
            throw new Error("Missing menu id and submenu");
        }

        var menuID = menuObj.id,
            // Process each root submenu into roots
            roots = Immutable.List(menuObj.menu.map(function (rawMenu) {
                return MenuItem.fromDescriptor(rawMenu);
            })),
            actions = new Map(),
            enablers = new Map();

        // Parse the menu actions object
        _processMenuActions(menuActionsObj, actions, enablers);
        
        return new MenuBar({
            id: menuID,
            roots: roots,
            enablers: Immutable.Map(enablers),
            actions: Immutable.Map(actions)
        });
    };

    /**
     * Exports a Photoshop readable object of this menu item
     * Omits the null values
     *
     * @return {object}
     */
    MenuItem.prototype.exportDescriptor = function () {
        var itemObj = _.omit(this.toObject(), _.isNull);

        if (this.submenu !== null) {
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
        var newSubmenu = null;
        if (this.submenu !== null) {
            newSubmenu = this.submenu.map(function (subMenuItem) {
                return subMenuItem._update(enablers, rules);
            });
        }

        var itemRules = enablers.get(this.id, []);
        var newEnabled = itemRules.every(function (rule) {
            return rules[rule];
        });
        
        return this.mergeDeep({
            enabled: newEnabled,
            submenu: newSubmenu
        });
    };

    /**
     * Given the document, runs enable checks on all menu items
     * to update them
     *
     * @param {Document} document
     */
    MenuBar.prototype.updateMenuItems = function (document) {
        var rules = _buildRuleResults(document);

        var newRoots = this.roots.map(function (rootItem) {
            return rootItem._update(this.enablers, rules);
        }, this);

        return this.mergeDeep({
            roots: newRoots
        });
    };

    /**
     * Returns the menu action given menu item ID
     *
     * @param {string} menuID dot delimited string
     *
     * @return {{$action:function(), $payload:object}} [description]
     */
    MenuBar.prototype.getMenuAction = function (menuID) {
        return this.actions.get(menuID);
    };

    /**
     * Returns the menu list as one object ready to be passed into Photoshop
     * @return {Array.<EventPolicy>}
     */
    MenuBar.prototype.getMenuDescriptor = function () {
        return {
            id: this.id,
            menu: this.roots.map(function (item) {
                return item.exportDescriptor();
            }).toArray()
        };
    };

    module.exports = MenuBar;
});
