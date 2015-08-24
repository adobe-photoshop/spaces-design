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

    var Promise = require("bluebird"),
        React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React);
        
    var librariesAction = require("js/actions/libraries");

    var AssetPreviewImage = React.createClass({
        mixins: [FluxMixin],
        
        propTypes: {
            element: React.PropTypes.object.isRequired,
            onComplete: React.PropTypes.func
        },
        
        getInitialState: function () {
            return {
                loading: true,
                renditionPath: null
            };
        },
        
        componentWillMount: function () {
            // On mount, get the rendition of this element
            var element = this.props.element;

            Promise.fromNode(function (cb) {
                element.getRenditionPath(librariesAction.RENDITION_SIZE, cb);
            }).bind(this).then(function (path) {
                // path will be undefined when the element is a graphic and its representation 
                // is empty (e.g. an empty artboard).
                this.setState({
                    hasRendition: !!path,
                    renditionPath: path,
                    loading: false
                });
                
                if (this.props.onComplete) {
                    this.props.onComplete(this.state.hasRendition, this.state.renditionPath);
                }
            });
        },

        render: function () {
            if (this.state.loading) {
                return (<div className="libraries__asset__preview-image
                    libraries__asset__preview-image-loading"/>);
            }
            
            if (!this.state.hasRendition) {
                return (<div className="libraries__asset__preview-image
                    libraries__asset__preview-image-blank"/>);
            }
            
            return (<div className="libraries__asset__preview-image"
                style={{ backgroundImage: "url('" + this.state.renditionPath + "')" }}/>);
        }
    });

    module.exports = AssetPreviewImage;
});
