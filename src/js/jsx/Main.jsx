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
        Fluxxor = require("fluxxor");

    var FluxMixin = Fluxxor.FluxMixin(React);

    var Toolbar = require("jsx!js/jsx/Toolbar"),
        Scrim = require("jsx!js/jsx/Scrim"),
        Properties = require("jsx!js/jsx/Properties"),
        DocumentHeader = require("jsx!js/jsx/DocumentHeader"),
        Help = require("jsx!js/jsx/Help"),
        Gutter = require("jsx!js/jsx/shared/Gutter");

    var Main = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                ready: false
            };
        },

        /**
         * We handle keydown events through the adapter if and only if the
         * active element is the body.
         * 
         * @param {KeyboardEvent} event
         */
        _suppressBodyKeydown: function (event) {
            if (event.target === document.body) {
                event.preventDefault();
            }
        },
        
        /**
         * Fade in the UI once the FluxController instance is initialized.
         *
         * @private
         */
        _handleControllerStarted: function () {
            this.setState({
                ready: true
            });
        },

        componentWillMount: function() {
            document.body.addEventListener("keydown", this._suppressBodyKeydown, true);
            this.props.controller.on("started", this._handleControllerStarted);
        },

        componentWillUnmount: function() {
            document.body.removeEventListener("keydown", this._suppressBodyKeydown);
            this.props.controller.off("started", this._handleControllerStarted);
        },

        componentDidUpdate: function () {
            var payload = {
                propertiesWidth: this.refs.properties.getDOMNode().clientWidth,
                headerHeight: this.refs.docHeader.getDOMNode().clientHeight
            };
            
            this.getFlux().actions.ui.updatePanelSizes(payload);
            this.getFlux().actions.tools.resetSuperselect();
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
                    <Gutter
                        size="spacer-1"/>
                    <Toolbar />
                    <Gutter
                        size="spacer-1"/>
                    <Properties ref="properties"/>
                    <Help/>
                </div>
            );
        }
    });

    module.exports = Main;
});
