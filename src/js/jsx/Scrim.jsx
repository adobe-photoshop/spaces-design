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
        classnames = require("classnames");

    var adapterOS = require("adapter").os,
        headlights = require("js/util/headlights");

    var PolicyOverlay = require("js/jsx/tools/PolicyOverlay"),
        GuidesOverlay = require("js/jsx/tools/GuidesOverlay"),
        Droppable = require("js/jsx/shared/Droppable");
    
    var Scrim = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("dialog", "tool", "ui", "panel", "application", "preferences")],

        /**
         * Dispatches (synthetic) click events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleClick: function (event) {
            var tool = this.state.current;

            if (tool && tool.onClick) {
                tool.onClick.call(this, event);
            }
        },
        
        getInitialState: function () {
            return {
                isDropTarget: false
            };
        },

        /**
         * Dispatches (synthetic) doubleclick events from the scrim to the currently
         * active tool.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleDoubleClick: function (event) {
            var tool = this.state.current,
                flux = this.getFlux();

            // If there are no documents open, send a "Open" command to Photoshop
            if (!flux.store("application").getCurrentDocument()) {
                flux.actions.menu.native({ commandID: 20 });
                return;
            }

            if (tool && tool.onDoubleClick) {
                tool.onDoubleClick.call(this, event);
            }
        },

        /**
         * Dispatches (synthetic) mousedown events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleMouseDown: function (event) {
            var tool = this.state.current;

            if (window.document.activeElement !== window.document.body) {
                window.document.activeElement.blur();
            }

            if (tool && tool.onMouseDown) {
                tool.onMouseDown.call(this, event);
            }
        },

        /**
         * Dispatches (synthetic) mouseup events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleMouseUp: function (event) {
            var tool = this.state.current;

            if (tool && tool.onMouseUp) {
                tool.onMouseUp.call(this, event);
            }
        },

        /**
         * Dispatches (synthetic) mouseMove events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleMouseMove: function (event) {
            var tool = this.state.current;

            if (tool && tool.onMouseMove) {
                tool.onMouseMove.call(this, event);
            }
        },

        /**
         * Dispatches custom keyup events from the window to the currently
         * active tool.
         * 
         * @private
         * @param {CustomEvent} event
         */
        _handleKeyUp: function (event) {
            // Don't dispatch the key event if a focusable DOM element is active
            if (event.target !== window.document.body) {
                return;
            }

            adapterOS.resetCursor();

            var tool = this.state.current;
            if (tool && tool.onKeyUp) {
                tool.onKeyUp.call(this, event);
            }
        },

        /**
         * Dispatches custom keydown events from the window to the currently
         * active tool.
         * 
         * @private
         * @param {CustomEvent} event
         */
        _handleKeyDown: function (event) {
            // Don't dispatch the key event if a focusable DOM element is active
            if (event.target !== window.document.body) {
                return;
            }

            adapterOS.resetCursor();

            var tool = this.state.current;
            if (tool && tool.onKeyDown) {
                tool.onKeyDown.call(this, event);
            }
        },
        
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                toolState = flux.store("tool").getState(),
                uiState = flux.store("ui").getState(),
                panelState = flux.store("panel").getState(),
                preferenceStore = flux.store("preferences"),
                applicationStore = flux.store("application"),
                applicationState = applicationStore.getState(),
                policyFrames = __PG_DEBUG__ && preferenceStore.getState().get("policyFramesEnabled"),
                document = applicationStore.getCurrentDocument(),
                appIsModal = flux.store("dialog").getState().appIsModal;

            return {
                current: toolState.current,
                transform: uiState.inverseTransformMatrix,
                overlaysEnabled: panelState.overlaysEnabled,
                policyFrames: policyFrames,
                document: document,
                activeDocumentInitialized: applicationState.activeDocumentInitialized,
                recentFilesInitialized: applicationState.recentFilesInitialized,
                appIsModal: appIsModal
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            // Don't re-render if we're just going temporarily inactive so that
            // the UI doesn't blink unnecessarily.
            if (this.props.active && !nextProps.active) {
                return false;
            }

            // Don't re-render until either the active document or recent files
            // are initialized.
            if (!nextState.activeDocumentInitialized || !nextState.recentFilesInitialized) {
                return false;
            }

            // Only skip if it's currently a dropTarget and will continue to be
            if (this.state.isDropTarget && nextState.isDropTarget) {
                return false;
            }

            return true;
        },

        /**
         * Adds adapter key-event listeners.
         */
        componentWillMount: function () {
            window.addEventListener("adapterKeydown", this._handleKeyDown);
            window.addEventListener("adapterKeyup", this._handleKeyUp);
        },

        /**
         * Removes adapter key-event listeners.
         */
        componentWillUnmount: function () {
            window.removeEventListener("adapterKeydown", this._handleKeyDown);
            window.removeEventListener("adapterKeyup", this._handleKeyUp);
        },

        /**
         * Renders the current tool overlay if there is one
         * @private
         */
        _renderToolOverlays: function () {
            var document = this.state.document,
                disabled = document && document.unsupported,
                overlays = !disabled && this.state.overlaysEnabled,
                transform = this.state.transform,
                transformString = this._getTransformString(transform),
                isDropTarget = this.state.isDropTarget,
                tool = this.state.current;
                
            if (!overlays || !transform || isDropTarget) {
                return null;
            }

            if (!tool || !tool.toolOverlays || this.state.isAssetDragOver) {
                return null;
            }
            
            var toolOverlays = tool.toolOverlays;

            return toolOverlays.map(function (ToolOverlay, index) {
                var key = "toolOverlay" + index.toString();
                return (
                    <ToolOverlay transformString={transformString} key={key} />
                );
            });
        },
        
        /** 
         * Stringifies CanvasToWindow transformation for all SVG coordinates
         * 
         * @ignore
         */
        _getTransformString: function (transformMatrix) {
            if (!transformMatrix) {
                return "";
            }

            return "matrix(" + transformMatrix.join(",") + ")";
        },
        
        /**
         * Handle drop graphic.
         * 
         * @private
         * @type {Droppable~onDrop}
         */
        _handleDropGraphic: function (draggedTargets) {
            this.setState({ isDropTarget: false });

            var flux = this.getFlux(),
                dndState = flux.store("draganddrop").getState(),
                dropPosition = dndState.dragPosition,
                dragGraphic = draggedTargets.first(),
                uiStore = flux.store("ui"),
                canvasLocation = uiStore.transformWindowToCanvas(dropPosition.x, dropPosition.y);

            headlights.logEvent("libraries", "element", "place-graphic");

            return flux.actions.libraries.createLayerFromElement(dragGraphic, canvasLocation);
        },
        
        /**
         * Handle drag enter.
         * 
         * @private
         * @type {Droppable~onDragTargetEnter}
         */
        _handleDragTargetEnter: function () {
            this.setState({ isDropTarget: true });
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
            var document = this.state.document,
                disabled = this.state.appIsModal || document && document.unsupported,
                toolOverlay = this._renderToolOverlays(),
                policyOverlay = this.state.policyFrames ? (<PolicyOverlay/>) : null,
                guidesOverlay = !disabled ? (<GuidesOverlay/>) : null;

            var classNames = classnames({
                "scrim": true,
                "scrim-drop": this.state.isDropTarget,
                "scrim__disabled": document && document.unsupported
            });

            // Only the mouse event handlers are attached to the scrim
            return (
                <Droppable
                    accept="graphic"
                    onDrop={this._handleDropGraphic}
                    onDragTargetEnter={this._handleDragTargetEnter}
                    onDragTargetLeave={this._handleDragTargetLeave}>
                    <div ref="scrim"
                         className={classNames}
                         onClick={!disabled && this._handleClick}
                         onDoubleClick={!disabled && this._handleDoubleClick}
                         onMouseDown={!disabled && this._handleMouseDown}
                         onMouseMove={!disabled && this._handleMouseMove}
                         onMouseUp={!disabled && this._handleMouseUp}>
                         <svg width="100%" height="100%">
                             <g id="overlay" width="100%" height="100%">
                                 {policyOverlay}
                                 {toolOverlay}
                                 {guidesOverlay}
                            </g>
                        </svg>
                    </div>
                </Droppable>
            );
        }
    });
    
    module.exports = Scrim;
});
