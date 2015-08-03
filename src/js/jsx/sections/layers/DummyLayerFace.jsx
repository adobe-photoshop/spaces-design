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
        classnames = require("classnames");

    var Draggable = require("jsx!js/jsx/shared/Draggable"),
        Droppable = require("jsx!js/jsx/shared/Droppable");

    /**
     * Function for checking whether React component should update
     * Passed to Droppable composed component in order to save on extraneous renders
     *
     * @param {object} nextProps - Next set of properties for this component
     * @return {boolean}
     */
    var shouldComponentUpdate = function (nextProps) {
        // Only drop states are compared
        return this.props.dropPosition !== nextProps.dropPosition ||
            this.props.isDropTarget !== nextProps.isDropTarget;
    };

    var DummyLayerFace = React.createClass({
        render: function () {
            var dummyClassNames = classnames({
                layer: true,
                "layer__dummy": true,
                "layer__dummy_drop": this.props.isDropTarget
            });

            // The dummy layer only has enough structure to support styling of
            // drops at the bottom of the layer index.
            return (
                <li className={dummyClassNames} />
            );
        }
    });

    // Create a Droppable from a Draggable from a DummyLayerFace.
    var draggedVersion = Draggable.createWithComponent(DummyLayerFace, "y"),
        isEqual = function (layerA, layerB) {
            return layerA.key === layerB.key;
        },
        droppableSettings = function (props) {
            return {
                zone: props.zone,
                key: "dummy",
                keyObject: { key: "dummy" },
                isValid: props.isValid,
                handleDrop: props.onDrop
            };
        };

    module.exports = Droppable.createWithComponent(draggedVersion, droppableSettings, isEqual, shouldComponentUpdate);
});
