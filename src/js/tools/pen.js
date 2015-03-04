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

    var ui = require("adapter/ps/ui"),
        util = require("adapter/util"),
        toolLib = require("adapter/lib/tool"),
        descriptor = require("adapter/ps/descriptor");

    var Tool = require("js/models/tool");

    /**
     * @implements {Tool}
     * @constructor
     */
    var PenTool = function () {
        var selectHandler = function () {
            // Reset the mode of the pen tool to "shape"
            var resetObj = toolLib.resetShapeTool(),
                resetPromise = descriptor.playObject(resetObj);

            // Disable target path suppression
            var disableSuppressionPromise = ui.setSuppressTargetPaths(false);

            return Promise.join(resetPromise, disableSuppressionPromise);
        };

        var deselectHandler = function () {
            // Re-enable target path suppression
            return ui.setSuppressTargetPaths(true);
        };

        Tool.call(this, "pen", "Pen", "penTool", selectHandler, deselectHandler);

        this.activationKey = "p";
    };
    util.inherits(PenTool, Tool);

    module.exports = PenTool;
});
