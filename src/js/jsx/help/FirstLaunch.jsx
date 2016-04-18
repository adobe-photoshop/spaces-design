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
        _ = require("lodash");

    var Carousel = require("js/jsx/shared/Carousel"),
        nls = require("js/util/nls"),
        system = require("js/util/system"),
        SVGIcon = require("js/jsx/shared/SVGIcon");
 
    var FirstLaunch = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            dismissDialog: React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                dismissDialog: _.identity
            };
        },
  
        /**
         * Dismiss the parent dialog, and also set a preference flag based on doNotShowAgain
         *
         * @param {boolean} doNotShowAgain if true, sets preference to not show first launch in the future
         * @param {SyntheticEvent} event
         */
        _dismissDialog: function (doNotShowAgain, event) {
            if (doNotShowAgain) {
                this.getFlux().actions.preferences.setPreference("showFirstLaunch", false);
            }
            if (_.isFunction(this.props.dismissDialog)) {
                this.props.dismissDialog(event);
            }
        },

        /**
         * Calls for the URL to be opened and then logs the headlights data
         *
         * @private
         * @param {string} url
         * @param {string} name
         */
        _handleClick: function (url, name) {
            this.getFlux().actions.menu.openURL({
                category: "user-interface",
                subcategory: "introduction-link",
                eventName: name,
                url: url
            });
        },

        /**
         * On Mac only, render an advertisement for Adobe Experience Design CC.
         *
         * @return {?ReactElement}
         */
        _renderAdvertisement: function () {
            if (!system.isMac) {
                return null;
            }

            var onClick = this._handleClick.bind(this, "http://www.adobe.com/go/experience-design", "xdAd"),
                rawParts = nls.localize("strings.FIRST_LAUNCH.SLIDES.7.BODY_ADVERTISEMENT_1").split("{ADOBE_XD}"),
                formattedParts = [
                    rawParts[0],
                    <em>{nls.localize("strings.FIRST_LAUNCH.SLIDES.7.ADOBE_XD")}</em>,
                    rawParts[1] + " ",
                    (<a href="#" onClick={onClick}>
                        {nls.localize("strings.FIRST_LAUNCH.SLIDES.7.BODY_ADVERTISEMENT_2")}
                    </a>)
                ];

            return (
                <div className="advertisement">
                    <h3>
                        {formattedParts}
                    </h3>
                </div>
            );
        },

        render: function () {
            var psDesignTwitterURL = "https://www.adobe.com/go/designspace-twitter",
                psForumURL = "https://www.adobe.com/go/designspace-forum",
                githubURL = "https://www.adobe.com/go/designspace-github",
                firstLaunchCarouselItems = [
                (<div className="carousel__slide__full slide-0">
                    <h1>{nls.localize("strings.FIRST_LAUNCH.SLIDES.0.HEADLINE")}</h1>
                    <img src="img/first_launch/img_slide_ds.png"/>
                    <h3>{nls.localize("strings.FIRST_LAUNCH.SLIDES.0.BODY_FIRST")}</h3>
                    <h3>{nls.localize("strings.FIRST_LAUNCH.SLIDES.0.BODY_SECOND")}</h3>
                </div>),
                (<div className="carousel__slide__full">
                    <img src="img/first_launch/img_slide_toolset.gif"/>
                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.1.HEADLINE")}</h2>
                </div>),
                (<div className="carousel__slide__full">
                    <img src="img/first_launch/img_slide_search.png"/>
                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.2.HEADLINE_FIRST")}</h2>
                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.2.HEADLINE_SECOND")}</h2>
                </div>),
                (<div className="carousel__slide__full slide-3">
                    <img src="img/first_launch/img_slide_sampler.png"/>
                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.3.HEADLINE_FIRST")}</h2>
                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.3.HEADLINE_SECOND")}</h2>
                </div>),
                (<div className="carousel__slide__full slide-4">
                    <img src="img/first_launch/img_slide_artboards.gif"/>
                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.4.HEADLINE")}</h2>
                </div>),
                (<div className="carousel__slide__full slide-5">
                    <img src="img/first_launch/img_slide_swap.gif"/>
                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.5.HEADLINE")}</h2>
                </div>),
                (<div className="carousel__slide__full slide-6">
                    <img src="img/first_launch/img_slide_switching.gif"/>
                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.6.HEADLINE")}</h2>
                </div>),
                (<div className="carousel__slide">
                    <div className="carousel__slide__body">
                        <h1>{nls.localize("strings.FIRST_LAUNCH.SLIDES.7.HEADLINE")}</h1>
                        <ul className="carousel__slide__three__list">
                            <li>
                                <div
                                    onClick={this._handleClick.bind(this, psDesignTwitterURL, "twitter")}>
                                    <SVGIcon
                                        CSSID="bird"/>
                                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.7.BODY_FIRST")}</h2>
                                </div>
                            </li>
                        </ul>
                        <ul className="carousel__slide__three__list">
                            <li>
                                <div
                                    onClick={this._handleClick.bind(this, githubURL, "github")}>
                                    <SVGIcon
                                        CSSID="github"/>
                                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.7.BODY_SECOND")}</h2>
                                </div>
                            </li>
                        </ul>
                        <ul className="carousel__slide__three__list">
                            <li>
                                <div
                                    onClick={this._handleClick.bind(this, psForumURL, "forum")}>
                                    <SVGIcon
                                        CSSID="workspace"/>
                                    <h2>{nls.localize("strings.FIRST_LAUNCH.SLIDES.7.BODY_THIRD")}</h2>
                                </div>
                            </li>
                        </ul>
                        {this._renderAdvertisement()}
                    </div>
                </div>)
                ];

            return (
                <div className="first-launch__content" >
                    <Carousel
                        className="first-launch__carousel"
                        useContinueOnFirstSlide={true}
                        useDismissOnLastSlide={true}
                        dismissDialog={this._dismissDialog.bind(this, true)}
                        items={firstLaunchCarouselItems} />
                </div>
            );
        },

        componentWillUnmount: function () {
            // On unmount, update the prefs so this will not load again next time
            this.getFlux().actions.preferences.setPreference("showFirstLaunch", false);
        }

    });

    module.exports = FirstLaunch;
});
