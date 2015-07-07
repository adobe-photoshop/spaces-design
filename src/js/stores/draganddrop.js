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
         *  onDrop: function
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
         * Currently Active drop target
         * 
         * @private
         * @type {object}
         */
        _dropTarget: null,

        /**
         * Past drag target (for maintaining position during render)
         * 
         * @private
         * @type {Object} 
         */
        _pastDragTargets: null,

        /**
         * Initializes the by-zone maps.
         */
        initialize: function () {
            this._dropTargetsByZone = new Map();
            this._dropTargetOrderingsByZone = new Map();
        },

        /**
         * @return {object}
         */
        getState: function () {
            return {
                dragTargets: this._dragTargets,
                dropTarget: this._dropTarget,
                dragPosition: this._dragPosition,
                pastDragTargets: this._pastDragTargets
            };
        },

        /**
         * Add a list of droppables to the given zone.
         * 
         * @private
         * @param {number} zone
         * @param {Array.<object>} droppables
         */
        _addDroppables: function (zone, droppables) {
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

            droppables.forEach(function (droppable) {
                var key = droppable.key;
                dropTargets.set(key, droppable);
                dropTargetOrderings.push(key);
            });
        },

        /**
         * Remove a list of droppables from the given zone.
         * 
         * @private
         * @param {number} zone
         * @param {Array.<number>} keys
         */
        _removeDroppables: function (zone, keys) {
            var dropTargets = this._dropTargetsByZone.get(zone),
                dropTargetOrderings = this._dropTargetOrderingsByZone.get(zone);

            if (!dropTargets || !dropTargetOrderings) {
                throw new Error("Unable to remove droppables from an empty drop target zone");
            }

            keys.forEach(function (key) {
                dropTargets.delete(key);

                var index = dropTargetOrderings.indexOf(key);
                if (index > -1) {
                    dropTargetOrderings.splice(index, 1);
                }
            });
        },

        /**
         * Clear all droppables from the given zone.
         * 
         * @private
         * @param {number} zone
         */
        _clearDroppables: function (zone) {
            this._dropTargetsByZones.delete(zone);
            this._dropTargetOrderingsByZones.delete(zone);
        },

        /**
         * Add a drop target to the given drop zone.
         *
         * @param {number} zone
         * @param {object} droppable
         */
        registerDroppable: function (zone, droppable) {
            this._addDroppables(zone, [droppable]);
        },
        
        /**
         * Add a list of drop targets to the given drop zone.
         *
         * @param {number} zone
         * @param {Array.<object>} droppables
         */
        batchRegisterDroppables: function (zone, droppables) {
            this._dropTargets = this._addDroppables(zone, droppables);
        },

        /**
         * Remove a drop target (by key) from the given drop zone.
         *
         * @param {number} zone
         * @param {number} key
         */
        deregisterDroppable: function (zone, key) {
            this._removeDroppables(zone, [key]);
        },
        
        /**
         * Remove a list of drop targets (by key) from the given drop zone.
         * If no key list is provided, all droppables are removed from the zone.
         *
         * @param {number} zone
         * @param {Array.<number>=} keys
         */
        batchDeregisterDroppables: function (zone, keys) {
            if (keys) {
                this._removeDroppables(zone, keys);
            } else {
                this._clearDroppables(zone);
            }
        },

        /**
         * Remove all drop targets from the given zone and replace them.
         *
         * @param {number} zone
         * @param {Array.<object>} droppables
         */
        resetDroppables: function (zone, droppables) {
            this._clearDroppables(zone);
            this._addDroppables(zone, droppables);
        },
        
        /**
         * Begin a drag operation with the given drag targets.
         *
         * @param {Immutalbe.Iterable.<object>} dragTargets
         */
        startDrag: function (dragTargets) {
            this._dragTargets = dragTargets;
            this.emit("change");
        },

        /**
         * End the current drag operation.
         */
        stopDrag: function () {
            if (this._dropTarget) {
                this._dropTarget.onDrop(this._dropTarget.keyObject);
                this._dropTarget = null;
            }
            this._pastDragTargets = this._dragTargets;
            this._dragTargets = null;
            this._dragPosition = null; // Removing this causes an offset
            this.emit("change");
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

            dropTargetOrderings.some(function (key, index) {
                var dropTarget = dropTargets.get(key),
                    validationInfo = dropTarget.isValid(dropTarget, dragTargets, point),
                    compatible = validationInfo.compatible,
                    valid = validationInfo.valid;

                if (!compatible) {
                    return false;
                }

                foundDropTargetIndex = index;
                if (valid) {
                    this._dropTarget = dropTarget;
                }

                return true;
            }, this);

            // Move this drop target to the front of the list for the next search
            if (foundDropTargetIndex > -1) {
                var removedKeys = dropTargetOrderings.splice(foundDropTargetIndex, 1);
                dropTargetOrderings.unshift(removedKeys[0]);
            }

            this._dragPosition = point;
            this.emit("change");
        }
    });

    module.exports = DragAndDropStore;
});
