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
        events = require("../events");
    
    // Later on this can wait for the context store to deal the correct tools
    // For now, we have all possible tools listed here.
    var allTools = [
        "newSelect",
        "move",
        "",
        "rectangle",
        "ellipse",
        "pen",
        // "layout",
        // "",
        // "typeCreateOrEdit",
        "eyedropper"
        // "code"
    ];
    


    var ToolStore = Fluxxor.createStore({
        initialize: function () {
            this._currentTool = "rectangle";
            this._toolList = allTools;
            
            this.bindActions(
                events.tools.SELECT_TOOL, this.toolSelected
            );
        },
        getState: function () {
            return {
                currentTool: this._currentTool,
                toolList: this._toolList
            };
        },
        toolSelected: function (payload) {
            this._currentTool = payload.newTool;
            this.emit("change");
        }
    });

    module.exports = new ToolStore();
});
