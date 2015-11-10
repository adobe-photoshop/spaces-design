/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

    var descriptor = require("adapter").ps.descriptor,
        toolLib = require("adapter").lib.tool,
        UI = require("adapter").ps.ui,
        vectorMaskLib = require("adapter").lib.vectorMask;

    var toolActions = require("js/actions/tools"),
        locks = require("js/locks");

    /**
     * Sets the tool into either path or shape mode and calls the approprate PS actions based on that mode
     *
     * @private
     */
    var select = function () {
        var toolStore = this.flux.store("tool"),
            vectorMode = toolStore.getVectorMode(),
            toolMode = toolLib.toolModes.SHAPE,
            firstLaunch = true;

        if (vectorMode) {
            toolMode = toolLib.toolModes.PATH;
        }

        var setObj = toolLib.setShapeToolMode(toolMode);

        var setPromise = descriptor.batchPlayObjects([setObj]);

        if (!vectorMode && firstLaunch) {
            var defaultPromise = this.transfer(toolActions.installShapeDefaults,
                "rectangleTool");

            firstLaunch = false;
            return Promise.join(defaultPromise, setPromise);
        } else if (!vectorMode) {
            return Promise.join(setPromise);
        } else {
            return setPromise
                .then(function () {
                    return UI.setSuppressTargetPaths(false);
                })
                .then(function () {
                    return descriptor.playObject(vectorMaskLib.activateVectorMaskEditing());
                });
        }
    };
    select.reads = [locks.JS_TOOL];
    select.writes = [locks.PS_TOOL, locks.PS_APP];
    select.transfers = ["tools.installShapeDefaults"];
    select.modal = true;

    exports.select = select;
});
