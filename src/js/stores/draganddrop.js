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
     * @typedef {object} DropTarget
     * @property {number} id
     * @property {string} accept
     * @property {ReactComponent} component
     * @property {function} onDrop
     * @property {function} handleDragTargetEnter
     * @property {function} handleDragTargetMove
     * @property {function} handleDragTargetLeave
     */

    /**
     * Holds global state needed by view components to implement drag-and-drop.
     *
     * @constructor
     */
    var DragAndDropStore = Fluxxor.createStore({

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
         * Map from the id to the DropTarget.
         * 
         * @private
         * @type {Immutable.Map.<string, DropTarget>}
         */
        _idToDropTarget: null,
        
        /**
         * Whether the store is processing a drop event.
         *
         * @private
         * @type {boolean}
         */
        _isDropping: null,
        
        /**
         * The initial mouse position when a drag event is triggered.
         *
         * @private
         * @type {{x: number, y: number}}
         */
        _initialDragPosition: null,
        
        /**
         * The last mouse position of a drag event.
         *
         * @private
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
            this._idToDropTarget = new Map();

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
        
        /**
         * Find the DropTarget associated with the mouseover HTML element, by comparing the "droppabled" attribute 
         * of the HTML element and the id of the DropTarget. The "droppablid" attribute is maintained by Droppable 
         * component. See "Droppable.componentDidMount" for details.
         *
         * @private
         * @param  {HTMLElement} element
         * @return {?DropTarget}
         */
        _findDropTarget: function (element) {
            do {
                if (element.dataset) {
                    var droppablID = element.dataset.droppablid,
                        dropTarget = this._idToDropTarget[droppablID];
                    
                    if (dropTarget) {
                        return dropTarget;
                    }
                }

                element = element.parentNode;
            } while (element);

            return null;
        },

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
         * @param {DropTarget} dropTarget
         */
        registerDroppable: function (dropTarget) {
            this._idToDropTarget[dropTarget.id] = dropTarget;
        },

        /**
         * Remove a drop target by id
         *
         * @param {number} dropTargetID
         */
        deregisterDroppable: function (dropTargetID) {
            this._idToDropTarget[dropTargetID] = null;
        },
        
        /**
         * Begin a drag operation with the given drag targets.
         *
         * @param {string} type
         * @param {Immutalbe.Iterable.<object>} dragTargets
         */
        startDrag: function (type, dragTargets, position) {
            this._dragTargetType = type;
            this._dragTargets = dragTargets;
            this._dragPosition = position;
            this._initialDragPosition = position;

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
                onDropPromise = this._dropTarget.onDrop(this._dragTargets, this._dragPosition);
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
        },
            
        /**
         * Update the DropTarget via the current mouseover HTML element, and call DropTarget callbacks.
         *
         * @param {{x: number, y: number}} position
         * @param {HTMLElement} mouseOverElement
         */
        updateDrag: function (position, mouseOverElement) {
            if (this._isDropping) {
                return;
            }
            
            this._dragPosition = position;
            
            var nextDropTarget = this._findDropTarget(mouseOverElement);

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
        }
    });

    module.exports = DragAndDropStore;
});
