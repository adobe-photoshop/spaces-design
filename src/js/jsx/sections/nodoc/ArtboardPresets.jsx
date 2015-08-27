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

    var templatesJSON = require("text!static/templates.json"),
        templates = JSON.parse(templatesJSON);

    var ArtboardPresets = React.createClass({
        mixins: [FluxMixin],

        /**
         * Given a template, call the document action "createNew".
         *
         * @param {string} templateObj Description of the template
         * @param {SyntheticEvent} event
         */
        _openTemplate: function (templateObj, event) {
            var payload = {
                preset: templateObj.preset
            };

            this.getFlux().actions.documents.createNew(payload);
            event.stopPropagation();
        },

        render: function () {
            var templateLinks = templates.map(function (template, index) {
                    return (
                        <li
                            key={index}
                            className="link-list__item"
                            onClick={this._openTemplate.bind(this, template)}>

                            <span>{strings.TEMPLATES[template.id]}</span>
                            <span>{template.width} x {template.height}</span>
                        </li>
                    );
                }, this);

            return (
                <section className="artboard-presets section">
                    <TitleHeader title={strings.NO_DOC.ARTBOARD_PRESETS_TITLE} />
                    <div className="section-container artboard-launcher__body">
                        <ul className="link-list__list">
                            {templateLinks}
                        </ul>
                    </div>
                </section>
            );
        }
    });

    module.exports = ArtboardPresets;
});
