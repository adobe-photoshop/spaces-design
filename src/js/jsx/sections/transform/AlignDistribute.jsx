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
        Immutable = require("immutable");

    var SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings");

    var AlignDistribute = React.createClass({
        
        mixins: [FluxMixin],
        
        propTypes: {
            document: React.PropTypes.object
        },
        
        /**
         * Aligns the left edge of the layers 
         * 
         * @private
         */
        _alignLeft: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignLeft(document, layers);
        },

        /**
         * Aligns the right edge of the layers 
         * 
         * @private
         */
        _alignRight: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignRight(document, layers);
        },

        /**
         * Aligns the horizontal Center  of the layers 
         * 
         * @private
         */
        _alignHCenter: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignHCenter(document, layers);
        },

        /**
         * Aligns the top edge of the layers 
         * 
         * @private
         */
        _alignTop: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignTop(document, layers);
        },

        /**
         * Aligns the bottom edge of the layers 
         * 
         * @private
         */
        _alignBottom: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignBottom(document, layers);
        },

        /**
         * Aligns the Vertical Center  of the layers 
         * 
         * @private
         */
        _alignVCenter: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.alignVCenter(document, layers);
        },

        /**
         * Distributes the layers horizontally
         * 
         * @private
         */
        _distributeX: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.distributeX(document, layers);
        },

        /**
         * Distributes the layers vertically
         * 
         * @private
         */
        _distributeY: function () {
            var document = this.props.document,
                layers = document.layers.selected;

            this.getFlux().actions.transform.distributeY(document, layers);
        },

        render: function () {

            var document = this.props.document,
                layers = document ? document.layers.selected : Immutable.List();
            
            
            var layerSet = Immutable.Set(layers.reduce(function (set, layer) { 
                   return set.add(layer);
                }, new Set())
            );

            layers = layers
                .filter(function(layer){
                    return layer.kind !== layer.layerKinds.GROUPEND &&
                         !document.layers.ancestors(layer).some(function(ancestor){
                           return layer !== ancestor && layerSet.contains(ancestor);
                        });
                });
            
            
            var disabled = !document || document.layers.selectedLocked ,
                alignDisabled = disabled || layers.size < 2 ,
                distributeDisabled = disabled || layers.size < 3 ;

            return (
                <div className="header-alignment">
                    <SplitButtonList>
                        <SplitButtonItem
                            title={strings.TOOLTIPS.DISTRIBUTE_HORIZONTALLY}
                            className="button-align-distribute"
                            id="distribute-horizontally"
                            selected={false}
                            disabled={distributeDisabled}
                            onClick={this._distributeX}/>
                        <SplitButtonItem
                            title={strings.TOOLTIPS.DISTRIBUTE_VERTICALLY}
                            className="button-align-distribute"
                            id="distribute-vertically"
                            selected={false}
                            disabled={distributeDisabled}
                            onClick={this._distributeY}/>
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_LEFT}
                            className="button-align-distribute"
                            id="align-left"
                            selected={false}
                            disabled={alignDisabled}
                            onClick={this._alignLeft} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_CENTER}
                            className="button-align-distribute"
                            id="align-center"
                            selected={false}
                            disabled={alignDisabled}
                            onClick={this._alignHCenter} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_RIGHT}
                            className="button-align-distribute"
                            id="align-right"
                            selected={false}
                            disabled={alignDisabled}
                            onClick={this._alignRight} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_TOP}
                            className="button-align-distribute"
                            id="align-top"
                            selected={false}
                            disabled={alignDisabled}
                            onClick={this._alignTop}/>
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_MIDDLE}
                            className="button-align-distribute"
                            id="align-middle"
                            selected={false}
                            disabled={alignDisabled}
                            onClick={this._alignVCenter}/>
                        <SplitButtonItem
                            title={strings.TOOLTIPS.ALIGN_BOTTOM}
                            className="button-align-distribute"
                            id="align-bottom"
                            selected={false}
                            disabled={alignDisabled}
                            onClick={this._alignBottom}/>
                    </SplitButtonList>
                </div>
            );
        },
    });

    module.exports = AlignDistribute;
});
