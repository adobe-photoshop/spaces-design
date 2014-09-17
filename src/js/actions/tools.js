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
        photoshopEvent = require("adapter/lib/photoshopEvent"),
        adapterPS = require("adapter/ps"),
        events = require("../events");

    var Promise = require("bluebird");

    var synchronization = require("js/util/synchronization");
        
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
            .catch(function () {
                this.dispatch(events.tools.SELECT_TOOL_FAILED);
                return initializeCommand();
            }.bind(this));
    };

    /**
     * Gets the current tool from Photoshop and dispatches it as selected
     */
    var initializeCommand = function () {
        return descriptor.getProperty("application", "tool")
            .then(function (toolObject) {
                var toolName = toolObject.enum,
                    toolIndex = toolName.indexOf("Tool"),
                    payload = {
                        newTool: toolName.substr(0, toolIndex)
                    };
                this.dispatch(events.tools.SELECT_TOOL, payload);
            }.bind(this));
    };

    /**
     * Registers to "select" events in Photoshop to dispatch when
     * a tool is selected through Photoshop UI
     * 
     * return {Promise} Blank promise
     */
    var listenToTools = function () {
        descriptor.addListener("select", function (event) {
            var target = photoshopEvent.targetOf(event);
            var toolIndex = target.indexOf("Tool");
            if (toolIndex > -1) {
                var payload = {
                    newTool: target.substr(0, toolIndex)
                };
                this.dispatch(events.tools.SELECT_TOOL, payload);
            }
        }.bind(this));

        return Promise.resolve();
    };
    
    var selectTool = {
        command: selectToolCommand,
        reads: [synchronization.LOCKS.APP],
        writes: []
    };

    var initialize = {
        command: initializeCommand,
        reads: [synchronization.LOCKS.APP],
        writes: []
    };

    var startListening = {
        command: listenToTools,
        reads: [synchronization.LOCKS.APP],
        write: []
    };

    exports.select = selectTool;
    exports.initialize = initialize;

    exports.startListening = startListening;

});
