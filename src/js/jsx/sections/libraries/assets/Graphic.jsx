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
        classnames = require("classnames");
        
    var Draggable = require("jsx!js/jsx/shared/Draggable"),
        AssetSection = require("jsx!./AssetSection"),
        AssetPreviewImage = require("jsx!./AssetPreviewImage");

    var Graphic = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                dragging: false,
                renditionPath: null
            };
        },

        /**
         * Create preview of the dragged graphic asset under the cursor.
         * @private
         * @return {?ReactComponent}
         */
        _renderDragPreview: function () {
            if (!this.props.dragPosition || !this.state.renditionPath) {
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

        /**
         * Handle completion of loading asset preview.
         *
         * @private
         * @param  {string} renditionPath
         */
        _handlePreviewCompleted: function (renditionPath) {
            if (renditionPath) {
                this.setState({ renditionPath: renditionPath });
            }
        },
            
        /**
         * Open the selected asset in Photoshop for edit.
         *
         * @private
         */
        _handleOpenForEdit: function () {
            this.getFlux().actions.libraries.openGraphicForEdit(this.props.element);
        },

        render: function () {
            var element = this.props.element,
                dragPreview = this._renderDragPreview();

            var classNames = classnames("libraries__asset", {
                "assets__graphic__dragging": this.props.isDragging,
                "libraries__asset-selected": this.props.selected
            });

            return (
                <div className={classNames}
                     key={element.id}>
                    <div className="libraries__asset__preview libraries__asset__preview-graphic"
                         onMouseDown={this.props.handleDragStart}
                         onDoubleClick={this._handleOpenForEdit}>
                        <AssetPreviewImage
                            element={this.props.element}
                            onComplete={this._handlePreviewCompleted}/>
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
