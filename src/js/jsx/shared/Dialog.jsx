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

    var React = require("react");

    var Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var os = require("adapter/os"),
        _ = require("lodash");

    var Dialog = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("dialog")],

        propTypes: {
            id: React.PropTypes.string.isRequired,
            dismissOnDialogOpen: React.PropTypes.bool,
            dismissOnDocumentChange: React.PropTypes.bool,
            dismissOnSelectionTypeChange: React.PropTypes.bool,
            dismissOnWindowClick: React.PropTypes.bool,
            dismissOnCanvasClick: React.PropTypes.bool
        },

        getDefaultProps: function () {
            return {
                onOpen: _.identity,
                onClose: _.identity,
                dismissOnDialogOpen: true,
                dismissOnDocumentChange: true,
                dismissOnSelectionTypeChange: false,
                dismissOnWindowClick: true,
                dismissOnCanvasClick: false
            };
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

        /**
         * Toggle dialog visibility.
         * 
         * @param {SyntheticEvent} event
         */
        toggle: function (event) {
            var flux = this.getFlux(),
                id = this.props.id;

            if (this.state.open) {
                flux.actions.dialog.closeDialog(id);
            } else {
                var dismissalPolicy = {
                    dialogOpen: this.props.dismissOnDialogOpen,
                    documentChange: this.props.dismissOnDocumentChange,
                    selectionTypeChange: this.props.dismissOnSelectionTypeChange,
                    windowClick: this.props.dismissOnWindowClick,
                    canvasClick: this.props.dismissOnCanvasClick
                };

                this.setState({
                    target: event.target
                });

                flux.actions.dialog.openDialog(id, dismissalPolicy);
            }
            
            event.stopPropagation();
        },

        /**
         * Handle window clicks, closing the dialog if the click is outside the
         * dialog bounds.
         * 
         * @private
         * @param {KeyboardEvent} event
         */
        _handleWindowClick: function (event) {
            if (!this.state.open) {
                return;
            }

            var elt = this.getDOMNode();
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
         * Handle window resize events, closing the open dialog.
         *
         * @param {Event} event
         */
        _handleWindowResize: function (event) {
            // once
            window.removeEventListener("resize", this._handleWindowResize);

            this.toggle(event);
        },

        render: function () {
            var props = {
                ref: "dialog"
            };

            var children;
            if (this.state.open) {
                props.open = true;
                children = this.props.children;
            } else {
                children = null;
            }

            return (
                <dialog {...props}>
                    {children}
                </dialog>
            );
        },

        componentDidUpdate: function (prevProps, prevState) {
            var dialogEl;

            if (this.state.open && !prevState.open) {
                // Dialog opening
                if (this.props.dismissOnWindowClick) {
                    window.addEventListener("click", this._handleWindowClick);
                } else if (this.props.dismissOnCanvasClick) {
                    os.once(os.eventKind.EXTERNAL_MOUSE_DOWN, this._toggle);
                }

                // Dismiss the dialog on window resize
                window.addEventListener("resize", this._handleWindowResize);

                dialogEl = this.refs.dialog.getDOMNode();

                // Adjust the position of the opened dialog
                var dialogBounds = dialogEl.getBoundingClientRect(),
                    targetBounds = this.state.target.getBoundingClientRect(),
                    clientHeight = document.documentElement.clientHeight,
                    placedDialogTop = targetBounds.bottom,
                    placedDialogBottom = placedDialogTop + dialogBounds.height;

                if (placedDialogBottom > clientHeight) {
                    placedDialogTop = clientHeight - dialogBounds.height;
                }

                dialogEl.style.top = placedDialogTop + "px";

                this.props.onOpen();
            } else if (!this.state.open && prevState.open) {
                // Dialog closing
                if (this.props.dismissOnWindowClick) {
                    window.removeEventListener("click", this._handleWindowClick);
                }

                window.removeEventListener("resize", this._handleWindowResize);

                dialogEl = this.refs.dialog.getDOMNode();
                dialogEl.style.top = "";

                this.props.onClose();
            }
        },

        componentWillUnmount: function () {
            if (this.state.open) {
                window.removeEventListener("click", this._handleWindowClick);
            }
        },

        isOpen: function () {
            return this.state.open;
        }
    });

    module.exports = Dialog;
});
