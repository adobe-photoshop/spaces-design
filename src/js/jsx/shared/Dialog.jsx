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
        ReactDOM = require("react-dom"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        classnames = require("classnames"),
        _ = require("lodash");

    var os = require("adapter").os;

    var math = require("js/util/math");

    /**
     * Valid methods of positioning the dialog
     * 
     * @const
     * @type {{string: string}}
     */
    var POSITION_METHODS = {
        CENTER: "center",
        TARGET: "target"
    };

    var Dialog = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("dialog")],

        /**
         * The target of the event that opened the Dialog.
         *
         * @private
         * @type {?DOMElement}
         */
        _target: null,

        propTypes: {
            id: React.PropTypes.string.isRequired,
            onOpen: React.PropTypes.func,
            onClose: React.PropTypes.func,
            disabled: React.PropTypes.bool,
            modal: React.PropTypes.bool,
            className: React.PropTypes.string,
            position: React.PropTypes.string,
            dismissOnDialogOpen: React.PropTypes.bool,
            dismissOnDocumentChange: React.PropTypes.bool,
            dismissOnSelectionTypeChange: React.PropTypes.bool,
            dismissOnWindowClick: React.PropTypes.bool,
            dismissOnWindowResize: React.PropTypes.bool,
            dismissOnCanvasClick: React.PropTypes.bool,
            dismissOnKeys: React.PropTypes.arrayOf(React.PropTypes.object)
        },

        getDefaultProps: function () {
            return {
                onOpen: _.identity,
                onClose: _.identity,
                disabled: false,
                modal: false,
                position: POSITION_METHODS.TARGET, // for backwards compatibility
                dismissOnDialogOpen: true,
                dismissOnDocumentChange: true,
                dismissOnSelectionTypeChange: false,
                dismissOnWindowClick: true,
                dismissOnWindowResize: true,
                dismissOnCanvasClick: false
            };
        },

        statics: {
            POSITION_METHODS: POSITION_METHODS
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                dialogStore = flux.store("dialog"),
                dialogState = dialogStore.getState(),
                openDialogs = dialogState.openDialogs;

            return {
                open: openDialogs.has(this.props.id)
            };
        },

        componentWillMount: function () {
            this.getFlux().store("dialog").registerDialog(this.props.id, this._getDismissalPolicy());
        },

        componentWillUnmount: function () {
            if (this.state.open) {
                this._removeListeners();
                this.getFlux().actions.dialog.closeDialog(this.props.id);
            }

            this.getFlux().store("dialog").deregisterDialog(this.props.id);
        },

        componentDidUpdate: function (prevProps, prevState) {
            var dialogEl = ReactDOM.findDOMNode(this);

            if (this.state.open && !prevState.open) {
                // Dialog opening
                if (this.props.modal) {
                    dialogEl.showModal();
                }

                this._addListeners();
                this._positionDialog(dialogEl);
                this.props.onOpen();
            } else if (!this.state.open && prevState.open) {
                // Dialog closing
                this._removeListeners();
                
                if (this.props.modal && dialogEl.open) {
                    dialogEl.close();
                }
                this.props.onClose();
            }
        },

        /**
         * Build an object representation of the dismissal policy to be sent to the Dialog Store
         *
         * @return {object}
         */
        _getDismissalPolicy: function () {
            return {
                dialogOpen: this.props.dismissOnDialogOpen,
                documentChange: this.props.dismissOnDocumentChange,
                selectionTypeChange: this.props.dismissOnSelectionTypeChange
            };
        },

        /**
         * Toggle dialog visibility.
         * 
         * @param {SyntheticEvent} event
         */
        toggle: function (event) {
            var flux = this.getFlux(),
                id = this.props.id;

            if (this.state.open) {
                this._target = null;
                flux.actions.dialog.closeDialog(id);
            } else if (!this.props.disabled) {
                this._target = event.currentTarget;
                flux.actions.dialog.openDialog(id, this._getDismissalPolicy());
            }

            event.stopPropagation();
        },

        /** @ignore */
        isOpen: function () {
            return this.state.open;
        },

        /**
         * Handle window clicks, closing the dialog if the click is outside the
         * dialog bounds.
         * 
         * @private
         * @param {MouseEvent} event
         */
        _handleWindowClick: function (event) {
            if (!this.state.open) {
                return;
            }

            var elt = ReactDOM.findDOMNode(this);
            if (!elt) {
                return;
            }

            var bounds = elt.getBoundingClientRect();
            if (bounds.left <= event.x && event.x <= bounds.right &&
                bounds.top <= event.y && event.y <= bounds.bottom) {
                return;
            }

            this.toggle(event);
        },

        /**
         * Dismiss the dialog on mouse wheel events.
         *
         * @private
         */
        _handleMouseWheel: function () {
            if (!this.state.open) {
                return;
            }

            var id = this.props.id,
                flux = this.getFlux();

            this._target = null;
            flux.actions.dialog.closeDialogThrottled(id);
        },

        /**
         * Handle window resize events, closing the open dialog.
         *
         * @param {Event} event
         */
        _handleWindowResize: function (event) {
            // once
            window.removeEventListener("resize", this._handleWindowResize);

            this.toggle(event);
        },

        /**
         * Position the dialog according to the position method (either target or center)
         *
         * @private
         * @param {DOMElement} dialogEl the dialog DOM element
         */
        _positionDialog: function (dialogEl) {
            var dialogBounds;
            
            if (this.props.position === POSITION_METHODS.TARGET) {
                if (this._target) {
                    dialogBounds = dialogEl.getBoundingClientRect();

                    var clientHeight = window.document.documentElement.clientHeight,
                        // Adjust the position of the opened dialog according to the target
                        targetBounds = this._target.getBoundingClientRect(),
                        offsetParentBounds = this._target.offsetParent.getBoundingClientRect(),
                        placedDialogTop = Math.round(targetBounds.bottom) - Math.round(offsetParentBounds.top),
                        placedDialogBottom = placedDialogTop + Math.round(dialogBounds.height),
                        pointerAbove = false,
                        pointerBelow = false,
                        topPosition,
                        bottomPosition;
                    
                    // If there is space below the target, place the dialog below.
                    if (placedDialogBottom <= clientHeight) {
                        pointerAbove = true;
                        topPosition = placedDialogTop + "px";
                    } else {
                        // Need to account for element margin
                        var dialogComputedStyle = window.getComputedStyle(dialogEl),
                            dialogMarginTop = math.pixelDimensionToNumber(dialogComputedStyle.marginTop),
                            dialogMarginBottom = math.pixelDimensionToNumber(dialogComputedStyle.marginBottom);

                        // If there is space above the target, let's place the dialog above it
                        if (dialogBounds.height + dialogMarginTop + dialogMarginBottom < targetBounds.top) {
                            pointerBelow = true;
                            topPosition = (targetBounds.top - dialogBounds.height) + "px";
                        } else {
                            // Otherwise, it floats with no pointers at top or bottom
                            topPosition = (clientHeight -
                                dialogBounds.height - dialogMarginTop - dialogMarginBottom) + "px";
                        }
                    }

                    this.setState({
                        "topPosition": topPosition,
                        "bottomPosition": bottomPosition,
                        "pointerAbove": pointerAbove,
                        "pointerBelow": pointerBelow
                    });
                } else {
                    throw new Error("Could not determine target by which to render this dialog: " + this.displayName);
                }
            } else if (this.props.position === POSITION_METHODS.CENTER) {
                dialogBounds = dialogEl.getBoundingClientRect();

                var dialogElLeft = null,
                    cloakingRect = this.getFlux().store("panel").getCloakRect(),
                    cloakingRectWidth = cloakingRect.right - cloakingRect.left;

                if (dialogBounds.width < cloakingRectWidth) {
                    dialogElLeft = (cloakingRect.left + cloakingRectWidth / 2) + "px";
                }
                
                this.setState({
                    "leftPosition": dialogElLeft
                });
            }
        },

        /**
         * Add event handlers and shortcuts on this dialog
         */
        _addListeners: function () {
            if (this.props.dismissOnWindowClick) {
                window.addEventListener("click", this._handleWindowClick);
            }

            if (this.props.dismissOnCanvasClick) {
                os.once(os.eventKind.EXTERNAL_MOUSE_DOWN, this.toggle);
                os.once("externalMouseWheel", this._handleMouseWheel);
            }

            if (this.props.dismissOnWindowResize) {
                window.addEventListener("resize", this._handleWindowResize);
            }

            if (this.props.dismissOnKeys && _.isArray(this.props.dismissOnKeys)) {
                var flux = this.getFlux();
                this.props.dismissOnKeys.forEach(function (keyObj) {
                    flux.actions.shortcuts.addShortcut(keyObj.key,
                        keyObj.modifiers || {}, this.toggle, this.props.id + keyObj.key, true);
                }, this);
            }
        },

        /**
         * Clean-up event handlers and shortcuts on this dialog
         */
        _removeListeners: function () {
            if (this.props.dismissOnWindowClick) {
                window.removeEventListener("click", this._handleWindowClick);
            }

            if (this.props.dismissOnCanvasClick) {
                os.removeListener(os.eventKind.EXTERNAL_MOUSE_DOWN, this.toggle);
                os.removeListener("externalMouseWheel", this._handleMouseWheel);
            }

            if (this.props.dismissOnWindowResize) {
                window.removeEventListener("resize", this._handleWindowResize);
            }

            if (this.props.dismissOnKeys && _.isArray(this.props.dismissOnKeys)) {
                var flux = this.getFlux();
                this.props.dismissOnKeys.forEach(function (keyObj) {
                    flux.actions.shortcuts.removeShortcut(this.props.id + keyObj.key);
                }, this);
            }
        },

        render: function () {
            var children,
                globalClass = (this.props.position === POSITION_METHODS.CENTER) ? "dialog__center" : "dialog__target",
                // We reverse the pointerAbove/Below classes as they remove the dialog pointer rather than add it
                classes = classnames(globalClass, this.props.className || "",
                    { "hide-bottom-pointer": !this.state.pointerBelow },
                    { "hide-top-pointer": !this.state.pointerAbove }),
                props = {
                    className: classes,
                    style: {
                        top: this.state.topPosition,
                        bottom: this.state.bottomPosition,
                        left: this.state.leftPosition
                    }
                };

            if (this.state.open) {
                if (!this.props.modal) {
                    props.open = true;
                }
                children = this.props.children;
            } else {
                children = null;
            }

            return (
                <dialog {...props}>
                    {children}
                </dialog>
            );
        }
    });

    module.exports = Dialog;
});
