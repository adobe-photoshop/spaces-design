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

    var Promise = require("bluebird");

    var descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool"),
        adapterOS = require("adapter/os"),
        adapterPS = require("adapter/ps");

    var events = require("../events"),
        locks = require("js/locks"),
        policy = require("./policy"),
        shortcuts = require("./shortcuts");
        
    /**
     * Swaps the policies of the current tool with the next tool
     * if nextTool is null, just uninstalls the policies
     * 
     * @param  {Tool} nextTool Next tool to be installed
     * @return {Promise.<{
     *             tool: Tool, 
     *             keyboardPolicyListID: number, 
     *             pointerPolicyListID: number}
     *         }>}
     *         Resolves to the new tool and it's policy IDs
     */
    var _swapPolicies = function (nextTool) {
        var toolStore = this.flux.store("tool"),
            nextToolKeyboardPolicyList = nextTool ? nextTool.keyboardPolicyList : [],
            nextToolPointerPolicyList = nextTool ? nextTool.pointerPolicyList : [],
            previousToolKeyboardPolicyListID = toolStore.getCurrentKeyboardPolicyID(),
            previousToolPointerPolicyListID = toolStore.getCurrentPointerPolicyID();

        // Swap keyboard policies
        var removeKeyboardPolicyPromise;
        if (previousToolKeyboardPolicyListID !== null) {
            removeKeyboardPolicyPromise = this.transfer(policy.removeKeyboardPolicies,
                previousToolKeyboardPolicyListID, false); // delay commit
        } else {
            removeKeyboardPolicyPromise = Promise.resolve();
        }

        var swapKeyboardPolicyPromise = removeKeyboardPolicyPromise
            .bind(this)
            .then(function () {
                return this.transfer(policy.addKeyboardPolicies, nextToolKeyboardPolicyList);
            });
        
        // Swap pointer policy
        var removePointerPolicyPromise;
        if (previousToolPointerPolicyListID !== null) {
            removePointerPolicyPromise = this.transfer(policy.removePointerPolicies,
                previousToolPointerPolicyListID, false); // delay commit
        } else {
            removePointerPolicyPromise = Promise.resolve();
        }

        var swapPointerPolicyPromise = removePointerPolicyPromise
            .bind(this)
            .then(function () {
                return this.transfer(policy.addPointerPolicies, nextToolPointerPolicyList);
            });

        return Promise.join(swapKeyboardPolicyPromise, swapPointerPolicyPromise,
            function (nextToolKeyboardPolicyListID, nextToolPointerPolicyListID) {
                return {
                    tool: nextTool,
                    keyboardPolicyListID: nextToolKeyboardPolicyListID,
                    pointerPolicyListID: nextToolPointerPolicyListID
                };
            }.bind(this));
    };

    /**
     * Activates a logical tool
     *
     * @param {Tool} nextTool
     * @return {Promise} Resolves to tool change
     */
    var selectToolCommand = function (nextTool) {
        var toolStore = this.flux.store("tool");

        // Set the appropriate Photoshop tool and tool options
        return adapterPS.endModalToolState(true)
            .bind(this)
            .then(function () {
                var currentTool = toolStore.getCurrentTool();

                if (!currentTool || !currentTool.deselectHandler) {
                    return;
                }
                // Calls the deselect handler of last tool
                return currentTool.deselectHandler.call(this, currentTool);
            })
            .then(function () {
                var psToolName = nextTool.nativeToolName,
                    setToolPlayObject = toolLib.setTool(psToolName);

                // Set the new native tool
                return descriptor.playObject(setToolPlayObject);
            })
            .then(function () {
                var selectHandler = nextTool.selectHandler;

                if (!selectHandler) {
                    return;
                }

                // Calls the select handler of new tool
                return selectHandler.call(this, nextTool);
            })
            .then(function () {
                return adapterOS.resetCursor();
            })
            .then(function () {
                return _swapPolicies.call(this, nextTool);
            })
            .then(function (result) {
                // After setting everything, dispatch to stores
                this.dispatch(events.tool.SELECT_TOOL, result);
            });
    };

    /**
     * If current tool is superselect, we reselect it to re-set it's scroll policies
     * Currently this action is called by window "resize" listener
     *
     * @return {Promise} Resolves to superselect tool select
     */
    var resetSuperselectCommand = function () {
        var toolStore = this.flux.store("tool"),
            currentTool = toolStore.getCurrentTool();

        // We only want to reset superselect tool
        if (!currentTool || currentTool.id !== "newSelect") {
            return Promise.resolve();
        }

        return this.transfer(selectTool, toolStore.getToolByID("newSelect"));
    };

    /**
     * Initialize the current tool based on the current native tool
     *
     * @return {Promise.<Tool>} Resolves to current tool name
     */
    var initToolCommand = function () {
        var toolStore = this.flux.store("tool"),
            tool;

        // Check the current native tool
        return descriptor.getProperty("application", "tool")
            .bind(this)
            .then(function (toolObject) {
                var psToolName = toolObject.enum;
                    
                tool = toolStore.inferTool(psToolName);
                if (!tool) {
                    // Unable to infer tool from native tool; fall back to default
                    tool = toolStore.getDefaultTool();
                }
                
                return this.transfer(selectTool, tool);
            })
            .catch(function (err) {
                var defaultTool = toolStore.getDefaultTool();
                if (tool === defaultTool) {
                    throw err;
                }

                return this.transfer(selectTool, defaultTool);
            });
    };

    /**
     * Notify the stores of the modal state change
     * 
     * @param {boolean} modalState
     * @return {Promise}
     */
    var changeModalStateCommand = function (modalState) {
        var toolPromise = this.dispatchAsync(events.tool.MODAL_STATE_CHANGE, {
            modalState: modalState
        });

        var overlayPromise;

        if (modalState) {
            overlayPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, {
                enabled: false
            });
        } else {
            overlayPromise = Promise.resolve();
        }

        return Promise.join(toolPromise, overlayPromise);
    };

    /**
     * Event handler initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _toolModalStateChangedHandler;
    
    /**
     * Register event listeners for native tool selection change events, register
     * tool keyboard shortcuts, and initialize the currently selected tool.
     * 
     * @return {Promise}
     */
    var beforeStartupCommand = function () {
        var flux = this.flux,
            toolStore = this.flux.store("tool"),
            tools = toolStore.getAllTools();

        // Listen for modal tool state entry/exit events
        _toolModalStateChangedHandler = function (event) {
            var modalState = (event.state.value === "enter"),
                modalPromise = this.flux.actions.tools.changeModalState(modalState);

            if (event.kind.value === "mouse") {
                if (!modalState) {
                    // HACK - Delay is introduced here to make sure that bounds update
                    // before we redraw the overlay and to prevent that flash during successful
                    // drags
                    modalPromise
                        .delay(100)
                        .bind(this)
                        .then(function () {
                            this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: true });
                        });
                }
            }
        }.bind(this);
        descriptor.addListener("toolModalStateChanged", _toolModalStateChangedHandler);

        // Setup tool activation keyboard shortcuts
        var shortcutPromises = tools.reduce(function (promises, tool) {
            var activationKey = tool.activationKey;

            if (!activationKey) {
                return promises;
            }

            var activateTool = function () {
                var applicationStore = flux.store("application"),
                    currentDocument = applicationStore.getCurrentDocument();

                // Only select if it's not the case that the current document is unsupported
                if (!currentDocument || !currentDocument.unsupported) {
                    flux.actions.tools.select(tool);
                }
            };

            var promise = this.transfer(shortcuts.addShortcut, activationKey, {}, activateTool);

            promises.push(promise);

            // Add U as another shortcut for rectangle tool, hidden in here for now
            // FIXME: Change tool architecture to support multiple shortcuts for 1.1 - Barkin
            if (tool.id === "rectangle") {
                var extraPromise = this.transfer(shortcuts.addShortcut, "U", {}, activateTool);
                promises.push(extraPromise);
            }

            return promises;
        }.bind(this), []);

        var endModalPromise = adapterPS.endModalToolState(true);

        // Initialize the current tool
        var initToolPromise = this.transfer(initTool),
            shortcutsPromise = Promise.all(shortcutPromises);

        return Promise.join(endModalPromise, initToolPromise, shortcutsPromise)
            .bind(this)
            .then(function () {
                return this.transfer(changeModalState, false);
            });
    };

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onResetCommand = function () {
        descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);

        return Promise.resolve();
    };

    var selectTool = {
        command: selectToolCommand,
        reads: [locks.JS_APP, locks.JS_TOOL, locks.JS_SHORTCUT],
        writes: [locks.PS_APP, locks.JS_POLICY, locks.PS_TOOL, locks.JS_TOOL, locks.JS_SHORTCUT]
    };

    var initTool = {
        command: initToolCommand,
        reads: [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL, locks.JS_SHORTCUT],
        writes: [locks.PS_APP, locks.JS_POLICY, locks.PS_TOOL, locks.JS_TOOL, locks.JS_SHORTCUT]
    };

    var changeModalState = {
        command: changeModalStateCommand,
        reads: [locks.JS_APP],
        writes: locks.ALL_PS_LOCKS.concat([locks.JS_TOOL, locks.JS_DOC]),
        modal: true
    };

    var resetSuperselect = {
        command: resetSuperselectCommand,
        reads: [locks.JS_APP, locks.JS_TOOL, locks.JS_SHORTCUT],
        writes: [locks.PS_APP, locks.JS_POLICY, locks.PS_TOOL, locks.JS_TOOL, locks.JS_SHORTCUT]
    };

    var beforeStartup = {
        command: beforeStartupCommand,
        modal: true,
        reads: [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL],
        writes: locks.ALL_PS_LOCKS.concat([locks.JS_TOOL, locks.JS_DOC, locks.JS_SHORTCUT, locks.JS_POLICY])
    };

    var onReset = {
        command: onResetCommand,
        modal: true,
        reads: [],
        writes: []
    };

    exports.resetSuperselect = resetSuperselect;
    exports.select = selectTool;
    exports.initTool = initTool;
    exports.changeModalState = changeModalState;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;


    // This module must have a higher priority than the document module to avoid
    // duplicate current-document updates on startup, but lower priority than the
    // ui module so that defaults, which tool select handlers rely on, can be set.
    exports._priority = 0;
});
