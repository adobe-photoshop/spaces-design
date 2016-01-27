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
        classnames = require("classnames"),
        Promise = require("bluebird"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React);

    var Droppable = require("js/jsx/shared/Droppable");

    var DummyLayerFace = React.createClass({
        mixins: [FluxMixin],
        
        getInitialState: function () {
            return { isDropTarget: false };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            // Only drop states are compared
            return this.state.isDropTarget !== nextState.isDropTarget;
        },
        
        /**
         * Handle drop layers.
         * 
         * @private
         * @type {Droppable~onDrop}
         */
        _handleDropLayers: function (draggedLayerIds) {
            if (!this.state.isDropTarget) {
                return Promise.resolve();
            }
            
            this.setState({ isDropTarget: false });
            
            var dropIndex = 0; // put dragged layers to the bottom

            return this.getFlux().actions.layers.reorder(this.props.document, draggedLayerIds, dropIndex);
        },
        
        /**
         * Handle drag enter.
         * 
         * @private
         * @type {Droppable~onDragTargetEnter}
         */
        _handleDragTargetEnter: function (draggedLayerIds) {
            // Dropping on the dummy layer is valid as long as a group is not
            // being dropped below itself. The dummy layer only exists
            // when there is a bottom group layer. Drop position is fixed.

            var bottomLayer = this.props.document.layers.top.last(),
                isGroup = bottomLayer.isGroup,
                isDropTarget = !isGroup || !draggedLayerIds.contains(bottomLayer.id);

            this.setState({ isDropTarget: isDropTarget });
        },
        
        /**
         * Handle drag leave.
         * 
         * @private
         * @type {Droppable~onDragTargetLeave}
         */
        _handleDragTargetLeave: function () {
            this.setState({ isDropTarget: false });
        },
        
        render: function () {
            var dummyClassNames = classnames({
                "layer": true,
                "layer__dummy": true,
                "face__drop_target": this.state.isDropTarget,
                "layer__dummy_drop": this.state.isDropTarget
            });

            // The dummy layer only has enough structure to support styling of
            // drops at the bottom of the layer index.
            return (
                <Droppable
                    accept="layer"
                    onDrop={this._handleDropLayers}
                    onDragTargetEnter={this._handleDragTargetEnter}
                    onDragTargetLeave={this._handleDragTargetLeave}>
                    <div className={dummyClassNames}/>
                </Droppable>
            );
        }
    });

    module.exports = DummyLayerFace;
});
