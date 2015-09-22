/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software
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

    var os = require("adapter/os");

    var Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        menu = require("i18n!nls/menu"),
        synchronization = require("js/util/synchronization");

    var PanelSet = React.createClass({
        mixins: [FluxMixin],
        
        /**
         * Update the sizes of the panels.
         *
         * @private
         * @return {Promise}
         */
        _updatePanelSizes: function () {
            var node = React.findDOMNode(this),
                iconBarWidth;

            if (node) {
                iconBarWidth = node.getBoundingClientRect().width;
            } else {
                iconBarWidth = 0;
            }

            return this.getFlux().actions.ui.updatePanelSizes({
                iconBarWidth: iconBarWidth
            });
        },

        /**
         * Debounced version of _updatePanelSizes
         *
         * @private
         */
        _updatePanelSizesDebounced: null,

        componentDidMount: function () {
            this._updatePanelSizesDebounced = synchronization.debounce(this._updatePanelSizes, this, 500);
            os.addListener("displayConfigurationChanged", this._updatePanelSizesDebounced);
            this._updatePanelSizes();
        },

        componentWillUnmount: function () {
            os.removeListener("displayConfigurationChanged", this._updatePanelSizesDebounced);
        },

        render: function () {
            var panelTabBarClassNames = classnames({
                "panel__tab-bar": true,
                "panel__tab-bar__visible": true
            });

            return (
                <div className={panelTabBarClassNames}>
                    <Button
                        className="toolbar__backToPs"
                        title={menu.WINDOW.RETURN_TO_STANDARD}
                        onClick={this._handleBackToPSClick}>
                        <SVGIcon
                            viewbox="0 0 18 16"
                            CSSID="workspace" />
                    </Button>
                    {this.props.children}
                </div>
            );
        },
            
        /**
         * Close Design Space
         *
         * @private
         */
        _handleBackToPSClick: function () {
            this.getFlux().actions.menu.native({ commandID: 5999 });
        }
    });

    module.exports = PanelSet;
});
