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
        FluxMixin = Fluxxor.FluxMixin(React);

    var Toolbar = require("jsx!js/jsx/Toolbar"),
        Scrim = require("jsx!js/jsx/Scrim"),
        Properties = require("jsx!js/jsx/Properties"),
        DocumentHeader = require("jsx!js/jsx/DocumentHeader"),
        Help = require("jsx!js/jsx/Help");

    /**
     * @const
     * @type {Array.<string>} Input events to block when the component becomes inactive.
     */
    var INPUT_EVENTS = [
        "input",
        "change",
        "click",
        "dblclick",
        "mousedown",
        "mousemove",
        "mouseup",
        "touchstart",
        "touchmove",
        "touchend",
        "keydown",
        "keypress",
        "keyup",
        "focus",
        "blur",
        "paste",
        "selectionchange"
    ];

    var Main = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                ready: false,
                inputEnabled: false
            };
        },

        /**
         * We handle keydown events through the adapter if and only if the
         * active element is the body.
         * 
         * @param {KeyboardEvent} event
         */
        _suppressBodyKeydown: function (event) {
            if (event.target === window.document.body) {
                event.preventDefault();
            }
        },

        /**
         * Handler which stops propagation of the given event
         *
         * @private
         * @param {Event} event
         */
        _blockInput: function (event) {
            event.stopPropagation();
        },

        /**
         * Remove event handlers that block input
         *
         * @private
         */
        _enableInput: function () {
            INPUT_EVENTS.forEach(function (event) {
                window.removeEventListener(event, this._blockInput, true);
            }, this);
        },

        /**
         * Add event handlers that block input
         *
         * @private
         */
        _disableInput: function () {
            INPUT_EVENTS.forEach(function (event) {
                window.addEventListener(event, this._blockInput, true);
            }, this);
        },
        
        /**
         * Fade in the UI once the FluxController instance is initialized.
         *
         * @private
         */
        _handleControllerReady: function () {
            this.setState({
                ready: true,
                active: true
            });
        },

        /**
         * When the controller is locked, mark the component as inactive.
         */
        _handleControllerLock: function () {
            this.setState({
                active: false
            });
        },

        /**
         * When the controller is unlocked, mark the component as active.
         */
        _handleControllerUnlock: function () {
            this.setState({
                active: true
            });
        },

        componentWillMount: function () {
            window.document.body.addEventListener("keydown", this._suppressBodyKeydown, true);

            // Listen for events to enable/disable input when the controller becomes active/inactive
            this.props.controller.on("ready", this._handleControllerReady);
            this.props.controller.on("lock", this._handleControllerLock);
            this.props.controller.on("unlock", this._handleControllerUnlock);

            // Mount with input disabled
            this._disableInput();
        },

        componentWillUnmount: function () {
            window.document.body.removeEventListener("keydown", this._suppressBodyKeydown);
            this.props.controller.off("ready", this._handleControllerReady);
            this.props.controller.off("lock", this._handleControllerLock);
            this.props.controller.off("unlock", this._handleControllerUnlock);

            this._enableInput();
        },

        componentDidUpdate: function (prevProps, prevState) {
            var payload = {
                propertiesWidth: this.refs.properties.getDOMNode().clientWidth,
                headerHeight: this.refs.docHeader.getDOMNode().clientHeight
            };
            
            this.getFlux().actions.ui.updatePanelSizes(payload);
            this.getFlux().actions.tools.resetSuperselect();

            // Toggle input when the component switches to or from an active state
            if (this.state.ready) {
                if (this.state.active && !prevState.active) {
                    this._enableInput();
                } else if (!this.state.active && prevState.active) {
                    this._disableInput();
                }
            }
        },

        render: function () {
            var className = React.addons.classSet({
                main: true,
                "main__ready": this.state.ready
            });
            return (
                <div className={className}>
                    <Scrim/>
                    <DocumentHeader ref="docHeader"/>
                    <Toolbar />
                    <Properties ref="properties"/>
                    <Help/>
                </div>
            );
        }
    });

    module.exports = Main;
});
