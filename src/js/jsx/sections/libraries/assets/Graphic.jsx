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
        
    var libraryUtil = require("js/util/libraries"),
        nls = require("js/util/nls"),
        headlights = require("js/util/headlights");
        
    var Draggable = require("js/jsx/shared/Draggable"),
        AssetSection = require("./AssetSection"),
        AssetPreviewImage = require("./AssetPreviewImage");

    var Graphic = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                isDragging: false,
                dragPosition: null,
                renditionPath: null
            };
        },

        /**
         * Create preview of the dragged graphic asset under the cursor.
         * @private
         * @return {?ReactComponent}
         */
        _renderDragPreview: function () {
            if (!this.state.dragPosition || !this.state.renditionPath) {
                return null;
            }

            var styles = {
                left: this.state.dragPosition.x,
                top: this.state.dragPosition.y
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
            headlights.logEvent("libraries", "element", "open-graphic-for-edit");
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
         * Handle before drag start.
         *
         * @private
         * @type {Draggable~beforeDragStart}
         */
        _handleBeforeDragStart: function () {
            // Disable drag-and-drop for graphics if PS is in modal tool state, because we cannot read 
            // the correct modifier state (ALT key in this case) while in modal tool state.
            // Check `libraries.createLayerFromElement` for the details of ALT modifier.
            // 
            // FIXME: modal tool state should not block the update of modifier state.
            var isInModalToolState = this.getFlux().stores.tool.getModalToolState();
            
            // If the element does not have a renditionPath yet, we will cancel
            // the drag event as its content is likely broken and cannot be placed on the canvas.
            var hasRendition = !!this.state.renditionPath;
            
            return { continue: !isInModalToolState && hasRendition };
        },
        
        /**
         * Handle drag start.
         *
         * @private
         * @type {Draggable~onDragStart}
         */
        _handleDragStart: function () {
            this.props.onDragStart();
        },
        
        /**
         * Handle drag.
         *
         * @private
         * @type {Draggable~onDrag}
         */
        _handleDrag: function (dragPosition) {
            this.setState({
                isDragging: true,
                dragPosition: dragPosition
            });
        },
        
        /**
         * Handle drag stop.
         *
         * @private
         * @type {Draggable~onDragStop}
         */
        _handleDragStop: function () {
            this.setState({
                isDragging: false,
                dragPosition: null
            });
            
            this.props.onDragStop();
        },

        render: function () {
            var element = this.props.element,
                dragPreview = this._renderDragPreview(),
                extension = libraryUtil.getExtension(element),
                title = extension ? (element.displayName + " - " + extension.toUpperCase()) : element.displayName,
                previewTitle;
            
            if (!this.state.renditionPath) {
                previewTitle = nls.localize("strings.TOOLTIPS.LIBRARY_EMPTY_GRAPHIC");
            } else if (libraryUtil.isEditableGraphic(element)) {
                previewTitle = nls.localize("strings.TOOLTIPS.LIBRARY_EDITABLE_GRAPHIC");
            } else {
                previewTitle = nls.localize("strings.TOOLTIPS.LIBRARY_NONEDITABLE_GRAPHIC");
            }

            var classNames = classnames({
                "assets__graphic__dragging": this.state.isDragging
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
                    <Draggable
                        type="graphic"
                        target={this.props.element}
                        beforeDragStart={this._handleBeforeDragStart}
                        onDragStart={this._handleDragStart}
                        onDrag={this._handleDrag}
                        onDragStop={this._handleDragStop}>
                        <div className="libraries__asset__preview libraries__asset__preview-graphic"
                             key={this.props.element.id + this.props.element.modified}
                             onClick={this._handleClickPreview}
                             onDoubleClick={this._handleOpenForEdit}>
                            <AssetPreviewImage
                                title={previewTitle}
                                element={this.props.element}
                                onComplete={this._handlePreviewCompleted}/>
                        </div>
                    </Draggable>
                    {dragPreview}
                </AssetSection>
            );
        }
    });

    module.exports = Graphic;
});
