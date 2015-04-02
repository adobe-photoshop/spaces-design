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

    var Carousel = require("jsx!js/jsx/shared/Carousel");
        
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

        render: function () {
            var firstLaunchCarouselItems = [
                (<div className="carousel__slide">
                    <div className="carousel__slide_head">
                        <img src="img/first_launch/slide_1_head.png"/>
                    </div>
                    <div className="carousel__slide_body">
                        <h1>Moving between Design Shop and Photoshop</h1>
                        <p>Photoshop Design Space is fully compatible with core photoshop. 
                        Jump between the two using the shortcut key Control + ~ or
                        navigate to Window > Space in both views</p>                
                    </div>
                </div>),
                (<div className="carousel__slide">
                    <div className="carousel__slide_head">
                        <img src="img/first_launch/slide_2_head.png"/>
                    </div>
                    <div className="carousel__slide_body"></div>
                </div>),
                (<div className="carousel__slide">
                    <div className="carousel__slide_head">
                
                    </div>
                    <div className="carousel__slide_body">
                        <h2>Streamlined Features and Interactions</h2>
                        <p>
                            We’re leveraging a new architecture (using HTML/CSS/JS), 
                            that enables us to add new 
                            interactions and features that will help speed 
                            up your workflows. Expect fewer clicks, 
                            dialogs, settings and controls you have to set
                            and generally get your job done faster. 
                            Stay tuned for more - this is just the beginning.
                        </p>
                    </div>

                </div>),
                (<div className="carousel__slide">
                    <div className="carousel__slide_head">
                        <img src="img/first_launch/slide_4_head.png"/>
                    </div>
                    <div className="carousel__slide_body">
                        <h1>Moving between Design Shop and Photoshop</h1>
                        <p>Photoshop Design Space is fully compatible with core photoshop. 
                        Jump between the two using the shortcut key Control + ~ or
                        navigate to Window > Space in both views</p>                
                    </div>
                </div>)
            ];

            return (
                <div className="first-launch__content" >
                    <Carousel 
                        className="first-launch__carousel"
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
