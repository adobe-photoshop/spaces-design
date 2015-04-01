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
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var os = require("adapter/os"),
        _ = require("lodash"),
        math = require("js/util/math"),
        log = require("js/util/log");

    /**
     * Valid methods of positioning the dialog
     * 
     * @const {{string: string}}
     */
    var POSITION_METHODS = {
        CENTER: "center",
        TARGET: "target"
    };

    var Dialog = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("dialog")],

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
                position: POSITION_METHODS.TARGET, //for backwards compatibility
                dismissOnDialogOpen: true,
                dismissOnDocumentChange: true,
                dismissOnSelectionTypeChange: false,
                dismissOnWindowClick: true,
                dismissOnWindowResize: true,
                dismissOnCanvasClick: false
            };
        },

        statics: {
            POSITION_METHODS : POSITION_METHODS
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
            this.getFlux().actions.dialog.registerDialog(this.props.id, this._getDismissalPolicy());
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
                selectionTypeChange: this.props.dismissOnSelectionTypeChange,
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
            } else if (!this.props.disabled) {

                if (event && event.target) {
                    this.setState({
                        target: event.target
                    });
                }

                flux.actions.dialog.openDialog(id, this._getDismissalPolicy());
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

        /**
         * Position the dialog according to the target
         *
         * @private
         * @param {DOMElement} dialogEl the dialog DOM element
         */
        _positionDialog: function (dialogEl) {
            var dialogBounds = dialogEl.getBoundingClientRect(),
                clientHeight = document.documentElement.clientHeight,
                clientWidth = document.documentElement.clientWidth,

                // Need to account for element margin
                dialogComputedStyle = getComputedStyle(dialogEl),
                dialogMarginTop = math.pixelDimensionToNumber(dialogComputedStyle.marginTop),
                dialogMarginBottom = math.pixelDimensionToNumber(dialogComputedStyle.marginBottom);

            if (this.props.position === POSITION_METHODS.TARGET && this.state.target) {
                // Adjust the position of the opened dialog according to the target
                var targetBounds = this.state.target.getBoundingClientRect(),
                    placedDialogTop = targetBounds.bottom,
                    placedDialogBottom = placedDialogTop + dialogBounds.height;

                if (placedDialogBottom > clientHeight) {                    
                    // If there is space, let's place this above the target
                    if(dialogBounds.height + dialogMarginTop + dialogMarginBottom  < targetBounds.top){
                        placedDialogTop = targetBounds.top - dialogBounds.height - dialogMarginTop - dialogMarginBottom;
                    }else{
                        placedDialogTop = clientHeight - dialogBounds.height - dialogMarginTop - dialogMarginBottom;
                    }
                }

                dialogEl.style.top = placedDialogTop + "px";

            } else {
                // If this was supposed to position by target, but there was none, gripe
                if (this.props.position === POSITION_METHODS.TARGET) {
                    log.error ("Could not find a target by which to render this dialog: %s", this.displayName());
                }
                // Adjust the position of the opened dialog according to the center of the app
                dialogEl.style.top = ((clientHeight - dialogBounds.height) / 2) + "px";
                dialogEl.style.left = ((clientWidth - dialogBounds.width) / 2) + "px";
            }
        },

        /**
         * Add event handlers and shortcuts on this dialog
         */
        _addListeners: function () {
            if (this.props.dismissOnWindowClick) {
                window.addEventListener("click", this._handleWindowClick);
            } else if (this.props.dismissOnCanvasClick) {
                os.once(os.eventKind.EXTERNAL_MOUSE_DOWN, this.toggle);
            }

            if (this.props.dismissOnWindowResize)  {
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

            if (this.props.dismissOnWindowResize)  {
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
                props = {
                    ref: "dialog",
                    className: this.props.className
                };

            if (this.state.open) {
                if (!this.props.modal) {
                    props.open = true;
                }
                // Inject a function into each child that will toggle the state of the dialog
                children = React.Children.map(this.props.children, function (child) {
                    return React.addons.cloneWithProps(child, {
                        dialogToggle: this.toggle,
                        key: child.key || this.props.id + child.id
                    });
                }, this);
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
            var dialogEl = this.refs.dialog.getDOMNode();

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

        componentWillUnmount: function () {
            if (this.state.open) {
                this._removeListeners();
                this.getFlux().actions.dialog.closeDialog(this.props.id);
            }
            this.getFlux().actions.dialog.deregisterDialog(this.props.id);
        },

        isOpen: function () {
            return this.state.open;
        }
    });

    module.exports = Dialog;
});
