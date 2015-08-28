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
    
    var SVGIcon = require("jsx!js/jsx/shared/SVGIcon");

    var AssetPreviewImage = React.createClass({
        mixins: [FluxMixin],
        
        propTypes: {
            element: React.PropTypes.object.isRequired,
            onComplete: React.PropTypes.func
        },
        
        /**
         * Timestamp of the element's modified time. The "_updateRenditionPath" function uses this timestamp to 
         * decide whether to re-fetch element's rendition.
         *
         * @private
         * @type {number}
         */
        _elementLastModified: 0,
        
        getInitialState: function () {
            return {
                loading: true,
                renditionPath: null
            };
        },
        
        componentWillMount: function () {
            this._updateRenditionPath();
        },
        
        componentWillUpdate: function () {
            this._updateRenditionPath();
        },
        
        shouldComponentUpdate: function (nextProps, nextState) {
            return this._elementLastModified !== nextProps.element.modified ||
                   this.state.loading !== nextState.loading ||
                   this.state.renditionPath !== nextState.renditionPath;
        },
        
        /**
         * Update asset's rendition path for its initial display or new content.
         *
         * @private
         */
        _updateRenditionPath: function () {
            if (this._elementLastModified === this.props.element.modified) {
                return;
            }
            
            this.setState({
                loading: true,
                renditionPath: null
            });
            
            this._elementLastModified = this.props.element.modified;
            
            var element = this.props.element,
                renditionSize = element.type === librariesAction.ELEMENT_GRAPHIC_TYPE ?
                    librariesAction.RENDITION_GRAPHIC_SIZE : librariesAction.RENDITION_DEFAULT_SIZE;

            Promise.fromNode(function (cb) {
                element.getRenditionPath(renditionSize, cb);
            })
            .bind(this)
            .then(function (path) {
                // path will be undefined when the element is a graphic and its representation 
                // is empty (e.g. an empty artboard).
                this.setState({
                    renditionPath: path ? (path + "?cachebuster=" + this._elementLastModified) : null,
                    loading: false
                });
                
                if (this.props.onComplete) {
                    this.props.onComplete(this.state.renditionPath);
                }
            });
        },

        render: function () {
            if (this.state.loading) {
                return (<div className="libraries__asset__preview-image
                    libraries__asset__preview-image-loading">
                    <SVGIcon viewBox="0 0 16 16" CSSID="loader" iconPath=""/>
                </div>);
            }
            
            if (!this.state.renditionPath) {
                return (<div className="libraries__asset__preview-image
                    libraries__asset__preview-image-blank"/>);
            }
            
            return (<div className="libraries__asset__preview-image">
                <img src={this.state.renditionPath}/>
            </div>);
        }
    });

    module.exports = AssetPreviewImage;
});
