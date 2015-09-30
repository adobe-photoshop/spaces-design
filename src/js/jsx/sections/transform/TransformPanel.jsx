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

    var SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        AlignDistribute = require("jsx!./AlignDistribute"),
        Size = require("jsx!./Size"),
        Position = require("jsx!./Position"),
        Rotate = require("jsx!./Rotate"),
        Combine = require("jsx!./Combine"),
        Flip = require("jsx!./Flip");

    var TransformPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("ui")],

        getStateFromFlux: function () {
            var uiStore = this.getFlux().store("ui"),
                uiState = uiStore.getState();

            return {
                referencePoint: uiState.referencePoint
            };
        },

        shouldComponentUpdate: function (nextProps) {
            if (!this.props.active && !nextProps.active) {
                return false;
            }
            
            return true;
        },

        /**
         * Set the reference point on click.
         *
         * @private
         * @param {string} referencePoint One of "a", "b", "c"
         */
        _handleReferenceClick: function (referencePoint) {
            this.getFlux().actions.ui.setReferencePoint(referencePoint);
        },
        
        render: function () {
            var sectionClasses = classnames({
                "transform": true,
                "section": true,
                "section__active": this.props.active
            });
            
            var positionRotateClasses = classnames("formline",
                "formline__bottom-align",
                "formline__space-between",
                "formline__padded-first-child");

            var currentReferencePoint = this.state.referencePoint,
                getReferenceClasses = function (referencePoint) {
                    return classnames({
                        "reference-point": true,
                        "reference-point__active": referencePoint === currentReferencePoint
                    });
                };

            return (
                <section className={sectionClasses}>
                    <header className="section-header">
                        <AlignDistribute document={this.props.document} />
                    </header>
                    <div className="section-container__no-collapse transform__body">
                        <div className="formline formline__padded-first-child formline__space-between">
                            <div className="control-group">
                                <Size document={this.props.document} />
                            </div>
                        </div>
                        <div className="control-group reference-mark reference-point-button">
                                    <span
                                        className={getReferenceClasses("lt")}
                                        onClick={this._handleReferenceClick.bind(this, "lt")}>
                                            lt
                                    </span>
                                    <span
                                        className={getReferenceClasses("mt")}
                                        onClick={this._handleReferenceClick.bind(this, "mt")}>
                                            mt
                                    </span>
                                    <span
                                        className={getReferenceClasses("rt")}
                                        onClick={this._handleReferenceClick.bind(this, "rt")}>
                                            rt
                                    </span>
                                </div>
                                <div className="control-group reference-mark reference-point-button">
                                    <span
                                        className={getReferenceClasses("lc")}
                                        onClick={this._handleReferenceClick.bind(this, "lc")}>
                                            lc
                                    </span>
                                    <span
                                        className={getReferenceClasses("mc")}
                                        onClick={this._handleReferenceClick.bind(this, "mc")}>
                                            mc
                                    </span>
                                    <span
                                        className={getReferenceClasses("rc")}
                                        onClick={this._handleReferenceClick.bind(this, "rc")}>
                                            rc
                                    </span>
                                </div>
                                <div className="control-group reference-mark reference-point-button">
                                    <span
                                        className={getReferenceClasses("lb")}
                                        onClick={this._handleReferenceClick.bind(this, "lb")}>
                                            lb
                                    </span>
                                    <span
                                        className={getReferenceClasses("mb")}
                                        onClick={this._handleReferenceClick.bind(this, "mb")}>
                                            mb
                                    </span>
                                    <span
                                        className={getReferenceClasses("rb")}
                                        onClick={this._handleReferenceClick.bind(this, "rb")}>
                                            rb
                                    </span>
                                </div>
                        <div className={positionRotateClasses}>
                            <div className="control-group">
                                <Position document={this.props.document} />
                            </div>
                            <div className="control-group">
                                <Rotate document={this.props.document} />
                            </div>
                        </div>
                        <div className="formline formline__space-between">
                            <Combine document={this.props.document} />
                            <Flip document={this.props.document} />
                        </div>
                    </div>
                </section>
            );
        }
    });

    module.exports = TransformPanel;
});
