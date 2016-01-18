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
        Immutable = require("immutable"),
        classnames = require("classnames");

    var os = require("adapter").os;

    var TitleHeader = require("js/jsx/shared/TitleHeader"),
        LayerGroup = require("./LayerGroup"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection"),
        synchronization = require("js/util/synchronization");

    /**
     * Get the layer depths that correspond to the current document's visible layers.
     * Used for invalidation
     *
     * @private
     * @param {object} props
     * @return {?Immutable.Iterable.<number>}
     */
    var _getDepths = function (props) {
        var document = props.document;
        if (!document) {
            return null;
        }

        var layers = document.layers.allVisible;
        return layers.map(document.layers.depth.bind(document.layers));
    };

    /**
     * Get the layer faces that correspond to the current document. Used for
     * fast, coarse invalidation.
     *
     * @private
     * @param {object} props
     * @return {?Immutable.Iterable.<Immutable.Map.<string, *>>}
     */
    var _getFaces = function (props) {
        var document = props.document;
        if (!document) {
            return null;
        }

        var layers = document.layers.allVisible;
        return collection.pluck(layers, "face");
    };

    var LayersPanel = React.createClass({
        mixins: [FluxMixin],

        /**
         * A throttled version of os.setTooltip
         *
         * @private
         * @type {?function}
         */
        _setTooltipThrottled: null,

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
        },

        shouldComponentUpdate: function (nextProps) {
            if (this.props.disabled !== nextProps.disabled ||
                this.props.active !== nextProps.active) {
                return true;
            }

            if (this.props.visible !== nextProps.visible) {
                return true;
            }

            return this.props.active !== nextProps.active ||
                !Immutable.is(_getFaces(this.props), _getFaces(nextProps)) ||
                !Immutable.is(_getDepths(this.props), _getDepths(nextProps));
        },

        /**
         * Deselects all layers.
         *
         * @private
         */
        _handleContainerClick: function () {
            this.getFlux().actions.layers.deselectAll();
        },

        /**
         * Workaround a CEF bug by clearing any active tooltips when scrolling.
         * More details here: https://github.com/adobe-photoshop/spaces-design/issues/444
         *
         * @private
         */
        _handleScroll: function () {
            this._setTooltipThrottled("");
        },

        render: function () {
            var doc = this.props.document,
                containerClasses = classnames({
                    "section-container": true,
                    "section-container__collapsed": !this.props.visible
                }),
                sectionClasses = classnames({
                    "layers": true,
                    "section": true,
                    "section__active": this.props.active,
                    "section__collapsed": !this.props.visible
                });

            return (
                <section
                    className={sectionClasses}
                    onScroll={this._handleScroll}>
                    <TitleHeader
                        title={nls.localize("strings.TITLE_PAGES")}
                        visible={this.props.visible}
                        disabled={this.props.disabled}
                        onDoubleClick={this.props.onVisibilityToggle}>
                    </TitleHeader>
                    <div
                        ref="container"
                        className={containerClasses}
                        onClick={this._handleContainerClick}>
                        <LayerGroup
                            layerNodes={doc.layers.roots}
                            document={doc}
                            disabled={this.props.disabled}/>
                    </div>
                </section>
            );
        }
    });

    module.exports = LayersPanel;
});
