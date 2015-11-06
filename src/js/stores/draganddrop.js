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

    var Fluxxor = require("fluxxor");

    var events = require("../events");

    /**
     * Holds global state needed by view components to implement drag-and-drop.
     *
     * @constructor
     */
    var DragAndDropStore = Fluxxor.createStore({

        /**
         * All available drop targets, mapped by key, categorized by zone.
         *
         * Drop targets are described by a droppable data structure: {
         *  key: number,
         *  keyObject: object,
         *  validate: function:
         *  onDrop: function(keyObject) 
         *      function should return a Promise instance to indicate the completion of an onDrop event. 
         * }
         * 
         * @private
         * @type {Map.<number, Map.<number, object>>}
         */
        _dropTargetsByZone: null,

        /**
         * Drop target keys, orderized by recency, categorized by zone.
         * 
         * @private
         * @type {Map.<number, Array.<number>>}
         */
        _dropTargetOrderingsByZone: null,

        /**
         * Currently Active drag targets
         * 
         * @private
         * @type {Immutable.Iterable.<object>} 
         */
        _dragTargets: null,

        /**
         * Currently Active drop target. Use _hasValidDropTarget to know whether it is valid for the dragged targets.
         * 
         * @private
         * @type {object}
         */
        _dropTarget: null,
        
        /**
         * Indicates whether _dropTarget is valid for the dragged targets.
         * 
         * @private
         * @type {boolean}
         */
        _hasValidDropTarget: null,

        /**
         * Past drag target (for maintaining position during render)
         * 
         * @private
         * @type {Object} 
         */
        _pastDragTargets: null,
        
        /**
         * The initial mouse position when a drag event is triggered.
         * @type {{x: number, y: number}}
         */
        _initialDragPosition: null,
        
        /**
         * The last mouse position of a drag event.
         * @type {{x: number, y: number}}
         */
        _dragPosition: null,
        
        /**
         * Initializes the by-zone maps.
         */
        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset
            );
            
            // These setting attributes should be initialized once.
            this._dropTargetsByZone = new Map();
            this._dropTargetOrderingsByZone = new Map();

            this._handleReset();
        },
        
        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            var hasDragTargets = !!this._dragTargets;
            
            this._pastDragTargets = null;
            this._dragTargets = null;
            this._dropTarget = null;
            this._hasValidDropTarget = false;
            this._dragPosition = null;
            
            if (hasDragTargets) {
                this.emit("change");
            }
        },

        /**
         * @return {object}
         */
        getState: function () {
            return {
                dragTargets: this._dragTargets,
                dropTarget: this._dropTarget,
                hasValidDropTarget: this._hasValidDropTarget,
                initialDragPosition: this._initialDragPosition,
                dragPosition: this._dragPosition,
                pastDragTargets: this._pastDragTargets
            };
        },

        /**
         * Add a drop target to the given drop zone.
         *
         * @param {number} zone
         * @param {object} droppable
         */
        registerDroppable: function (zone, droppable) {
            var dropTargets = this._dropTargetsByZone.get(zone);
            if (!dropTargets) {
                dropTargets = new Map();
                this._dropTargetsByZone.set(zone, dropTargets);
            }

            var dropTargetOrderings = this._dropTargetOrderingsByZone.get(zone);
            if (!dropTargetOrderings) {
                dropTargetOrderings = [];
                this._dropTargetOrderingsByZone.set(zone, dropTargetOrderings);
            }

            var key = droppable.key;
            dropTargets.set(key, droppable);
            dropTargetOrderings.push(key);
        },

        /**
         * Remove a drop target (by key) from the given drop zone.
         *
         * @param {number} zone
         * @param {number} key
         */
        deregisterDroppable: function (zone, key) {
            var dropTargets = this._dropTargetsByZone.get(zone),
                dropTargetOrderings = this._dropTargetOrderingsByZone.get(zone);

            if (!dropTargets || !dropTargetOrderings) {
                throw new Error("Unable to remove droppables from an empty drop target zone");
            }

            dropTargets.delete(key);

            var index = dropTargetOrderings.indexOf(key);
            if (index > -1) {
                dropTargetOrderings.splice(index, 1);
            }
        },
        
        /**
         * Begin a drag operation with the given drag targets.
         *
         * @param {Immutalbe.Iterable.<object>} dragTargets
         */
        startDrag: function (dragTargets, point) {
            this._dragTargets = dragTargets;
            this._initialDragPosition = point;
            // Provide optional way for listening on start-drag event only.
            this.emit("start-drag");
            this.emit("change");
        },

        /**
         * End the current drag operation.
         */
        stopDrag: function () {
            var _reset = function () {
                this._pastDragTargets = this._dragTargets;
                this._dragTargets = null;
                this._dropTarget = null;
                this._hasValidDropTarget = false;
                this._dragPosition = null; // Removing this causes an offset
                this.emit("change");
            }.bind(this);
            
            if (this._hasValidDropTarget) {
                // It uses Promise to get completion confirmation from the onDrop callback before reset everything.
                // This will keep the dragged target(s) in the "dragging" state until the drop event is completed. 
                // Otherwise, the target(s) will snap back immediately before they get handled and updated completely.
                this._dropTarget
                    .onDrop(this._dropTarget, this._dragTargets)
                    .then(_reset);
            } else {
                _reset();
            }
        },

        /**
         * Checks the bounds of all the drop targets for this point
         * Sets this._dropTarget if an intersection and valid target are found
         * Sets _dragPosition which is used for moving dragged object on screen 
         * Emits change event which causes re-render
         *
         * @param {number} zone
         * @param {{x: number, y: number}} point Point were event occurred
         */
        updateDrag: function (zone, point) {
            var dragTargets = this._dragTargets;
            if (!dragTargets) {
                return;
            }

            var dropTargets = this._dropTargetsByZone.get(zone),
                dropTargetOrderings = this._dropTargetOrderingsByZone.get(zone),
                foundDropTargetIndex = -1;
        
            this._dropTarget = null;
            this._hasValidDropTarget = false;
            this._dragPosition = point;

            dropTargetOrderings.some(function (key, index) {
                var dropTarget = dropTargets.get(key),
                    validationInfo = dropTarget.isValid(dropTarget, dragTargets, point),
                    compatible = validationInfo.compatible,
                    valid = validationInfo.valid;

                if (!compatible) {
                    return false;
                }

                foundDropTargetIndex = index;
                
                this._dropTarget = dropTarget;
                this._hasValidDropTarget = valid;

                return true;
            }, this);

            // Move this drop target to the front of the list for the next search
            if (foundDropTargetIndex > -1) {
                var removedKeys = dropTargetOrderings.splice(foundDropTargetIndex, 1);
                dropTargetOrderings.unshift(removedKeys[0]);
            }

            this.emit("change");
        }
    });

    module.exports = DragAndDropStore;
});
