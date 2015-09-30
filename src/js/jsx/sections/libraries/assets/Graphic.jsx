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
        classnames = require("classnames"),
        _ = require("lodash");
        
    var libraryActions = require("js/actions/libraries");
        
    var Draggable = require("jsx!js/jsx/shared/Draggable"),
        AssetSection = require("jsx!./AssetSection"),
        AssetPreviewImage = require("jsx!./AssetPreviewImage");
        
    var _REPRESENTATION_TO_EXTENSION_MAP = _.invert(libraryActions.EXTENSION_TO_REPRESENTATION_MAP);

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
        
        /**
         * Handle click preview.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleClickPreview: function (event) {
            // Stop propagation to avoid triggering the select asset event.
            event.stopPropagation();
        },
        
        /**
         * Handle drag start event. If the element does not have a renditionPath yet, we will cancel
         * the drag-n-drop event because its content is likely broken and cannot be placed on the canvas. 
         * 
         * @param  {SyntheticEvent} event
         */
        _handleDragStart: function (event) {
            if (this.state.renditionPath) {
                this.props.handleDragStart(event);
            }
        },

        render: function () {
            var element = this.props.element,
                dragPreview = this._renderDragPreview(),
                representation = element.getPrimaryRepresentation(),
                extension = representation && _REPRESENTATION_TO_EXTENSION_MAP[representation.type],
                title = !extension ? element.displayName : (element.displayName + " - " + extension.toUpperCase());

            var classNames = classnames({
                "assets__graphic__dragging": this.props.isDragging
            });

            return (
                <AssetSection
                    element={this.props.element}
                    onSelect={this.props.onSelect}
                    selected={this.props.selected}
                    displayName={element.displayName}
                    title={title}
                    className={classNames}
                    key={element.id}>
                    <div className="libraries__asset__preview libraries__asset__preview-graphic"
                         key={this.props.element.id + this.props.element.modified}
                         onMouseDown={this._handleDragStart}
                         onClick={this._handleClickPreview}
                         onDoubleClick={this._handleOpenForEdit}>
                        <AssetPreviewImage
                            element={this.props.element}
                            onComplete={this._handlePreviewCompleted}/>
                    </div>
                    {dragPreview}
                </AssetSection>
            );
        }
    });

    var DraggableGraphic = Draggable.createWithComponent(Graphic, "both");

    module.exports = DraggableGraphic;
});
