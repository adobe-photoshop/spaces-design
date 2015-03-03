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

    var _ = require("lodash"),
        Immutable = require("immutable");

    var MenuItem = require("./menuitem");
    
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
         * @type {Immutable.Map.<string, Immutable.List.<string>>}
         */
        enablers: null,

        /**
         * Map of menu item to Flux action name and parameters if any
         *
         * @type {Immutable.Map.<string, object>}
         */
        actions: null,

        /**
         * Map from ID to root menus
         *
         * @type {Immutable.Map.<string, MenuItem>}
         */
        rootMap: null
    });

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
            if (descriptor.hasOwnProperty("$enable-rule")) {
                var rules = descriptor["$enable-rule"];
                
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
                if (prop !== "$enable-rule") {
                    _processMenuActions(descriptor, actionMap, enablerMap, id);
                }
            }
        }, this);
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
            "layers-selected-2":
                (document !== null) &&
                (document.layers !== null) &&
                (document.layers.selectedNormalized.size === 2),
            "layers-selected-2+":
                (document !== null) &&
                (document.layers !== null) &&
                (document.layers.selectedNormalized.size > 1),
            "layers-selected-3+":
                (document !== null) &&
                (document.layers !== null) &&
                (document.layers.selectedNormalized.size > 2),
            "no-background":
                (document !== null) &&
                (document.layers !== null) &&
                !(document.layers.selected.some(function (layer) {
                    return layer.isBackground;
                })),
            "no-nesting":
                (document !== null) &&
                (document.layers !== null) &&
                !(document.layers.selected.some(function (layer) {
                    return document.layers.ancestors(layer).some(function (ancestor) {
                        return layer !== ancestor && document.layers.selected.contains(ancestor);
                    });
                }))
                
        };
    };

    /**
     * Constructs the menu bar object from the JSON objects
     * Constructng MenuItems along the way
     *
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
            rootMap = new Map(),
            // Process each root submenu into roots
            roots = Immutable.List(menuObj.menu.map(function (rawMenu) {
                var rootItem = MenuItem.fromDescriptor(rawMenu);
                rootMap.set(rootItem.id, rootItem);
                return rootItem;
            })),
            actions = new Map(),
            enablers = new Map();

        // Parse the menu actions object
        _processMenuActions(menuActionsObj, actions, enablers);
        
        return new MenuBar({
            id: menuID,
            roots: roots,
            enablers: Immutable.Map(enablers),
            actions: Immutable.Map(actions),
            rootMap: Immutable.Map(rootMap)
        });
    };

    /**
     * Given the document, runs enable checks on all menu items
     * to update them
     *
     * @param {Document} document
     */
    MenuBar.prototype.updateMenuItems = function (document) {
        var rules = _buildRuleResults(document),
            newRootMap = new Map(),
            newRoots = this.roots.map(function (rootItem) {
                var newItem = rootItem._update(this.enablers, rules);
                newRootMap.set(newItem.id, newItem);
                return newItem;
            }, this);

        return this.merge({
            roots: newRoots,
            rootMap: newRootMap
        });
    };

    /**
     * Replaces the current recent files menu with passed in file list
     *
     * @param {Array.<string>} files List of recently opened file paths
     */
    MenuBar.prototype.updateRecentFiles = function (files) {
        var recentFileMenuID = "FILE.OPEN_RECENT",
            fileMenu = this.getMenuItem("FILE"),
            // We will update the actions as we go
            newActions = this.actions,
            recentFilesMenu = this.getMenuItem(recentFileMenuID),
            recentFileItems = files.map(function (filePath, index) {
                var id = recentFileMenuID + "." + index,
                    itemDescriptor = {
                        id: id,
                        itemID: index.toString(),
                        label: filePath,
                        command: id
                    };

                newActions = newActions.set(id, {
                    "$action": "documents.open",
                    "$payload": filePath
                });
                return new MenuItem(itemDescriptor);
            }),
            // Update FILE.RECENT to have the recent files as it's submenu
            newRecentFilesMenu = recentFilesMenu.set("submenu", Immutable.List(recentFileItems)),
            // Update FILE to have the new recent files menus
            newFileMenu = fileMenu.update(function (menu) {
                var submenu = menu.submenu,
                    recentIndex = submenu.findIndex(function (item) {
                        return item.id === recentFileMenuID;
                    }),
                    newsubmenu = submenu.set(recentIndex, newRecentFilesMenu),
                    newsubmenuMap = menu.submenuMap.set(recentFileMenuID, newRecentFilesMenu);

                return menu.merge({
                    submenu: newsubmenu,
                    submenuMap: newsubmenuMap
                });
            }),
            // Update roots/rootMap to point to new File menu
            fileMenuIndex = this.roots.findIndex(function (root) {
                return root.id === "FILE";
            }),
            newRoots = this.roots.set(fileMenuIndex, newFileMenu),
            newRootMap = this.rootMap.set("FILE", newFileMenu);

        return this.merge({
            roots: newRoots,
            rootMap: newRootMap,
            actions: newActions
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

    MenuBar.prototype.getMenuItem = function (menuID) {
        var idSegments = menuID.split("."),
            rootID = idSegments.shift(),
            rootItem = this.rootMap.get(rootID, null),
            result = rootItem;

        idSegments.forEach(function (id) {
            if (result !== null) {
                result = result.submenuMap.get(id, null);
            }
        });

        return result;
    };

    module.exports = MenuBar;
});
