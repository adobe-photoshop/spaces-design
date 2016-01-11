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

    var SuperSelectTool = require("js/models/tools/superselect"),
        RectangleTool = require("js/models/tools/rectangle"),
        EllipseTool = require("js/models/tools/ellipse"),
        PenTool = require("js/models/tools/pen"),
        TypeTool = require("js/models/tools/type"),
        SamplerTool = require("js/models/tools/sampler"),
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
         * Flag indicating whether we're in vectormask mode
         *
         * @private
         * @type {boolean}
         */
        _inVectorMode: false,

        /**
         * Stored ID of pointer policy created while in vector mask mode
         *
         * @private
         * @type {number}
         */
        _vectorMaskPolicyID: null,

        /**
         * IDs of layers that are being dragged by superselect tool drag
         *
         * @type {Immutable.Iterable<number>}
         */
        _draggedLayerIDs: null,

        /**
         * Initialize the ToolStore
         */
        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.tool.SELECT_TOOL_START, this._handleSelectTool,
                events.tool.SELECT_TOOL_END, this._handleSelectTool,
                events.tool.SELECT_TOOL_DRAG, this._handleSelectToolDrag,
                events.tool.MODAL_STATE_CHANGE, this._handleModalStateChange,
                events.tool.VECTOR_MASK_MODE_CHANGE, this._handleVectorMaskModeChange,
                events.tool.VECTOR_MASK_POLICY_CHANGE, this._handleVectorMaskPolicyChange
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
            addToolToToolSpec(new SamplerTool());

            this._allTools = Object.defineProperties({}, toolSpec);
            this._inModalToolState = null;
            this._inVectorMode = false;
            this._vectorMaskPolicyID = null;
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
                previous: this._previousTool,
                vectorMaskMode: this._inVectorMode,
                draggedLayerIDs: this._draggedLayerIDs
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
         * Gets the tool vector mode
         * 
         * @return {boolean} 
         */
        getVectorMode: function () {
            return this._inVectorMode;
        },

        /**
         * Gets the policy ID for vector mask mode
         * 
         * @return {number} 
         */
        getVectorMaskPolicyID: function () {
            return this._vectorMaskPolicyID;
        },

        /**
         * @private
         * @param {{tool: Tool, keyboardPolicyListID: number=, pointerPolicyListID: number=}} payload
         */
        _handleSelectTool: function (payload) {
            var tool = payload.tool;

            this._previousTool = this._currentTool;
            this._currentTool = tool;

            if (payload.hasOwnProperty("keyboardPolicyListID")) {
                this._currentKeyboardPolicyID = payload.keyboardPolicyListID;
            }

            if (payload.hasOwnProperty("pointerPolicyListID")) {
                this._currentPointerPolicyID = payload.pointerPolicyListID;
            }

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
         * @private
         * @param {boolean} payload
         */
        _handleVectorMaskModeChange: function (payload) {
            this._inVectorMode = payload;

            this.emit("change");
        },

        /**
         * @private
         * @param {number} payload
         */
        _handleVectorMaskPolicyChange: function (payload) {
            this._vectorMaskPolicyID = payload;

            this.emit("change");
        },

        /**
         * Saves the layers that will be affected by drag so their selection event
         * can be emitted afterwards
         * 
         * @private
         *
         * @param {{selectedIDs: Immutable.Iterable<number>}} payload Layers that are being moved by drag
         */
        _handleSelectToolDrag: function (payload) {
            this._draggedLayerIDs = payload.selectedIDs;
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
                if (tool.isMainTool && tool.nativeToolName() === psToolName) {
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
