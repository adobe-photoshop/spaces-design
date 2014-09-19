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
        adapterPS = require("adapter/ps"),
        adapterUI = require("adapter/ps/ui"),
        events = require("../events"),
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
        if (previousToolKeyboardPolicyListID) {
            policyStore.removeKeyboardPolicyList(previousToolKeyboardPolicyListID);
        }
        
        if (previousToolPointerPolicyListID) {
            policyStore.removePointerPolicyList(previousToolKeyboardPolicyListID);
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
            .then(function () {
                var psToolName = nextTool.nativeToolName,
                    setToolPlayObject = toolLib.setTool(psToolName);

                return descriptor.playObject(setToolPlayObject);
            })
            .then(function () {
                var psToolName = nextTool.nativeToolName,
                    psToolOptions = nextTool.nativeToolOptions;

                if (!psToolOptions) {
                    return;
                }

                var setToolOptionsPlayObject = toolLib.setToolOptions(psToolName, psToolOptions);
                return descriptor.playObject(setToolOptionsPlayObject);
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
                policyStore.removePointerPolicyList(nextToolKeyboardPolicyListID);

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
        var toolStore = this.flux.store("tool");

        // Check the current native tool
        return descriptor.getProperty("application", "tool")
            .bind(this)
            .then(function (toolObject) {
                var psToolName = toolObject.enum,
                    tool = toolStore.inferTool(psToolName);

                if (!tool) {
                    throw new Error("Unable to infer tool from native tool", psToolName);
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
        writes: locks.ALL_LOCKS
    };

    var initialize = {
        command: initializeCommand,
        writes: locks.ALL_LOCKS
    };

    exports.select = selectTool;
    exports.initialize = initialize;
});
