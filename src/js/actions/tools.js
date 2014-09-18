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

    var descriptor = require("adapter/ps/descriptor"),
        tool = require("adapter/lib/tool"),
        adapterPS = require("adapter/ps"),
        events = require("../events"),
        log = require("../util/log"),
        locks = require("js/locks");
        
    /**
     * Activates the given tool in Photoshop
     *
     * @param {string} toolName 
     *
     * @return {Promise} Resolves to tool change
     */
    var selectToolCommand = function (toolName) {
        var payload = {
            newTool: toolName
        };

        this.dispatch(events.tools.SELECT_TOOL, payload);

        return adapterPS.endModalToolState(true)
            .then(function () {
                var setToolObj = tool.setTool(toolName + "Tool");

                return descriptor.playObject(setToolObj);
            })
            .catch(function (err) {
                log.warn("Failed to select tool", toolName, err);
                this.dispatch(events.tools.SELECT_TOOL_FAILED);
                return initializeCommand();
            }.bind(this));
    };

    /**
     * Gets the current tool from Photoshop and dispatches it as selected
     *
     * @return {Promise} Resolves to current tool name
     */
    var initializeCommand = function () {
        return descriptor.getProperty("application", "tool")
            .then(function (toolObject) {
                var toolName = toolObject.enum,
                    toolIndex = toolName.indexOf("Tool"),
                    tool = toolName.substr(0, toolIndex),
                    payload = {
                        newTool: tool
                    };
                this.dispatch(events.tools.SELECT_TOOL, payload);
                return tool;
            }.bind(this));
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
