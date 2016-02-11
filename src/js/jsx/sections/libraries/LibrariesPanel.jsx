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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        classnames = require("classnames"),
        Promise = require("bluebird"),
        Immutable = require("immutable");
        
    var headlights = require("js/util/headlights"),
        nls = require("js/util/nls");

    var TitleHeader = require("js/jsx/shared/TitleHeader"),
        LibraryList = require("./LibraryList"),
        LibraryBar = require("./LibraryBar"),
        Library = require("./Library"),
        Droppable = require("js/jsx/shared/Droppable");

    var LibrariesPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("library")],

        getStateFromFlux: function () {
            var libraryState = this.getFlux().store("library").getState();

            return {
                libraries: libraryState.libraries,
                isSyncing: libraryState.isSyncing,
                selectedLibrary: libraryState.currentLibrary,
                lastLocallyCreatedElement: libraryState.lastLocallyCreatedElement,
                lastLocallyUpdatedGraphic: libraryState.lastLocallyUpdatedGraphic
            };
        },

        /**
         * A throttled version of os.setTooltip
         *
         * @type {?function}
         */
        _setTooltipThrottled: null,

        shouldComponentUpdate: function (nextProps, nextState) {
            // If the panel is remaining invisible, no need to re-render.
            if (!nextProps.visible && !this.props.visible) {
                return false;
            }

            if (this.props.disabled !== nextProps.disabled) {
                return true;
            }

            if (this.state.isDropTarget && nextState.isDropTarget) {
                return false;
            }

            return true;
        },

        /** @ignore */
        _handleLibraryChange: function (libraryID) {
            if (this.state.selectedLibrary.id !== libraryID) {
                this.getFlux().actions.libraries.selectLibrary(libraryID);
                headlights.logEvent("libraries", "library", "switch-library");
            }
        },

        /** @ignore */
        _handleLibraryAdd: function () {
            this.getFlux().actions.libraries.createLibrary("New Library");
        },

        /** @ignore */
        _handleLibraryRemove: function () {
            this.getFlux().actions.libraries.removeCurrentLibrary();
        },
        
        /**
         * Handle create new library.
         *
         * @private
         * @param {boolean} isCreating - whether or not the LibraryList is in create library mode.
         */
        _handleCreateLibrary: function (isCreating) {
            this.setState({
                isCreatingLibrary: isCreating
            });
        },
        
        /**
         * Handle drop layers
         *
         * @private
         * @type {Droppable~onDrop}
         */
        _handleDropLayers: function (draggedLayerIds) {
            if (!this.state.canDropLayer) {
                this.setState({ isDropTarget: false });
                return Promise.resolve();
            }
            
            this.setState({
                isDropTarget: false,
                canDropLayer: false
            });

            var flux = this.getFlux(),
                document = flux.store("application").getCurrentDocument(),
                draggedLayers = document.layers.byIDs(draggedLayerIds),
                selectedLayers = document.layers.selected,
                promise = Promise.resolve();

            // Select the dragged layers if they are not selected
            if (!Immutable.is(selectedLayers, draggedLayers)) {
                promise = flux.actions.layers.select(document, draggedLayers, { modifier: "select" });
            }

            return promise.then(function () {
                flux.actions.libraries.createGraphicFromSelectedLayer();
            });
        },
        
        /**
         * Handle drag enter.
         *
         * @private
         * @type {Droppable~onDragTargetEnter}
         */
        _handleDragTargetEnter: function (draggedLayerIDs) {
            var document = this.getFlux().store("application").getCurrentDocument(),
                firstDraggedLayer = document.layers.byID(draggedLayerIDs.first()),
                // Single linked layer is not accepted, but multiple linked (or mixed) layers are accepted.
                isSingleLinkedLayer = draggedLayerIDs.size === 1 && firstDraggedLayer.isLinked;

            this.setState({
                isDropTarget: true,
                canDropLayer: this.state.selectedLibrary && !isSingleLinkedLayer
            });
        },
        
        /**
         * Handle drag leave.
         *
         * @private
         * @type {Droppable~onDragTargetLeave}
         */
        _handleDragTargetLeave: function () {
            this.setState({
                isDropTarget: false,
                canDropLayer: false
            });
        },

        /**
         * Return library panel content based on the connection status of CC Library.
         * @private
         *
         * @return {?ReactComponent}
         */
        _renderLibrariesContent: function () {
            if (this.props.disabled) {
                return null;
            }

            var libraryState = this.getFlux().store("library").getState(),
                isInitialized = libraryState.isInitialized,
                containerClasses = classnames({
                    "section-container": true,
                    "section-container__collapsed": !this.props.visible,
                    "libraries__container": true,
                    "libraries__ready": isInitialized
                });

            if (!isInitialized) {
                return (<div className={containerClasses}/>);
            }

            var isConnected = libraryState.isConnected,
                libraries = this.state.libraries,
                currentLibrary = this.state.selectedLibrary,
                containerContents;

            if (isConnected) {
                containerContents = (
                <Library
                    className={this.state.isCreatingLibrary && "libraries__content__hidden"}
                    addElement={this._handleAddElement}
                    lastLocallyCreatedElement={this.state.lastLocallyCreatedElement}
                    lastLocallyUpdatedGraphic={this.state.lastLocallyUpdatedGraphic}
                    library={currentLibrary} />
                );
            } else {
                containerContents = (
                    <div className="libraries__content panel__info">
                        <div className="panel__info__body">
                            {nls.localize("strings.LIBRARIES.NO_CONNECTION")}
                        </div>
                    </div>
                );
            }

            return (
                <div className={containerClasses}>
                    <LibraryList
                        libraries={libraries}
                        selected={currentLibrary}
                        onLibraryChange={this._handleLibraryChange}
                        onCreateLibrary={this._handleCreateLibrary}
                        disabled={!isConnected} />
                    {containerContents}
                    <LibraryBar
                        className="libraries__bar__bottom"
                        document={this.props.document}
                        disabled={!currentLibrary}
                        isSyncing={this.state.isSyncing}/>
                </div>
            );
        },

        render: function () {
            var sectionClasses = classnames({
                "libraries": true,
                "section": true,
                "section__collapsed": !this.props.visible,
                "libraries_no-drop": this.state.isDropTarget && !this.state.selectedLibrary
            }, this.props.className);

            var librariesContent = this._renderLibrariesContent(),
                dropOverlay;

            if (this.state.isDropTarget) {
                var classes = classnames({
                    "libraries__drop-overlay": true,
                    "libraries__drop-overlay__disallow": !this.state.canDropLayer
                });

                dropOverlay = (<div className={classes}/>);
            }

            return (
                <Droppable
                    accept="layer"
                    onDrop={this._handleDropLayers}
                    onDragTargetEnter={this._handleDragTargetEnter}
                    onDragTargetLeave={this._handleDragTargetLeave}>
                    <section
                        className={sectionClasses}
                        onMouseEnter={this.props.onMouseEnterDroppable}
                        onMouseLeave={this.props.onMouseLeaveDroppable}>
                        {dropOverlay}
                        <TitleHeader
                            title={nls.localize("strings.TITLE_LIBRARIES")}
                            visible={this.props.visible}
                            disabled={this.props.disabled}
                            onDoubleClick={this.props.onVisibilityToggle} />
                        {librariesContent}
                    </section>
                </Droppable>
            );
        }
    });

    module.exports = LibrariesPanel;
});
