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

    var Promise = require("bluebird"),
        React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        classnames = require("classnames");

    var Draggable = require("jsx!js/jsx/shared/Draggable"),
        AssetSection = require("jsx!./AssetSection");

    var Graphic = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                renditionPath: null,
                dragging: false
            };
        },

        componentWillMount: function () {
            // On mount, get the rendition of this element
            var element = this.props.element;

            Promise.fromNode(function (cb) {
                element.getRenditionPath(40, cb);
            }).bind(this).then(function (path) {
                // Path is undefined if the graphic asset is empty (e.g. empty artboard).
                if (path) {
                    this.setState({ renditionPath: path });
                }
            });
        },

        /**
         * Create preview of the dragged graphic asset under the cursor.
         * @private
         * @return {?ReactComponent}
         */
        _renderDragPreview: function () {
            if (!this.props.dragPosition) {
                return null;
            }

            var styles = {
                left: this.props.dragPosition.x,
                top: this.props.dragPosition.y
            };

            return (
                <div className="assets__graphic__drag-preview" style={styles}>
                    <img src={this.state.renditionPath} />
                </div>
            );
        },

        render: function () {
            var element = this.props.element,
                dragPreview = this._renderDragPreview(),
                previewImage = this.state.renditionPath && (<img src={this.state.renditionPath}/>);

            var classNames = classnames("libraries__asset", {
                "assets__graphic__dragging": this.props.isDragging,
                "libraries__asset-selected": this.props.selected
            });

            return (
                <div className={classNames}
                     key={element.id}
                     onMouseDown={this.props.handleDragStart}>
                    <div className="libraries__asset__preview libraries__asset__preview-graphic">
                        {previewImage}
                    </div>
                    <AssetSection
                        element={this.props.element}
                        onSelect={this.props.onSelect}
                        selected={this.props.selected}
                        title={element.displayName}/>
                    {dragPreview}
                </div>
            );
        }
    });

    var DraggableGraphic = Draggable.createWithComponent(Graphic, "both");

    module.exports = DraggableGraphic;
});
