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
        FluxMixin = Fluxxor.FluxMixin(React);

    var strings = require("i18n!nls/strings"),
        TitleHeader = require("jsx!js/jsx/shared/TitleHeader");

    var PRESETS = [
        {name: "iPhone 6", id: "iPhone 6 (750, 1334)", dimensions: "750 x 1334"},
        {name: "iPhone 6 Plus", id: "iPhone 6 Plus (1242, 2208)", dimensions: "1242 x 2208"},
        {name: "iPad", id: "iPad (768, 1024)", dimensions: "768 x 1024"},
        {name: "Web", id: "Web (1440, 900)", dimensions: "1440 x 900"},
        {name: "Web", id: "Web (1920, 1080)", dimensions: "1920 x 1080"},
    ];

    var ArtboardPresets = React.createClass({
        mixins: [FluxMixin],

        /**
         * given a preset name, call the document action "createNew"
         *
         * @param {string} preset string ID of the artboard preset
         * @param {SyntheticEvent} event
         */
        _openPreset: function (preset, event) {
            this.getFlux().actions.documents.createNew(preset);
            event.stopPropagation();    
        },

        render: function () {
            var presetLinks = PRESETS.map(function (preset, index) {
                    return (
                        <li 
                            key={index}
                            className="link-list__item"
                            onClick={this._openPreset.bind(this, preset.id)} >

                            <span>{preset.name}</span>
                            <span>{preset.dimensions}</span>
                        </li>
                    );
                }, this);

            return (
                <section className="artboard-presets section">
                    <TitleHeader title={strings.NO_DOC.ARTBOARD_PRESETS_TITLE} />
                    <div className="section-container artboard-launcher__body">
                        <ul className="link-list__list">
                            {presetLinks}
                        </ul>
                    </div>
                </section>
            );
        }
    });

    module.exports = ArtboardPresets;
});
