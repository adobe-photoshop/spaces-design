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
        Promise = require("bluebird"),
        Immutable = require("immutable");

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
        // _dropTargetsByZone: null,

        /**
         * Drop target keys, orderized by recency, categorized by zone.
         * 
         * @private
         * @type {Map.<number, Array.<number>>}
         */
        // _dropTargetOrderingsByZone: null,

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
        _isDropping: null,

        _reactIDToDropTarget: null,
        _droppableIDToReactID: null,
        
        /**
         * Indicates whether _dropTarget is valid for the dragged targets.
         * 
         * @private
         * @type {boolean}
         */
        _hasValidDropTarget: null,
        
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
            this._droppableIDToReactID = new Map();
            this._reactIDToDropTarget = new Map();

            this._handleReset();
        },
        
        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            var hasDragTargets = !!this._dragTargets;
            
            this._dragTargetType = null;
            this._dragTargets = Immutable.List();
            this._dropTarget = null;
            this._hasValidDropTarget = false;
            this._dragPosition = null;
            this._isDropping = false;
            
            if (hasDragTargets) {
                this.emit("change");
            }
        },
        
        _handleMouseMove: function (payload) {
            if (this._isDropping) {
                return;
            }
            
            this._dragPosition = { x: payload.clientX, y: payload.clientY };
            this._initialDragPosition = this._initialDragPosition || this._dragPosition;
            
            var nextDropTarget = this._findDropTarget(payload.element);

            if (this._dropTarget) {
                if (this._dropTarget !== nextDropTarget) {
                    this._dropTarget.handleDragTargetLeave(this._dragTargets, this._dragPosition);
                    this._dropTarget = null;
                }
            }

            if (nextDropTarget && nextDropTarget.accept === this._dragTargetType) {
                if (!this._dropTarget) {
                    nextDropTarget.handleDragTargetEnter(this._dragTargets, this._dragPosition);
                }

                this._dropTarget = nextDropTarget;
                this._dropTarget.handleDragTargetMove(this._dragTargets, this._dragPosition);
            }

            this.emit("change");
        },
        
        _findDropTarget: function (element) {
            do {
                if (element.dataset) {
                    var reactID = element.dataset.reactid,
                        dropTarget = this._reactIDToDropTarget[reactID];
                    
                    if (dropTarget) {
                        return dropTarget;
                    }
                }
                
                element = element.parentNode;
            } while (element);

            return null;
        },

        /**
         * @return {object}
         */
        getState: function () {
            return {
                dragTargets: this._dragTargets,
                dropTarget: this._dropTarget,
                initialDragPosition: this._initialDragPosition,
                dragPosition: this._dragPosition
            };
        },

        /**
         * Add a drop target to the given drop zone.
         *
         * @param {number} zone
         * @param {object} droppable
         */
        registerDroppable: function (id, dropTarget) {
            var reactID = dropTarget.component.getDOMNode().dataset.reactid;
            
            this._droppableIDToReactID[id] = reactID;
            this._reactIDToDropTarget[reactID] = dropTarget;
        },
        
        
        updateDroppable: function (id) {
            var reactID = this._droppableIDToReactID[id],
                dropTarget = this._reactIDToDropTarget[reactID],
                nextReactid = dropTarget.component.getDOMNode().dataset.reactid;
            
            this._droppableIDToReactID[id] = nextReactid;
            this._reactIDToDropTarget[reactID] = null;
            this._reactIDToDropTarget[nextReactid] = dropTarget;
        },

        /**
         * Remove a drop target (by key) from the given drop zone.
         *
         * @param {number} zone
         * @param {number} key
         */
        deregisterDroppable: function (id) {
            var reactID = this._droppableIDToReactID[id];

            this._droppableIDToReactID[id] = null;
            this._reactIDToDropTarget[reactID] = null;
        },
        
        /**
         * Begin a drag operation with the given drag targets.
         *
         * @param {Immutalbe.Iterable.<object>} dragTargets
         */
        startDrag: function (type, dragTargets) {
            this._dragTargetType = type;
            this._dragTargets = dragTargets;

            // Provide optional way for listening on start-drag event only.
            this.emit("start-drag");
            this.emit("change");
        },

        /**
         * End the current drag operation.
         */
        stopDrag: function () {
            var onDropPromise = Promise.resolve();

            if (this._dropTarget) {
                onDropPromise = this._dropTarget.onDrop(this._dragTargets, this._dragPosition, this._dropTarget);
            }
            
            this._isDropping = true;

            onDropPromise
                .bind(this)
                .then(function () {
                    this._dragTargetType = null;
                    this._dragTargets = Immutable.List();
                    this._dropTarget = null;
                    this._hasValidDropTarget = false;
                    this._dragPosition = null; // Removing this causes an offset
                    this._initialDragPosition = null;
                    this._isDropping = false;
                    this.emit("stop-drag");
                    this.emit("change");
                });
        }
    });

    module.exports = DragAndDropStore;
});
