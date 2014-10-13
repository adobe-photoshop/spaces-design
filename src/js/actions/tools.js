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

    var photoshopEvent = require("adapter/lib/photoshopEvent"),
        descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool"),
        adapterPS = require("adapter/ps"),
        events = require("../events"),
        log = require("../util/log"),
        locks = require("js/locks"),
        policy = require("./policy"),
        shortcuts = require("./shortcuts");
        

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
            nextToolKeyboardPolicyList = nextTool.keyboardPolicyList,
            nextToolPointerPolicyList = nextTool.pointerPolicyList,
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


        // Optimistically dispatch event to update the UI once policies are in place
        var updatePoliciesPromise = Promise
                .join(swapKeyboardPolicyPromise, swapPointerPolicyPromise,
                    function (nextToolKeyboardPolicyListID, nextToolPointerPolicyListID) {
                        var payload = {
                            tool: nextTool,
                            keyboardPolicyListID: nextToolKeyboardPolicyListID,
                            pointerPolicyListID: nextToolPointerPolicyListID
                        };

                        this.dispatch(events.tools.SELECT_TOOL, payload);
                    }.bind(this));

        // Set the appropriate Photoshop tool and tool options
        var photoshopToolChangePromise = adapterPS.endModalToolState(true)
            .bind(this)
            .then(function () {
                var psToolName = nextTool.nativeToolName,
                    setToolPlayObject = toolLib.setTool(psToolName);

                // Set the new native tool
                return descriptor.playObject(setToolPlayObject);
            })
            .then(function () {
                var psToolOptions = nextTool.nativeToolOptions;

                if (!psToolOptions) {
                    return;
                }

                // If there are tool options (in the form of a play object), set those
                return descriptor.playObject(psToolOptions);
            });

        var updatePromises = [
            updatePoliciesPromise,
            photoshopToolChangePromise
        ];

        return Promise.all(updatePromises)
            .bind(this)
            .catch(function (err) {
                log.warn("Failed to select tool", nextTool.name, err);
                this.dispatch(events.tools.SELECT_TOOL_FAILED);

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
            .catch(function (err) {
                log.warn("Failed to infer tool", err);

                return toolStore.getDefaultTool();
            })
            .then(function (tool) {
                return this.transfer(selectTool, tool, true);
            });
    };
    
    /**
     * Register event listeners for native tool selection change events, register
     * tool keyboard shortcuts, and initialize the currently selected tool.
     * 
     * @return {Promise}
     */
    var onStartupCommand = function () {
        var flux = this.flux,
            toolStore = this.flux.store("tool"),
            tools = toolStore.getAllTools();

        // Listen for native tool change events
        descriptor.addListener("select", function (event) {
            var psToolName = photoshopEvent.targetOf(event),
                tool = toolStore.inferTool(psToolName);

            if (!tool) {
                log.warn("Failed to infer tool from native tool", psToolName);
                tool = toolStore.getDefaultTool();
            }

            this.flux.actions.tools.select(tool);
        }.bind(this));

        // Setup tool activation keyboard shortcuts
        var shortcutPromises = tools.reduce(function (promises, tool) {
            var activationKey = tool.activationKey;

            if (!activationKey) {
                return;
            }

            var activateTool = function () {
                flux.actions.tools.select(tool);
            };

            var promise = this.transfer(shortcuts.addShortcut, activationKey, {}, activateTool);

            promises.push(promise);
            return promises;
        }.bind(this), []);

        // Initialize the current tool
        var initToolPromise = this.transfer(initTool),
            shortcutsPromise = Promise.all(shortcutPromises);

        return Promise.join(initToolPromise, shortcutsPromise);
    };

    var selectTool = {
        command: selectToolCommand,
        reads: [locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_APP, locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL]
    };

    var initTool = {
        command: initToolCommand,
        reads: [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL],
        writes: [locks.PS_APP, locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL]
    };

    var onStartup = {
        command: onStartupCommand,
        reads: [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL],
        writes: [locks.PS_APP, locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL]
    };

    exports.select = selectTool;
    exports.initTool = initTool;
    exports.onStartup = onStartup;
});
