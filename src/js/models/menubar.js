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

    var MenuItem = require("./menuitem"),
        keyutil = require("js/util/key"),
        global = require("js/util/global"),
        pathUtil = require("js/util/path"),
        system = require("js/util/system");
    
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
                
                ruleArray = Immutable.List(rules.split(","));
            } else {
                ruleArray = Immutable.List();
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
     * Updates menu-enablement rule results for the given document.
     * 
     * @private
     * @param {Object.<number, Document>} openDocuments All open documents
     * @param {Document} document current document model
     * @param {boolean} hasPreviousHistoryState is there a previous history state in the list
     * @param {boolean} hasNextHistoryState is there a next history state in the list
     * @param {boolean} appIsModal is there a global modal that should disable most menu items
     * @param {boolean} appIsInputModal true if app is in a modal state and the modal has a text input
     * @param {boolean} exportEnabled true if the export service has been enabled and is available
     * @return {Map.<string, boolean>} Result of each rule on current conditions
     */
    var _buildRuleResults = function (openDocuments, document,
            hasPreviousHistoryState, hasNextHistoryState, appIsModal, appIsInputModal, exportEnabled) {
        if (appIsModal || appIsInputModal) {
            return {
                "always": true,
                "always-except-modal": false,
                "super-search-or-have-document": appIsInputModal
            };
        }
        return {
            "always": true,
            "always-except-modal": true,
            "super-search-or-have-document":
                (document !== null),
            "have-document":
                (document !== null),
            "supported-document":
                (document !== null) &&
                !document.unsupported,
            "export-enabled":
                (document !== null) && exportEnabled,
            "psd-document":
                (document !== null) &&
                !document.unsupported &&
                document.format === "Photoshop",
            "dirty-document":
                (document !== null) &&
                document.dirty,
            "dirty-previously-saved-document":
                (document !== null) &&
                document.dirty &&
                document.format,
            "layer-selected":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                (document.layers.selected.size !== 0),
            "layers-selected-1":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                (document.layers.selected.size === 1),
            "layers-selected-2":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                (document.layers.selectedNormalized.size === 2),
            "layers-selected-2+":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                (document.layers.selectedNormalized.size > 1),
            "layers-selected-3+":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                (document.layers.selectedNormalized.size > 2),
            "layers-selected-all-shapes":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                (document.layers.selected.every(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                })),
            "no-background":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                !document.layers.backgroundSelected,
            "no-artboards":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                !document.layers.selected.some(function (layer) {
                    return layer.isArtboard;
                }),
            "no-nesting":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                !(document.layers.selected.some(function (layer) {
                    return document.layers.ancestors(layer).some(function (ancestor) {
                        return layer !== ancestor && document.layers.selected.contains(ancestor);
                    });
                })),
            "have-linked":
                (document !== null) &&
                !document.unsupported &&
                document.layers.hasLinkedSmartObjects,
            "multiple-documents":
                Object.keys(openDocuments).length > 1,
            "earlier-history":
                (document !== null) && hasPreviousHistoryState,
            "later-history":
                (document !== null) && hasNextHistoryState,
            "one-layer-selected-has-vector-mask":
                (document !== null) &&
                !document.unsupported &&
                (document.layers !== null) &&
                (document.layers.selectedNormalized.size === 1) &&
                (document.layers.selected.every(function (layer) {
                    return layer.vectorMaskEnabled === true;
                }))
        };
    };

    /**
     * Incorporate templates into the menus and menu actions.
     * 
     * @private
     * @param {object} menus
     * @param {object} actions
     * @param {Array.<object>} templates
     */
    var _processTemplates = function (menus, actions, templates) {
        var templateActions = actions.FILE.NEW_FROM_TEMPLATE,
            fileMenuIndex = _.findIndex(menus.menu, function (menu) {
                return menu.id === "FILE";
            }),
            fileMenu = menus.menu[fileMenuIndex],
            templateIndex = _.findIndex(fileMenu.submenu, function (menu) {
                return menu.id === "NEW_FROM_TEMPLATE";
            }),
            templateMenu = fileMenu.submenu[templateIndex];
            
        templateMenu.submenu = templates.map(function (templateObj) {
            var id = templateObj.id,
                preset = templateObj.preset;

            // Define the template menu action 
            templateActions[id] = {
                "$enable-rule": "always-except-modal",
                "$action": "documents.createNew",
                "$payload": {
                    preset: preset
                }
            };

            // Define the template menu entry
            return { id: id };
        });
    };

    /**
     * Incorporates artboard templates into the menu and menu actions
     * 
     * @private
     * @param {object} menus
     * @param {object} actions
     * @param {Array.<object>} templates
     */
    var _artboardFromTemplates = function (menus, actions, templates) {
        var templateActions = actions.LAYER.NEW_ARTBOARD_FROM_TEMPLATE,
            fileMenuIndex = _.findIndex(menus.menu, function (menu) {
                return menu.id === "LAYER";
            }),
            fileMenu = menus.menu[fileMenuIndex],
            templateIndex = _.findIndex(fileMenu.submenu, function (menu) {
                return menu.id === "NEW_ARTBOARD_FROM_TEMPLATE";
            }),
            templateMenu = fileMenu.submenu[templateIndex];
            
        templateMenu.submenu = templates.map(function (templateObj) {
            var id = templateObj.id,
                preset = templateObj.preset;

            // Define the template menu action 
            templateActions[id] = {
                "$enable-rule": "always-except-modal",
                "$action": "layers.createArtboard",
                "$payload": {
                    preset: preset
                }
            };

            // Define the template menu entry
            return { id: id };
        });
    };

    /**
     * Replace keyChar and keyCode properties of menu shortcuts with localized
     * strings.
     *
     * @private
     * @param {Array.<object>} entries
     * @param {Object.<string, string>=} shortcuts
     */
    var _resolveShortcuts = function (entries, shortcuts) {
        entries.forEach(function (entry) {
            var id = entry.id;

            if (entry.hasOwnProperty("shortcut")) {
                var shortcut = entry.shortcut;
                if (!shortcut.keyCode && !shortcut.keyChar) {
                    throw new Error("Menu entry " + id + " has a shortcut without a key.");
                }

                if (!shortcuts) {
                    throw new Error("Submenu " + id + " does not have corresponding localized shortcut keys.");
                }

                if (!shortcuts.hasOwnProperty(id)) {
                    throw new Error("Menu entry " + id + " has a shorcut with an unlocalized key.");
                }

                var key = shortcuts[id];
                if (shortcut.hasOwnProperty("keyChar")) {
                    if (key.length !== 1) {
                        throw new Error("Menu entry " + id + " has an invalid character shortcut key: " + key);
                    }
                    shortcut.keyChar = key;
                } else {
                    shortcut.keyCode = key;
                }
            } else if (entry.hasOwnProperty("submenu")) {
                _resolveShortcuts(entry.submenu, shortcuts[id]);
            }
        });
    };

    /**
     * Constructs the menu bar object from the JSON objects
     * Constructing MenuItems along the way
     *
     * @param {object} menuObj Describes menu items
     * @param {object} shortcuts Localized keyboard shortcuts referenced by menu descriptor
     * @param {object} menuActionsObj Describes menu item behavior
     * @return {MenuBar}
     */
    MenuBar.fromJSONObjects = function (menuObj, shortcuts, menuActionsObj, templates) {
        if (!menuObj.hasOwnProperty("id") ||
            !menuObj.hasOwnProperty("menu")) {
            throw new Error("Missing menu id and submenu");
        }

        _resolveShortcuts(menuObj.menu, shortcuts);

        // Incorporate templates into menus and actions
        _processTemplates(menuObj, menuActionsObj, templates);
        _artboardFromTemplates(menuObj, menuActionsObj, templates);

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
     * Given all documents and current document, runs enable checks on all menu items
     * to update them
     * 
     * @param {Object.<number, Document>} openDocuments
     * @param {Document} document
     * @param {boolean} hasPreviousHistoryState is there a previous history state in the list
     * @param {boolean} hasNextHistoryState is there a next history state in the list
     * @param {boolean} appIsModal true if the app is in a globally modal state
     * @param {boolean} appIsInputModal true if app is in a modal state and the modal has a text input
     * @param {boolean} exportEnabled true if the export service has been enabled and is available
     * @return {MenuBar}
     */
    MenuBar.prototype.updateMenuItems = function (openDocuments, document,
            hasPreviousHistoryState, hasNextHistoryState, appIsModal, appIsInputModal, exportEnabled) {
        var rules = _buildRuleResults(openDocuments, document,
                hasPreviousHistoryState, hasNextHistoryState, appIsModal, appIsInputModal, exportEnabled),
            newRootMap = new Map(),
            newRoots;

        if (this.roots && this.roots.size > 0) {
            newRoots = this.roots.map(function (rootItem) {
                var newItem = rootItem._update(this.enablers, rules);
                newRootMap.set(newItem.id, newItem);
                return newItem;
            }, this);
        } else {
            newRoots = Immutable.List();
        }

        return this.merge({
            roots: newRoots,
            rootMap: newRootMap
        });
    };

    /**
     * Given the current document, update the View menu
     * This will set the "checked" flag of the Show [Smart]Guides menu items
     * 
     * @param {Document} document
     * @return {MenuBar}
     */
    MenuBar.prototype.updateViewMenuItems = function (document) {
        return this.updateSubmenuItems("VIEW", {
            "TOGGLE_GUIDES": { "checked": (document && document.guidesVisible ? 1 : 0) },
            "TOGGLE_SMART_GUIDES": { "checked": (document && document.smartGuidesVisible ? 1 : 0) }
        });
    };
    
    /**
     * Given a boolean for the pinned state of the toolbar, update the Window Menu
     * This will set the "checked" flag of the Show Toolbar menu item
     * 
     * @param {Immutable.Map.<string, *>} preferences
     * @return {MenuBar}
     */
    MenuBar.prototype.updatePreferenceBasedMenuItems = function (preferences) {
        var updatedMenu = this.updateSubmenuItems("WINDOW", {
            "TOGGLE_TOOLBAR": { "checked": (preferences.get("toolbarPinned", true) ? 1 : 0) }
        });

        if (global.debug) {
            return updatedMenu.updateSubmenuItems("HELP", {
                "TOGGLE_POLICY_FRAMES": { "checked": (preferences.get("policyFramesEnabled", false) ? 1 : 0) },
                "TOGGLE_POSTCONDITIONS": { "checked": (preferences.get("postConditionsEnabled", false) ? 1 : 0) }
            });
        } else {
            return updatedMenu;
        }
    };
    
    /**
     * Given a menu id and an object of submenu ids and properties, update all of the submenu items
     * 
     * @param {string} menuID
     * @param {Object} subMenuProps
     * @return {MenuBar}
     */
    MenuBar.prototype.updateSubmenuItems = function (menuID, subMenuProps) {
        var menu = this.getMenuItem(menuID),
            menuIndex = this.roots.indexOf(menu); // TODO why do we have to maintain a separate list?

        menu = _.reduce(subMenuProps, function (menu, properties, key) {
            return menu.updateSubmenuProps(key, properties);
        }, menu);

        return this.merge({
            roots: this.roots.set(menuIndex, menu),
            rootMap: this.rootMap.set(menuID, menu)
        });
    };

    /**
     * Replaces the current recent files menu with passed in file list
     *
     * @param {Immutable.List.<string>} files List of recently opened file paths
     * @return {MenuBar}
     */
    MenuBar.prototype.updateRecentFiles = function (files) {
        var recentFileMenuID = "FILE.OPEN_RECENT",
            fileMenu = this.getMenuItem("FILE"),
            // We will update the actions as we go
            newActions = this.actions,
            newEnablers = this.enablers,
            recentFilesMenu = this.getMenuItem(recentFileMenuID),
            shortestPathNames = pathUtil.getShortestUniquePaths(files),
            recentFileItems = files.slice(0, 20).map(function (filePath, index) {
                var id = recentFileMenuID + "." + index,
                    name = shortestPathNames.get(index),
                    label = name.length < 60 ? name :
                        name.substr(0, 30) + "\u2026" + name.substr(-29),
                    itemDescriptor = {
                        "id": id,
                        "itemID": index.toString(),
                        "label": label,
                        "command": id
                    };
                newEnablers = newEnablers.set(id, Immutable.List.of("always"));
                newActions = newActions.set(id, {
                    "$action": "documents.open",
                    "$payload": filePath,
                    "$dontLog": true
                });
                return new MenuItem(itemDescriptor);
            }),
            // Update FILE.RECENT to have the recent files as it's submenu
            newRecentFilesMenu = recentFilesMenu.merge({
                "submenu": recentFileItems,
                "enabled": files.size > 0
            }),
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
            actions: newActions,
            enablers: newEnablers
        });
    };

    /**
     * Private variables defined here for switch document shortcuts
     *
     * @type {Object}
     */
    var _switchDocModifiersMac = {
            "command": true,
            "option": true
        },
        _switchDocModifiersWin = {
            "control": true,
            "alt": true
        };

    /**
     * Replaces the current open files menu with passed in file list
     * If First launch is open, no documents will be shown
     *
     * @param {Object.<number, Document>} documents List of open documents
     * @param {Document} currentDocument 
     * @param {boolean} appIsModal true if the app is in a globally modal state
     * @return {MenuBar}
     */
    MenuBar.prototype.updateOpenDocuments = function (documents, currentDocument, appIsModal) {
        var windowMenu = this.getMenuItem("WINDOW"),
            newActions = this.actions,
            newEnablers = this.enablers,
            shortcutModifiers = system.isMac ? _switchDocModifiersMac : _switchDocModifiersWin,
            shortcutModifierBits = keyutil.modifiersToBits(shortcutModifiers);

        var openDocumentItems = _.values(documents).map(function (document, index) {
            var name = document.name,
                label = name.length < 60 ? name :
                    name.substr(0, 30) + "\u2026" + name.substr(-29),
                id = "WINDOW.OPEN_DOCUMENT." + index,
                itemDescriptor = {
                    "id": id,
                    "itemID": index.toString(),
                    "label": label,
                    "command": id,
                    "enabled": !appIsModal,
                    "checked": Immutable.is(document, currentDocument) ? "on" : "off",
                    "shortcut": (index < 9) ? {
                        "keyChar": (index + 1).toString(),
                        "modifiers": shortcutModifierBits
                    } : null
                };

            newEnablers = newEnablers.set(id, Immutable.List.of("always"));

            newActions = newActions.set(id, {
                "$action": "documents.selectDocument",
                "$payload": document,
                "$dontLog": true
            });
            return new MenuItem(itemDescriptor);
        });

        var newWindowMenu = windowMenu.update(function (menu) {
                var submenu = menu.submenu,
                    submenuStart = submenu.takeUntil(function (item) {
                        return (_.startsWith(item.id, "WINDOW.OPEN_DOCUMENT."));
                    }),
                    newsubmenu = submenuStart.concat(openDocumentItems);

                // Since these are dynamic items in WINDOW menu, we don't update the mapping
                return menu.merge({
                    submenu: newsubmenu
                });
            }),
            // Update roots/rootMap to point to new File menu
            windowMenuIndex = this.roots.findIndex(function (root) {
                return root.id === "WINDOW";
            }),
            newRoots = this.roots.set(windowMenuIndex, newWindowMenu),
            newRootMap = this.rootMap.set("WINDOW", newWindowMenu);

        return this.merge({
            roots: newRoots,
            rootMap: newRootMap,
            actions: newActions,
            enablers: newEnablers
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

    /**
     * Accesses the menu item with the given ID
     *
     * @param {string} menuID dot delimited ID
     *
     * @return {MenuItem}
     */
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
