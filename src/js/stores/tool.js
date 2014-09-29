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

    var Fluxxor = require("fluxxor"),
        SuperSelectTool = require("js/tools/superselect"),
        RectangleTool = require("js/tools/rectangle"),
        EllipseTool = require("js/tools/ellipse"),
        PenTool = require("js/tools/pen"),
        EyedropperTool = require("js/tools/eyedropper"),
        events = require("../events");

    /**
     * The ToolStore tracks the set of logical tools as well as information
     * about the active tool.
     * 
     * @constructor
     */
    var ToolStore = Fluxxor.createStore({
        /**
         * The set of logical tools.
         * 
         * @const
         * @type {Object.<string: Tool>}
         */
        _allTools: null,

        /**
         * The currently active logical tool
         * 
         * @private
         * @type {?Tool} 
         */
        _currentTool: null,

         /**
          * The previously active logical tool
          * 
          * @private
          * @type {?Tool}
          */
        _previousTool: null,

        /**
         * Initialize the ToolStore
         */
        initialize: function () {
            var toolSpec = {},
                addToolToToolSpec = function (tool) {
                    toolSpec[tool.id] = {
                        value: tool,
                        enumerable: true,
                        writeable: false
                    };
                };

            addToolToToolSpec(new SuperSelectTool());
            addToolToToolSpec(new RectangleTool());
            addToolToToolSpec(new EllipseTool());
            addToolToToolSpec(new PenTool());
            addToolToToolSpec(new EyedropperTool());

            this._allTools = Object.defineProperties({}, toolSpec);
            
            this.bindActions(
                events.tools.SELECT_TOOL, this._handleSelectTool
            );
        },

        /**
         * Get the public state of the ToolStore
         * 
         * @return {{current: ?Tool, previous: ?Tool}}
         */
        getState: function () {
            return {
                current: this._currentTool,
                previous: this._previousTool
            };
        },

        /**
         * @private
         * @param {{tool: Tool, keyboardPolicyListID: number, pointerPolicyListID: number}} payload
         */
        _handleSelectTool: function (payload) {
            var tool = payload.tool;

            this._previousTool = this._currentTool;
            this._currentTool = tool;
            this._currentKeyboardPolicyID = payload.keyboardPolicyListID;
            this._currentPointerPolicyID = payload.pointerPolicyListID;

            this.emit("change");
        },

        /**
         * Get the currently active tool, if any.
         * 
         * @return {?Tool}
         */
        getCurrentTool: function () {
            return this._currentTool;
        },

        /**
         * Get the previously active tool, if any.
         * 
         * @return {?Tool}
         */
        getPreviousTool: function () {
            return this._previousTool;
        },

        /**
         * Get the ID of the current tool's keyboard event policy.
         * 
         * @return {?number}
         */
        getCurrentKeyboardPolicyID: function () {
            return this._currentKeyboardPolicyID;
        },

        /**
         * Get the ID of the current tool's pointer event policy.
         * 
         * @return {?number}
         */
        getCurrentPointerPolicyID: function () {
            return this._currentPointerPolicyID;
        },

        /**
         * Infer the current logical tool from the given selected native tool
         * 
         * @param {string} psToolName The name of the currently selected native tool
         * @return {?Tool}
         */
        inferTool: function (psToolName) {
            var target = null;

            // At some point, this might also need to take into account the
            // current options of the native tool
            Object.keys(this._allTools).some(function (toolID) {
                var tool = this._allTools[toolID];
                if (tool.nativeToolName === psToolName) {
                    target = tool;
                    return true;
                }
            }, this);

            return target;
        },

        /**
         * Get the default logical tool.
         *
         * @return {!Tool}
         */
        getDefaultTool: function () {
            return this._allTools.newSelect;
        },

        /**
         * Get the logical Tool object that corresponds to the given tool ID
         * 
         * @param {!string} toolID
         * @return {?Tool}
         */
        getToolByID: function (toolID) {
            return this._allTools[toolID];
        }
    });

    module.exports = new ToolStore();
});
