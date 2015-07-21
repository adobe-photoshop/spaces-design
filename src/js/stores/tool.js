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
        _ = require("lodash");

    var SuperSelectTool = require("js/tools/superselect"),
        RectangleTool = require("js/tools/rectangle"),
        EllipseTool = require("js/tools/ellipse"),
        PenTool = require("js/tools/pen"),
        TypeTool = require("js/tools/type"),
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
         * @type {{string: Tool}}
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
         * Keyboard event policy ID of the current tool
         *
         * @private
         * @type {?number}
         */
        _currentKeyboardPolicyID: null,

        /**
         * Pointer event policy ID of the current tool
         *
         * @private
         * @type {?number}
         */
        _currentPointerPolicyID: null,

        /**
         * Flag indicating whether we're in a modal state or not
         *
         * @private
         * @type {boolean}
         */
        _inModalToolState: null,

        /**
         * Initialize the ToolStore
         */
        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.tool.SELECT_TOOL, this._handleSelectTool,
                events.tool.MODAL_STATE_CHANGE, this._handleModalStateChange
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            var toolSpec = {},
                addToolToToolSpec = function (tool) {
                    if (toolSpec.hasOwnProperty(tool.id)) {
                        throw new Error("Tool ID %s already in use.", tool.id);
                    }

                    toolSpec[tool.id] = {
                        value: tool,
                        enumerable: true,
                        writeable: false
                    };
                    if (tool.subToolList.length > 0) {
                        tool.subToolList.forEach(addToolToToolSpec);
                    }
                };

            addToolToToolSpec(new SuperSelectTool());
            addToolToToolSpec(new RectangleTool());
            addToolToToolSpec(new EllipseTool());
            addToolToToolSpec(new PenTool());
            addToolToToolSpec(new TypeTool());

            this._allTools = Object.defineProperties({}, toolSpec);
            this._inModalToolState = null;
            this._currentKeyboardPolicyID = null;
            this._currentPointerPolicyID = null;
            this._currentTool = null;
            this._previousTool = null;
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
         * Gets the app modal state
         * 
         * @return {boolean} 
         */
        getModalToolState: function () {
            return this._inModalToolState;
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
         * @private
         * @param  {{modalState: boolean}} payload
         */
        _handleModalStateChange: function (payload) {
            this._inModalToolState = payload.modalState;

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
                if (tool.isMainTool && tool.nativeToolName === psToolName) {
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
        },

        /**
         * Get a list of all the tools.
         * 
         * @return {Array.<Tool>}
         */
        getAllTools: function () {
            return _.values(this._allTools);
        }
    });

    module.exports = ToolStore;
});
