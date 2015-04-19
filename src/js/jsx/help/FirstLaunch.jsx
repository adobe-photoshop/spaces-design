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
        _ = require("lodash"),
        adapter = require("adapter");

    var Carousel = require("jsx!js/jsx/shared/Carousel"),
        strings = require("i18n!nls/strings");
        
    var FirstLaunch = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            dismissDialog: React.PropTypes.func
        },

        getDefaultProps: function() {
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
        * Open passed URL, stops event propagation
        *
        * @param {string} url
        * @param {SyntheticEvent} event
        */
        _openURL: function(url, event){
            adapter.openURLInDefaultBrowser(url, function(){});     
            event.stopPropagation();       
        },

        render: function () {
            var psDesignTwitterURL = "https://www.adobe.com/go/designspace-twitter",
                psDesignURL = "http://photoshopfordesign.com",
                psHelpURL = "https://www.adobe.com/go/designspace-help.html",
                
                firstLaunchCarouselItems = [
                (<div className="carousel__slide__full">
                    <h1>{strings.FIRST_LAUNCH.SLIDES[0].HEADLINE}</h1>
                    <h2>{strings.FIRST_LAUNCH.SLIDES[0].SUBHEAD}</h2>
                    <p>{strings.FIRST_LAUNCH.SLIDES[0].BODY}</p>
                </div>),
                (<div className="carousel__slide">
                    <div className="carousel__slide__head">
                        <img src="img/first_launch/slide_2_head.png"/>
                    </div>
                    <div className="carousel__slide__body">
                        <h2>{strings.FIRST_LAUNCH.SLIDES[1].HEADLINE}</h2>
                        <p>{strings.FIRST_LAUNCH.SLIDES[1].BODY}</p>
                    </div>
                </div>),
                (<div className="carousel__slide">
                    <div className="carousel__slide__head">
                        <ul className="carousel__slide__head__list">
                            <li>
                                <h3>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_SELECT.TITLE}</h3>
                                <p>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_SELECT.BODY}</p>
                            </li>
                            <li>
                                <h3>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_VECTOR.TITLE}</h3>
                                <p>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_VECTOR.BODY}</p>
                            </li>
                            <li>
                                <h3>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_MATH.TITLE}</h3>
                                <p>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_MATH.BODY}</p>
                            </li>                
                        </ul>
                        <ul className="carousel__slide__head__list">
                            <li>
                                <h3>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_ARTBOARD.TITLE}</h3>
                                <p>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_ARTBOARD.BODY}</p>
                            </li>
                            <li>
                                <h3>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_SWAP.TITLE}</h3>
                                <p>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_SWAP.BODY}.</p>
                            </li>
                            <li>
                                <h3>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_OS.TITLE}</h3>
                                <p>{strings.FIRST_LAUNCH.SLIDES[2].FEATURE_OS.BODY}</p>
                            </li>                
                        </ul>                
                    </div>
                    <div className="carousel__slide__body">
                        <h2>{strings.FIRST_LAUNCH.SLIDES[2].HEADLINE}</h2>
                        <p>{strings.FIRST_LAUNCH.SLIDES[2].BODY}</p>
                    </div>
                </div>),
                (<div className="carousel__slide">
                    <div className="carousel__slide__head">
                        <video autoPlay="autoPlay" loop="loop" >
                            <source src="img/first_launch/getting-started-animation.ogg" type="video/ogg"/>
                        </video>
                    </div>
                    <div className="carousel__slide__body">
                        <h2>{strings.FIRST_LAUNCH.SLIDES[3].HEADLINE}</h2>
                        <p>{strings.FIRST_LAUNCH.SLIDES[3].BODY}</p>
                    </div>
                </div>),
                (<div className="carousel__slide">
                    <div className="carousel__slide__head links">
                        <div className="carousel__slide__block">
                            <a 
                                className="carousel__slide__block-link"
                                onClick={this._openURL.bind(this, psDesignTwitterURL)}>
                                <div className="block-link__image">
                                    <img src="img/first_launch/twitter.svg" />
                                </div>
                                <p className="block-link__body">@psdesign</p>
                            </a>
                        </div>
                        <div className="carousel__slide__block">
                            <a 
                                className="carousel__slide__block-link"
                                onClick={this._openURL.bind(this, psDesignURL)}>
                                <div className="block-link__image">
                                    <img src="img/first_launch/ps_logo.svg" />                            
                                </div>
                                <p className="block-link__body">photoshopfordesign.com</p>                            
                            </a>
                        </div>
                        <div className="carousel__slide__block">
                            <a
                                className="carousel__slide__block-link" 
                                onClick={this._openURL.bind(this, psHelpURL)}> 
                                <div className="block-link__image">
                                    <img src="img/first_launch/help.png" />
                                </div>
                                <p className="block-link__body">Photoshop Help</p>
                            </a>
                        </div>                                                
                    </div>
                    <div className="carousel__slide__body">
                        <h2>{strings.FIRST_LAUNCH.SLIDES[4].HEADLINE}</h2>
                        <p>{strings.FIRST_LAUNCH.SLIDES[4].BODY} 
                            <a onClick={this._openURL.bind(this, psDesignURL)}>photoshopfordesign.com</a>.</p>
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
