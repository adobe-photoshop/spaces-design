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

    var descriptor = require("adapter").ps.descriptor;

    /**
     * Handler for updateTextProperties events, which are emitted turing modal
     * text editing.
     *
     * @private
     * @type {?function}
     */
    var _typeChangedHandler;

    /**
     * Re-activates the select tool when exiting the modal tool state.
     *
     * @private
     * @type {?function}
     */
    var _toolModalStateChangedHandler;

    /**
     * Resets the tool to select after the modal tool state is committed, and listens
     * for updated text properties while in the modal state.
     *
     * @private
     */
    var select = function () {
        if (_toolModalStateChangedHandler) {
            descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);
        }
        _toolModalStateChangedHandler = function (event) {
            if (event.kind._value === "tool" && event.tool.ID === "txBx" &&
                event.state._value === "exit") {
                var flux = this.flux,
                    toolStore = flux.store("tool");

                flux.actions.tools.select(toolStore.getToolByID("newSelect"));
            }
        }.bind(this);
        descriptor.addListener("toolModalStateChanged", _toolModalStateChangedHandler);

        if (_typeChangedHandler) {
            descriptor.removeListener("updateTextProperties", _typeChangedHandler);
        }
        _typeChangedHandler = this.flux.actions.toolType.updateTextPropertiesHandlerThrottled.bind(this);
        descriptor.addListener("updateTextProperties", _typeChangedHandler);

        return Promise.resolve();
    };
    select.action = {
        reads: [],
        writes: [],
        transfers: [],
        modal: true
    };

    /**
     * Removes event listeners installed on activation.
     *
     * @private
     */
    var deselect = function () {
        descriptor.removeListener("updateTextProperties", _typeChangedHandler);
        descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);

        _typeChangedHandler = null;
        _toolModalStateChangedHandler = null;

        return Promise.resolve();
    };
    deselect.action = {
        reads: [],
        writes: [],
        transfers: [],
        modal: true
    };

    exports.select = select;
    exports.deselect = deselect;
});
