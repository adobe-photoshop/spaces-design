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
        log = require("../util/log"),
        locks = require("js/locks"),
        policy = require("./policy"),
        layerActions = require("./layers"),
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
     * @param {boolean=} abortOnFailure
     *
     * @return {Promise} Resolves to tool change
     */
    var selectToolCommand = function (nextTool, abortOnFailure) {
        var toolStore = this.flux.store("tool"),
            updatePoliciesPromise = _swapPolicies.call(this, nextTool);

        // Set the appropriate Photoshop tool and tool options
        var photoshopToolChangePromise = adapterPS.endModalToolState(true)
            .bind(this)
            .then(function () {
                var currentTool = toolStore.getCurrentTool();

                if (!currentTool || !currentTool.deselectHandler) {
                    return;
                }
                // Calls the deselect handler of last tool
                return currentTool.deselectHandler.call(this);
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
                return selectHandler.call(this);
            })
            .then(function () {
                return adapterOS.resetCursor();
            });

        var updatePromises = [
            updatePoliciesPromise,
            photoshopToolChangePromise
        ];

        return Promise.all(updatePromises)
            .bind(this)
            .then(function (result) {
                // After setting everything, dispatch to stores
                this.dispatch(events.tool.SELECT_TOOL, result[0]);
            })
            .catch(function (err) {
                log.warn("Failed to select tool", nextTool.name, err);

                // If the failure is during initialization, just give up here
                if (abortOnFailure) {
                    throw err;
                }

                // Otherwise, try to reset the current tool
                return this.transfer(initTool);
            });
    };

    /**
     * Initialize the current tool based on the current native tool
     *
     * @return {Promise.<Tool>} Resolves to current tool name
     */
    var initToolCommand = function () {
        var toolStore = this.flux.store("tool");

        // Check the current native tool
        return descriptor.getProperty("application", "tool")
            .bind(this)
            .then(function (toolObject) {
                var psToolName = toolObject.enum,
                    tool = toolStore.inferTool(psToolName);

                if (!tool) {
                    throw new Error("Unable to infer tool from native tool: " + psToolName);
                }
                
                return tool;
            })
            .catch(function () {
                return toolStore.getDefaultTool();
            })
            .then(function (tool) {
                return this.transfer(selectTool, tool, true);
            });
    };

    /**
     * Notify the stores of the modal state change
     * 
     * @param {boolean} modalState
     * @param {boolean=} suppressDocumentUpdate
     * @return {Promise}
     */
    var changeModalStateCommand = function (modalState, suppressDocumentUpdate) {
        // If entering modal state, just dispatch and the event and be done
        if (modalState) {
            this.dispatch(events.ui.TOGGLE_OVERLAYS, {enabled: false});

            return this.dispatchAsync(events.tool.MODAL_STATE_CHANGE, {modalState: true});
        }

        var dispatchPromise = this.dispatchAsync(events.tool.MODAL_STATE_CHANGE, {modalState: false});
        if (suppressDocumentUpdate) {
            return dispatchPromise;
        }
        
        // Update the current document as the modal tool we got out of probably edited the bounds
        var currentDocument = this.flux.store("application").getCurrentDocument(),
            updatePromise;
        if (currentDocument && !modalState) {
            updatePromise = this.transfer(layerActions.resetLayers, currentDocument, currentDocument.layers.selected);
        } else {
            updatePromise = Promise.resolve();
        }

        return Promise.join(dispatchPromise, updatePromise);
    };
    
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
        descriptor.addListener("toolModalStateChanged", function (event) {
            var modalState = (event.state.value === "enter");

            if (event.kind.value === "tool") {
                this.flux.actions.tools.changeModalState(modalState);

                // We only want to do this if we're entering the modal state
                if (modalState) {
                    // HACK: Apparently we get this event before we're actually
                    // in the modal state. If so, this can cause the document to
                    // become selected instead of the text. A slight delay seems
                    // to do solve the problem...
                    Promise.delay(20)
                        .bind(this)
                        .then(function () {
                            this.flux.actions.edit.nativeSelectAll();
                        });
                }
            }
        }.bind(this));

        // Setup tool activation keyboard shortcuts
        var shortcutPromises = tools.reduce(function (promises, tool) {
            var activationKey = tool.activationKey;

            if (!activationKey) {
                return promises;
            }

            var activateTool = function () {
                flux.actions.tools.select(tool);
            };

            var promise = this.transfer(shortcuts.addShortcut, activationKey, {}, activateTool);

            promises.push(promise);
            return promises;
        }.bind(this), []);

        var endModalPromise = adapterPS.endModalToolState(false);

        // Initialize the current tool
        var initToolPromise = this.transfer(initTool),
            shortcutsPromise = Promise.all(shortcutPromises);

        return Promise.join(endModalPromise, initToolPromise, shortcutsPromise)
            .bind(this)
            .then(function () {
                return this.transfer(changeModalState, false, true);
            });
    };

    var onResetCommand = function () {
        // Reset the current tool
        var initToolPromise = this.transfer(initTool),
            endModalPromise = adapterPS.endModalToolState(false);

        return Promise.join(endModalPromise, initToolPromise)
            .bind(this)
            .then(function () {
                return this.transfer(changeModalState, false, true);
            });
    };

    var selectTool = {
        command: selectToolCommand,
        reads: [locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_APP, locks.JS_POLICY, locks.PS_TOOL, locks.JS_TOOL]
    };

    var initTool = {
        command: initToolCommand,
        reads: [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL],
        writes: [locks.PS_APP, locks.JS_POLICY, locks.PS_TOOL, locks.JS_TOOL]
    };

    var changeModalState = {
        command: changeModalStateCommand,
        reads: [locks.JS_APP],
        writes: locks.ALL_PS_LOCKS.concat([locks.JS_TOOL, locks.JS_DOC]),
        modal: true
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
        reads: [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL],
        writes: locks.ALL_PS_LOCKS.concat([locks.JS_TOOL, locks.JS_DOC, locks.JS_POLICY])
    };

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
