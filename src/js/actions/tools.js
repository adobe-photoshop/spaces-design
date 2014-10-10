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

    var EventPolicy = require("js/models/eventpolicy"),
        KeyboardEventPolicy = EventPolicy.KeyboardEventPolicy,
        descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool"),
        adapterPS = require("adapter/ps"),
        adapterUI = require("adapter/ps/ui"),
        adapterOS = require("adapter/os"),
        events = require("../events"),
        string = require("../util/string"),
        log = require("../util/log"),
        locks = require("js/locks");
        

    /**
     * Activates a logical tool
     *
     * @param {Tool} nextTool
     * @param {boolean=} abortOnFailure
     *
     * @return {Promise} Resolves to tool change
     */
    var selectToolCommand = function (nextTool, abortOnFailure) {
        log.debug("Selecting tool:", nextTool.name);

        // Although in general we wish to decouple actions from stores, in the
        // case of event policies we can't update Photoshop without knowing about
        // the entire set of policies. Consequently, this action updates the
        // keyboard and event policies direction in the PolicyStore at the same
        // time that it executes the policy change in Photoshop.
        var toolStore = this.flux.store("tool"),
            policyStore = this.flux.store("policy");

        var nextToolKeyboardPolicyList = nextTool.keyboardPolicyList,
            nextToolPointerPolicyList = nextTool.pointerPolicyList,
            previousToolKeyboardPolicyListID = toolStore.getCurrentKeyboardPolicyID(),
            previousToolPointerPolicyListID = toolStore.getCurrentPointerPolicyID();

        // Optimistically remove keyboard and pointer policies for the previous tool
        if (previousToolKeyboardPolicyListID !== null) {
            policyStore.removeKeyboardPolicyList(previousToolKeyboardPolicyListID);
        }
        
        if (previousToolPointerPolicyListID !== null) {
            policyStore.removePointerPolicyList(previousToolPointerPolicyListID);
        }
        
        // Optimistically add keyboard and pointer policies for the next tool
        var nextToolKeyboardPolicyListID = policyStore.addKeyboardPolicyList(nextToolKeyboardPolicyList),
            nextToolPointerPolicyListID = policyStore.addPointerPolicyList(nextToolPointerPolicyList);

        // Optimistically dispatch event to update the immediately UI
        var payload = {
            tool: nextTool,
            keyboardPolicyListID: nextToolKeyboardPolicyListID,
            pointerPolicyListID: nextToolPointerPolicyListID
        };

        this.dispatch(events.tools.SELECT_TOOL, payload);

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

        // Set the new keyboard policy list
        var keyboardPolicyList = policyStore.getMasterKeyboardPolicyList(),
            keyboardPolicyUpdatePromise = adapterUI.setKeyboardEventPropagationPolicy(keyboardPolicyList);

        // Set the new pointer policy list
        var pointerPolicyList = policyStore.getMasterPointerPolicyList(),
            pointerPolicyUpdatePromise = adapterUI.setPointerEventPropagationPolicy(pointerPolicyList);

        var updatePromises = [
            photoshopToolChangePromise,
            keyboardPolicyUpdatePromise,
            pointerPolicyUpdatePromise
        ];

        return Promise.all(updatePromises)
            .bind(this)
            .catch(function (err) {
                log.warn("Failed to select tool", nextTool.name, err);
                this.dispatch(events.tools.SELECT_TOOL_FAILED);

                // Retract the keyboard and pointer policies that were just installed
                policyStore.removeKeyboardPolicyList(nextToolKeyboardPolicyListID);
                policyStore.removePointerPolicyList(nextToolPointerPolicyListID);

                // If the failure is during initialization, just give up here
                if (abortOnFailure) {
                    throw err;
                }

                // Otherwise, try to reset the current tool
                return initializeCommand.call(this);
            });
    };

    /**
     * Initialize the current tool based on the current native tool
     *
     * @return {Promise.<Tool>} Resolves to current tool name
     */
    var initializeCommand = function () {
        var policyStore = this.flux.store("policy"),
            toolStore = this.flux.store("tool"),
            tools = toolStore.getAllTools(),
            activationPolicies = tools.reduce(function (policies, tool) {
                var activationKey = tool.activationKey;

                if (!activationKey) {
                    return policies;
                } else if (activationKey.length !== 1) {
                    throw new Error(string.format("Invalid activation key for tool ${0}: ${1}",
                        tool.id, activationKey));
                }

                // TODO: Remove this hack when the keyboard policy API is updated
                activationKey = "KEY_" + activationKey.toUpperCase();
                if (!adapterOS.eventKeyCode.hasOwnProperty(activationKey)) {
                    throw new Error(string.format("Unknown activation key for tool ${0}: ${1}",
                        tool.id, activationKey));
                }

                var activationKeyCode = adapterOS.eventKeyCode[activationKey],
                    policy = new KeyboardEventPolicy(adapterUI.policyAction.NEVER_PROPAGATE,
                        adapterOS.eventKind.KEY_DOWN, [], activationKeyCode);

                policies.push(policy);
                return policies;
            }, []);

        // Only the policy store is updated here, and not the adapter. Correctness
        // relies on the assumption that the following tool initialization routine
        // will set the keyboard propagation policy in the adapter before proceeding.
        policyStore.addKeyboardPolicyList(activationPolicies);

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
                return selectToolCommand.call(this, tool, true);
            });
    };
    
    var selectTool = {
        command: selectToolCommand,
        reads: [locks.JS_APP, locks.JS_TOOL],
        writes: [locks.PS_APP, locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL]
    };

    var initialize = {
        command: initializeCommand,
        reads: [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL],
        writes: [locks.PS_APP, locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL]
    };

    exports.select = selectTool;
    exports.initialize = initialize;
});
