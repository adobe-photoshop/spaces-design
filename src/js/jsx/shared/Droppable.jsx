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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        Promise = require("bluebird");
        
    var droppableCounter = 0;

    var Droppable = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return { isMouseOver: false };
        },

        // TODO doc
        componentDidMount: function () {
            this._droppableID = droppableCounter++;
            
            this.getFlux().store("draganddrop").registerDroppable(this._droppableID, {
                accept: this.props.accept,
                onDrop: this._handleDrop,
                component: this,
                handleDragTargetEnter: this._handleDragTargetEnter,
                handleDragTargetMove: this._handleDragTargetMove,
                handleDragTargetLeave: this._handleDragTargetLeave
            });
        },
        
        componentDidUpdate: function () {
            this.getFlux().store("draganddrop").updateDroppable(this._droppableID);
        },
        

        componentWillUnmount: function () {
            this.getFlux().store("draganddrop").deregisterDroppable(this._droppableID);
        },
        
        _handleDrop: function (dragTargets, dragPosition, dropTarget) {
            if (this.props.onDrop) {
                return this.props.onDrop(dragTargets, dragPosition, dropTarget);
            } else {
                return Promise.resolve();
            }
        },
        
        _handleDragTargetEnter: function (draggedLayers, dragPosition) {
            if (this.props.onDragTargetEnter) {
                this.props.onDragTargetEnter(draggedLayers, dragPosition);
            }
        },
        
        _handleDragTargetMove: function (draggedLayers, dragPosition) {
            if (this.props.onDragTargetMove) {
                this.props.onDragTargetMove(draggedLayers, dragPosition);
            }
        },
        
        _handleDragTargetLeave: function (draggedLayers, dragPosition) {
            if (this.props.onDragTargetLeave) {
                this.props.onDragTargetLeave(draggedLayers, dragPosition);
            }
        },

        render: function () {
            return this.props.children;
        }
    });

    module.exports = Droppable;
});
