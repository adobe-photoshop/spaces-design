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

    var Toolbar = require("jsx!js/jsx/Toolbar"),
        Scrim = require("jsx!js/jsx/Scrim"),
        Panel = require("jsx!js/jsx/Panel"),
        DocumentHeader = require("jsx!js/jsx/DocumentHeader"),
        Help = require("jsx!js/jsx/Help"),
        Search = require("jsx!js/jsx/Search"),
        Guard = require("jsx!js/jsx/Guard");

    var Main = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                ready: false,
                active: false
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return this.state.ready !== nextState.ready ||
                this.state.active !== nextState.active;
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
        },

        componentWillUnmount: function () {
            window.document.body.removeEventListener("keydown", this._suppressBodyKeydown);
            this.props.controller.off("ready", this._handleControllerReady);
            this.props.controller.off("lock", this._handleControllerLock);
            this.props.controller.off("unlock", this._handleControllerUnlock);
        },

        componentDidUpdate: function () {
            if (this.state.active) {
                var payload = {
                    panelWidth: React.findDOMNode(this.refs.panel).clientWidth,
                    headerHeight: React.findDOMNode(this.refs.docHeader).clientHeight
                };

                this.getFlux().actions.ui.updatePanelSizes(payload);
                this.getFlux().actions.tools.resetSuperselect();
            }
        },

        render: function () {
            var className = classnames({
                main: true,
                "main__ready": this.state.ready
            });
            return (
                <div className={className}>
                    <Guard
                        disabled={this.state.ready && this.state.active} />
                    <Scrim
                        active={this.state.active} />
                    <DocumentHeader
                        ref="docHeader"
                        active={this.state.active} />
                    <Toolbar
                        active={this.state.active} />
                    <Panel
                        ref="panel"
                        active={this.state.active} />
                    <Help />
                    <Search />
                </div>
            );
        }
    });

    module.exports = Main;
});
