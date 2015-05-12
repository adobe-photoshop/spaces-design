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

    var events = require("../events");

    /*
    * Register a droppable target node
    * Keep a reference to the DOM node as well as the object that DOM node displays
    *
    * @param {Node} dropTarget HTML Node of drop target
    * @param {string} key Unique key for drop target
    * @param {function} validateDrop Function for validating drop 
    * @param {function} onDrop Handler for drop operation
    * @param {Object} keyObject Model object which is represented by this node
    * @return {Promise}
    */
    var registerDroppableCommand = function (dropTarget, key, validateDrop, onDrop, keyObject) {
        var payload = {
            node: dropTarget,
            key: key,
            validateDrop: validateDrop,
            onDrop: onDrop,
            keyObject: keyObject
        };

        return this.dispatchAsync(events.droppable.REGISTER_DROPPABLE, payload);
    };

    /**
    * Add many droppables at once
    *
    * @param {Iterable.List} list of droppable registration information
    * @return {Promise}    
    */
    var batchRegisterDroppablesCommand = function (list) {
        return this.dispatchAsync(events.droppable.BATCH_REGISTER_DROPPABLES, list);
    };

    /**
    * Remove a drop target by key
    *
    * @param {string} key Unique key for droppable
    * @return {Promise}
    */
    var deregisterDroppableCommand = function (key) {
        return this.dispatchAsync(events.droppable.DEREGISTER_DROPPABLE, key);
    };

    /**
    * Remove many drop targets by a list of keys a drop target by key
    *
    * @param {Iterable.List} keys List of keys to remove
    * @return {Promise}
    */
    var batchDeregisterDroppablesCommand = function (keys) {
        return this.dispatchAsync(events.droppable.DEREGISTER_DROPPABLE, keys);
    };
    
    /**
    * Fire event that dragging started
    *
    * @param {Immutable.List} dragTarget List of currently dragging items
    * @return {Promise}
    */
    var registerDraggingCommand = function (dragTarget) {
        return this.dispatchAsync(events.droppable.REGISTER_DRAGGING, dragTarget);
    };

    /**
    * Fire event that dragging stopped
    *
    * @return {Promise}    
    */
    var stopDraggingCommand = function () {
        return this.dispatchAsync(events.droppable.STOP_DRAGGING);
    };

    /**
    * Check the intersection of the current dragTarget and available drop targets
    *
    * @param {Object {x: number, y: number}} point Point from event
    * @return {Promise}    
    */
    var moveAndCheckBoundsCommand = function (point) {
        return this.dispatchAsync(events.droppable.MOVE_AND_CHECK_BOUNDS, point);
    };

    /**
    * Reset all droppables (clear current list, add passed information)
    *
    * @param {Iterable.List} list of droppable registration information
    * @return {Promise}    
    */
    var resetDroppablesCommand = function (list) {
        return this.dispatchAsync(events.droppable.RESET_DROPPABLES, list);
    };

    var registerDroppable = {
        command: registerDroppableCommand,
        reads: [],
        writes: []
    };
    
    var batchRegisterDroppables = {
        command: batchRegisterDroppablesCommand,
        reads: [],
        writes: []
    };

    var deregisterDroppable = {
        command: deregisterDroppableCommand,
        reads: [],
        writes: []
    };
    
    var batchDeregisterDroppables = {
        command: batchDeregisterDroppablesCommand,
        reads: [],
        writes: []
    };

    var registerDragging = {
        command: registerDraggingCommand,
        reads: [],
        writes: []
    };

    var stopDragging = {
        command: stopDraggingCommand,
        reads: [],
        writes: []
    };

    var moveAndCheckBounds = {
        command: moveAndCheckBoundsCommand,
        reads: [],
        writes: []
    };

    var resetDroppables = {
        command: resetDroppablesCommand,
        reads: [],
        writes: []
    };

    exports.registerDroppable = registerDroppable;
    exports.deregisterDroppable = deregisterDroppable;
    exports.registerDragging = registerDragging;
    exports.stopDragging = stopDragging;
    exports.moveAndCheckBounds = moveAndCheckBounds;
    exports.batchRegisterDroppables = batchRegisterDroppables;
    exports.batchDeregisterDroppables = batchDeregisterDroppables;
    exports.resetDroppables = resetDroppables;
});
