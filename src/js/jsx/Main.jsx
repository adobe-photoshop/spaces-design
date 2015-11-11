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

    var Toolbar = require("js/jsx/Toolbar"),
        Scrim = require("js/jsx/Scrim"),
        PanelSet = require("js/jsx/PanelSet"),
        DocumentHeader = require("js/jsx/DocumentHeader"),
        Help = require("js/jsx/Help"),
        Search = require("js/jsx/Search"),
        ExportModal = require("js/jsx/sections/export/ExportModal"),
        Guard = require("js/jsx/Guard"),
        system = require("js/util/system");

    // To enable animations, add a feature flags object to manifest.json and then
    // set the property use_animations:true in that object. You will need to restart Photoshop
    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    var USE_ANIMATIONS = !!(_spaces.feature_flags && _spaces.feature_flags.use_animations);
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers

    var Main = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("preferences", "panel")],
        
        propTypes: {
            initialColorStop: React.PropTypes.string.isRequired
        },

        getInitialState: function () {
            return {
                ready: false,
                active: false
            };
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                colorStop = flux.store("panel").getColorStop() || this.props.initialColorStop;

            return {
                colorStop: colorStop
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return this.state.ready !== nextState.ready ||
                this.state.active !== nextState.active ||
                this.state.colorStop !== nextState.colorStop;
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
         *
         * @private
         */
        _handleControllerLock: function () {
            this.setState({
                active: false
            });
        },

        /**
         * When the controller is unlocked, mark the component as active.
         *
         * @private
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

        componentDidMount: function () {
            window.document.documentElement.lang = system.language;
        },

        render: function () {
            /* global _spaces */
            var colorStop = this.state.colorStop || this.props.initialColorStop,
                stopClass = "color-stop__" + colorStop.toLowerCase();

            var className = classnames({
                main: true,
                "main__ready": this.state.ready,
                "main__animation": USE_ANIMATIONS
            }, stopClass);

            return (
                <div className={className}>
                    <Guard
                        disabled={this.state.ready && this.state.active} />
                    <Scrim
                        active={this.state.active} />
                    <Toolbar
                        ref="toolbar"
                        active={this.state.active} />
                    <DocumentHeader
                        ref="docHeader"
                        active={this.state.active} />
                    <PanelSet
                        ref="panelSet"
                        active={this.state.active}
                        useAnimations={USE_ANIMATIONS} />
                    <Help />
                    <Search />
                    <ExportModal />
                </div>
            );
        }
    });

    module.exports = Main;
});
