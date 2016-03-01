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
        classnames = require("classnames"),
        Immutable = require("immutable");

    var AlignDistribute = require("./AlignDistribute"),
        Size = require("./Size"),
        Position = require("./Position"),
        Rotate = require("./Rotate"),
        Combine = require("./Combine"),
        Flip = require("./Flip"),
        nls = require("js/util/nls");

    var TransformPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("panel")],

        getStateFromFlux: function () {
            var panelStore = this.getFlux().store("panel"),
                panelState = panelStore.getState();

            return {
                referencePoint: panelState.referencePoint
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return this.state.referencePoint !== nextState.referencePoint ||
                this.props.disabled !== nextProps.disabled ||
                !Immutable.is(this.props.document.layers.selected, nextProps.document.layers.selected) ||
                !Immutable.is(this.props.document.layers.selectedRelativeChildBounds,
                    nextProps.document.layers.selectedRelativeChildBounds) ||
                !Immutable.is(this.props.document.bounds, nextProps.document.bounds);
        },

        /**
         * Set the reference point on click.
         *
         * @private
         * @param {string} referencePoint Two character string denoting the active reference point [lmr][tcb]
         */
        _handleReferenceClick: function (referencePoint) {
            this.getFlux().actions.panel.setReferencePoint(referencePoint);
        },
        
        render: function () {
            var sectionClasses = classnames({
                "transform": true,
                "section": true
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

            var referencePointTooltip = nls.localize("strings.TOOLTIPS.REFERENCE_POINT_TOOL");

            return (
                <section className={sectionClasses}>
                    <header className="section-header">
                        <AlignDistribute document={this.props.document} />
                    </header>
                    <div className="section-container__no-collapse transform__body">
                        <div className="formline formline__padded-first-child formline__space-between">
                            <div className="control-group">
                                <Size
                                    document={this.props.document}
                                    referencePoint={this.state.referencePoint}/>
                            </div>
                            <div className="control-group reference-mark" title={referencePointTooltip}>
                                <svg className="reference-none" preserveAspectRatio="xMidYMid" width="100%"
                                    height="100%" viewBox="0 0 24 24">
                                <path d="M21.000,16.000 L21.000,21.000 L16.000,21.000 L16.000,19.000
                                    L14.000,19.000 L14.000,21.000 L9.000,21.000 L9.000,19.000
                                    L7.000,19.000 L7.000,21.000 L2.000,21.000 L2.000,16.000 L4.000,16.000
                                    L4.000,14.000 L2.000,14.000 L2.000,9.000 L4.000,9.000 L4.000,7.000
                                    L2.000,7.000 L2.000,2.000 L7.000,2.000 L7.000,4.000 L9.000,4.000
                                    L9.000,2.000 L14.000,2.000 L14.000,4.000 L16.000,4.000 L16.000,2.000
                                    L21.000,2.000 L21.000,7.000 L19.000,7.000 L19.000,9.000 L21.000,9.000
                                    L21.000,14.000 L19.000,14.000 L19.000,16.000 L21.000,16.000 ZM10.000,20.000
                                    L13.000,20.000 L13.000,17.000 L10.000,17.000 L10.000,20.000
                                    ZM3.000,17.000 L3.000,20.000 L6.000,20.000 L6.000,17.000 L3.000,17.000
                                    ZM3.000,10.000 L3.000,13.000 L6.000,13.000 L6.000,10.000 L3.000,10.000
                                    ZM6.000,3.000 L3.000,3.000 L3.000,6.000 L6.000,6.000 L6.000,3.000
                                    ZM13.000,3.000 L10.000,3.000 L10.000,6.000 L13.000,6.000 L13.000,3.000
                                    ZM16.000,5.000 L14.000,5.000 L14.000,7.000 L9.000,7.000 L9.000,5.000
                                    L7.000,5.000 L7.000,7.000 L5.000,7.000 L5.000,9.000 L7.000,9.000
                                    L7.000,14.000 L5.000,14.000 L5.000,16.000 L7.000,16.000 L7.000,18.000
                                    L9.000,18.000 L9.000,16.000 L14.000,16.000 L14.000,18.000 L16.000,18.000
                                    L16.000,16.000 L18.000,16.000 L18.000,14.000 L16.000,14.000 L16.000,9.000
                                    L18.000,9.000 L18.000,7.000 L16.000,7.000 L16.000,5.000 ZM20.000,6.000
                                    L20.000,3.000 L17.000,3.000 L17.000,6.000 L20.000,6.000 ZM20.000,13.000
                                    L20.000,10.000 L17.000,10.000 L17.000,13.000 L20.000,13.000 ZM17.000,17.000
                                    L17.000,20.000 L20.000,20.000 L20.000,17.000 L17.000,17.000 ZM9.000,9.000
                                    L14.000,9.000 L14.000,14.000 L9.000,14.000 L9.000,9.000 ZM10.000,13.000
                                    L13.000,13.000 L13.000,10.000 L10.000,10.000 L10.000,13.000 Z" />
                                    <rect className={getReferenceClasses("rb")} id="rb"
                                        x="16" y="16" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="rb_hit"
                                        x="16" y="16" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "rb")}/>
                                    <rect className={getReferenceClasses("mb")} id="mb"
                                        x="9" y="16" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="mb_hit"
                                        x="9" y="16" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "mb")}/>
                                    <rect className={getReferenceClasses("lb")} id="lb"
                                        x="2" y="16" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="lb_hit"
                                        x="2" y="16" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "lb")}/>
                                    <rect className={getReferenceClasses("rc")} id="rc"
                                        x="16" y="9" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="rc_hit"
                                        x="16" y="9" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "rc")}/>
                                    <rect className={getReferenceClasses("mc")} id="mc"
                                        x="9" y="9" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="mc_hit"
                                        x="9" y="9" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "mc")}/>
                                    <rect className={getReferenceClasses("lc")} id="lc"
                                        x="2" y="9" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="lc_hit"
                                        x="2" y="9" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "lc")}/>
                                    <rect className={getReferenceClasses("rt")} id="rt"
                                        x="16" y="2" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="rt_hit"
                                        x="16" y="2" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "rt")}/>
                                    <rect className={getReferenceClasses("mt")} id="mt"
                                        x="9" y="2" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="mt_hit"
                                        x="9" y="2" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "mt")}/>
                                    <rect className={getReferenceClasses("lt")} id="lt"
                                        x="2" y="2" width="5" height="5"/>
                                    <rect className={getReferenceClasses()} id="lt_hit"
                                        x="2" y="2" width="8" height="8"
                                        onClick={this._handleReferenceClick.bind(this, "lt")}/>
                                </svg>
                            </div>
                        </div>
                        <div className={positionRotateClasses}>
                            <div className="control-group">
                                <Position
                                    document={this.props.document}
                                    referencePoint={this.state.referencePoint} />
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
